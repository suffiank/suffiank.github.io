
"use strict";

var global;

function refreshSimulation() {
   
    let input = global.input;
    global.timings = {};
    global.clockedAt = performance.now();

    // collect 'trials' number of simulations
    let mctrials = []
    for (let i = 0; i < input.montecarlo.trials; i++) {
        console.log(`On trial ${i}`);
        mctrials.push(simulateRandomWalk());
    }

    // sort trials by survival and time-average fair value
    // warning: assumes all time steps are equal
    mctrials = mctrials.sort(
        (s,t) => {

            let savg = s.reduce((p,q) => p + q.assetValue, 0)/s.length;
            let tavg = t.reduce((p,q) => p + q.assetValue, 0)/t.length;

            let sfinal = s[s.length-1].assetValue;
            let tfinal = t[t.length-1].assetValue;

            if (sfinal <= 0.0) return -1;
            if (tfinal <= 0.0) return 1;
            return savg < tavg? -1 : 1;
    });

    global.mctrials = mctrials;
}

function getPortfolioValuations(portfolio, market, absoluteTime) {

    let stockValue = portfolio
        .filter((asset) => market.securities[asset.symbol].class == "stock")
        .reduce((value, stock) => value + 
            stock.units * market.securities[stock.symbol].price, 0.0);

    let bondsValue = portfolio
        .filter((asset) => market.securities[asset.symbol].class == "bond")
        .reduce((value, bond) => value + 
            bond.units * getBondValue(
                bond, market.securities[bond.symbol], absoluteTime, market.interest), 0.0);

    return {stockValue: stockValue, bondsValue: bondsValue};
}

function evolveSecurities(market, timeStep) {

    for (let symbol in market.securities) {

        let security = market.securities[symbol];
        switch (security.class) {
            case "stock":

                let stock = security;
                let step = stock.sigma * Math.sqrt(timeStep);
                let delta = Math.random() < 0.5? -step : step;

                stock.price *= 1.0 + timeStep*security.return + delta;
                if (stock.price < 0.0) stock.price = 0.0;                    
                break;
        }
    }
}

function evolveMarketRates(market, timeStep) {

    let step = market.interestSigma * Math.sqrt(timeStep);
    let delta = Math.random() < 0.5? -step : step;

    market.interest += market.vasicek.a*(market.vasicek.b - market.interest)*timeStep + delta;
    if (market.interest < 0.0) market.interest = 0.0;
}

function recieveSecuritiesPayouts(agent, market, absoluteTime, comments) {
 
    let portfolio = agent.portfolio;
    let securities = market.securities;

    let payments = {dividends: 0.0, coupons: 0.0, matured: 0.0};

    let expire = [];
    portfolio.forEach((asset, index) => {

        let security = securities[asset.symbol];
        if (["stock", "bond"].includes(security.class) && security.paymentPeriod > 0.0) {

            // does stock or bond have payout?
            if (absoluteTime - asset.lastPaymentOn >= security.paymentPeriod*global.yearsToMs) {
                switch (security.class) {

                    case "stock": 
                        payments.dividends += asset.units * security.dividend;
                        agent.cash += asset.units * security.dividend;
                        break;

                    case "bond":  
                        payments.coupons += asset.units * security.coupon;
                        agent.cash += asset.units * security.coupon;
                        break;
                }

                asset.lastPaymentOn = absoluteTime;
            }

            // does bond mature?
            if (security.class == "bond")
            if (absoluteTime - asset.purchased >= security.duration*global.yearsToMs) {

                payments.matured += asset.units * security.faceValue;
                agent.cash += asset.units * security.faceValue;

                comments.push(`Matured ${asset.units} bonds at $${security.faceValue.toFixed(2)} each.`);
                expire.push(index);
            }
        }
    });

    // remove matured bonds
    while (expire.length) {
        portfolio.splice(expire.pop(), 1);
    }

    return payments;
}

function balanceCashToInvestments(agent, market, absoluteTime, comments) {

    agent.portfolio = agent.portfolio.sort((a,b) => a.purchased < b.purchased? -1:1);

    let shortCapitalGain = 0.0, longCapitalGain = 0.0;
    let liquidated = 0.0;
    while (agent.cash < agent.minCash && agent.portfolio.length > 0) {

        let asset = agent.portfolio[0];

        let saleNeed = (agent.maxCash + agent.minCash)/2.0 - agent.cash;
        let fetchPrice = getAssetValue(asset, market, absoluteTime);

        let neededUnits = Math.floor(saleNeed/fetchPrice);
        let actualUnits = Math.min(asset.units, neededUnits);
        let saleCash = actualUnits*fetchPrice;

        liquidated += saleCash;
        agent.cash += saleCash;
        asset.units -= actualUnits;

        if ( (absoluteTime - asset.purchased)*global.msToYears > 1.0 )
            longCapitalGain += saleCash - actualUnits*asset.costBasis;
        else
            shortCapitalGain += saleCash - actualUnits*asset.costBasis;
        
        comments.push(`Sold ${actualUnits} shares of ${asset.symbol} for $${fetchPrice.toFixed(2)} each.`);

        if (asset.units == 0) {
            agent.portfolio.splice(0, 1);
        }
    }

    let investmentCost = 0.0;
    if (agent.cash > agent.maxCash) {

        let purchasePower = agent.cash - (agent.maxCash + agent.minCash)/2.0;

        let purchaseStock = purchasePower * agent.stockToBonds;
        let purchaseBonds = purchasePower - purchaseStock;

        let classes = ['stock', 'bonds']
        for (let i = 0; i < classes.length; i++) {

            let symbol = classes[i] == 'stock'? 'SPY' : 'UST';
            let purchaseAmount = classes[i] == 'stock'? purchaseStock : purchaseBonds;

            let asset = {
                symbol: symbol,
                purchased: absoluteTime,
            };

            asset.costBasis = +(getAssetValue(asset, market, absoluteTime).toFixed(2));
            asset.units = Math.floor(purchaseAmount/asset.costBasis);
            setFakeLastPayment(asset, market.securities[asset.symbol]);
            agent.portfolio.push(asset);

            let saleCost = asset.units*asset.costBasis;
            investmentCost += saleCost;
            agent.cash -= saleCost;

            comments.push(`Purchased ${asset.units} shares of ${symbol} at $${asset.costBasis}.`);
        }
    }

    return {invested: investmentCost, liquidated: liquidated, 
        shortGain: shortCapitalGain, longGain: longCapitalGain};
}

function calculateTaxes(brackets, income) {

    let taxes = 0.0, covered = 0.0;
    for (let i = 0; i < brackets.length; i++) {
        if (income >= covered) {

            let portion = Math.min(brackets[i].upto, income) - covered;
            taxes += brackets[i].rate*portion;
            covered += portion;
        }
    }

    return taxes;
}

function payTaxes(agent, taxYear, earnedIncome, capitalGain) {

    // need to include FICA and separate social security

    // individual
    let standardDeduction = 12200.0;
    let federalBrackets = [
        {rate: 0.10, upto: 9700.0},
        {rate: 0.12, upto: 39475.0},
        {rate: 0.22, upto: 84200.0},
        {rate: 0.24, upto: 160725.0},
        {rate: 0.32, upto: 204100.0},
        {rate: 0.35, upto: 510300.0},
        {rate: 0.37, upto: Infinity},
    ];
    let taxableIncome = earnedIncome - standardDeduction;
    let earnedTaxes = calculateTaxes(federalBrackets, taxableIncome);

    // long-term capital gains
    let capitalGainBrackets = [
        {rate: 0.10, upto: 9700.0},
        {rate: 0.12, upto: 39475.0},
        {rate: 0.22, upto: 84200.0},
        {rate: 0.24, upto: 160725.0},
        {rate: 0.32, upto: 204100.0},
        {rate: 0.35, upto: 510300.0},
        {rate: 0.37, upto: Infinity},
    ];
    let capitalTaxes = calculateTaxes(capitalGainBrackets, capitalGain);

    agent.cash -= earnedTaxes + capitalTaxes;
    agent.lastPaidTaxYear = taxYear;

    return {earnedTaxes: earnedTaxes, capitalTaxes: capitalTaxes};
}

function collectElapsed(segmentTag) {

    let now = performance.now();

    if (!(segmentTag in global.timings))
        global.timings[segmentTag] = {elapsed: 0.0, count: 0, mean: 0.0};
    let segment = global.timings[segmentTag];

    segment.elapsed += now - global.clockedAt;
    segment.count += 1;
    segment.mean = segment.elapsed / segment.count;

    global.clockedAt = performance.now();    
}

function simulateRandomWalk() {

    let input = global.input;

    // create deep copy of starting conditions
    let market = JSON.parse(JSON.stringify(input.market));
    let agent = JSON.parse(JSON.stringify(input.agent))

    let timeStep = input.montecarlo.timeStep;
    let nyears = agent.stopAge - agent.startAge;
    let nsteps = Math.floor(nyears/timeStep);

    let startDay = new Date().getTime();
    let lastRecordedAt = -1e5;
 
    agent.bankrupt = false;
    agent.lastPaidTaxYear = new Date().getFullYear() - 1;

    // initialize an expected last payment based on purchase date
    agent.portfolio.forEach(asset => 
        setFakeLastPayment(asset, market.securities[asset.symbol])
    )

    let accrued = {
        cashflow: 0.0,
        dividends: 0.0,
        coupons: 0.0,
        income: 0.0,
        expense: 0.0,
        earned: 0.0,
        spent: 0.0,
        matured: 0.0,
        invested: 0.0,
        liquidated: 0.0,
        taxes: 0.0,
    };

    let annual = {
        earnings: 0.0,
        capitalGain: 0.0,
        deductions: 0.0,
    };

    let comments = [];
    
    let mcwalk = [];
    for (let i = 0; i < nsteps; i++) {

        global.clockedAt = performance.now();

        let relativeTime = i*timeStep;
        let absoluteTime = startDay + 365*24*3600*1000*relativeTime;
        let age = agent.startAge + relativeTime;
        let thisYear = new Date(absoluteTime).getFullYear();

        if (relativeTime - lastRecordedAt > input.montecarlo.recordStep) {

            const {stockValue, bondsValue} = 
                getPortfolioValuations(agent.portfolio, market, absoluteTime);

            let assetValue = agent.cash + stockValue + bondsValue;
            if (assetValue < 0.0) agent.bankrupt = true;
            if (agent.bankrupt) comments.push("Bankrupt :(");

            var point = {
                time: new Date(absoluteTime),
                assetValue: assetValue,
                cash: agent.cash,
                spyPrice: market.securities['SPY'].price,
                stockValue: stockValue,
                bondsValue: bondsValue,
                interest: market.interest,
                inflation: market.inflation,
                accrued: {

                    coupons: accrued.coupons,
                    dividends: accrued.dividends,
                    matured: accrued.matured,
                    invested: accrued.invested,
                    liquidated: accrued.liquidated,
                    earned: accrued.earned,
                    spent: accrued.spent,
                    income: accrued.income,
                    expense: accrued.expense,
                    taxes: accrued.taxes,
                    cashflow: accrued.cashflow,
                },
                comments: comments,
            }
            mcwalk.push(point);

            for (let property in accrued)
                accrued[property] = 0.0;
            lastRecordedAt = relativeTime;
            comments = [];

            if (agent.bankrupt) break;

            collectElapsed("record-step");
        }

        // forward market conditions by time step
        evolveSecurities(market, timeStep);
        evolveMarketRates(market, timeStep);

        collectElapsed("evolve-market");

        // dividends, coupons, and matured bonds
        const {dividends, coupons, matured} = 
            recieveSecuritiesPayouts(agent, market, absoluteTime, comments);

        collectElapsed("recieve-payouts");

        // additional income and expense adjustments
        agent.cash += agent.earnings*timeStep;
        agent.cash += age > 67? agent.socialsecurity*timeStep : 0.0;

        agent.cash -= agent.expenses*timeStep;
        agent.cash -= age < 65? agent.healthcare*timeStep : 0.0;

        // buy and sell to maintain cash range
        const {invested, liquidated, shortGain, longGain} = 
            balanceCashToInvestments(agent, market, absoluteTime, comments);

        collectElapsed("balance-cash");
        
        // accruals
        accrued.liquidated += liquidated;
        accrued.matured += matured;
        accrued.coupons += coupons;
        accrued.dividends += dividends;

        accrued.spent += agent.expenses*timeStep;
        accrued.invested += invested;

        let income =  agent.earnings*timeStep + coupons + dividends + matured + liquidated
            + (age > 67? agent.socialsecurity*timeStep : 0.0);
        accrued.income += income;

        let earnings = agent.earnings*timeStep + coupons + dividends + shortGain;
        accrued.earned += earnings;

        collectElapsed("accrue-flows");

        // accrue income or pay taxes
        let taxes = 0.0;
        if (thisYear == agent.lastPaidTaxYear + 1) {

            annual.earnings += earnings;
            annual.capitalGain += longGain;
        }
        else {
            let taxYear = thisYear - 1;

            const {earnedTaxes, capitalTaxes} = 
                payTaxes(agent, taxYear, annual.earnings, annual.capitalGain);

            taxes = earnedTaxes + capitalTaxes;
            accrued.taxes += taxes;
            annual.earnings = 0.0;
            annual.capitalGain = 0.0;
        }

        collectElapsed("pay-taxes");

        let expense = agent.expenses*timeStep + invested + taxes
            + (age < 65? agent.healthcare*timeStep : 0.0)

        accrued.expense += expense;
        accrued.cashflow += income - expense;

        // inflation adjustment
        agent.earnings *= 1.0 + market.inflation*timeStep;
        agent.expenses *= 1.0 + market.inflation*timeStep;

        collectElapsed("accrue-expense");
    }

    for (let segmentTag in global.timings) {

        let segment = global.timings[segmentTag];
        let elapsed = (segment.elapsed/1000.0).toFixed(3);
        let calls = segment.count;

        console.log(`Segment '${segmentTag}' took ${elapsed} sec over ${calls} calls`);
    }
    return mcwalk;
}

function setFakeLastPayment(asset, security) {

    let startOfYear = new Date(new Date(asset.purchased).getFullYear(), 0, 1).getTime();
    let referencePaymentOn = startOfYear + security.paymentDelay*global.yearsToMs;

    let f = 1.0/security.paymentPeriod;
    let n = Math.floor( (asset.purchased - referencePaymentOn)*global.msToYears*f );
    asset.lastPaymentOn = referencePaymentOn + n*security.paymentPeriod*global.yearsToMs;
}

function getAssetValue(asset, market, absoluteTime) {

    let security = market.securities[asset.symbol];
    switch (security.class) {
        case "stock": 
            return security.price;
        case "bond": 
            return getBondValue(asset, security, absoluteTime, market.interest);
    }

    return 0.0;
}

function getBondValue(bondAsset, bondIssue, absoluteTime, interest) {

    // t0 = time in years to next coupon
    // t1 = time in years to maturity date
    let f = 1.0/bondIssue.paymentPeriod;
    let n = Math.ceil( (absoluteTime - bondAsset.lastPaymentOn)*global.msToYears*f );
    let t0 = (bondAsset.lastPaymentOn - absoluteTime)*global.msToYears + n/f;
    let t1 = (bondAsset.purchased - absoluteTime)*global.msToYears + bondIssue.duration;

    let value = 0.0;
    for (let t = t0; t < t1; t += 1.0/f) {
        value += bondIssue.coupon / Math.pow(1.0 + interest, t);
    }

    value += bondIssue.faceValue / Math.pow(1.0 + interest, t1);
    return value;
}