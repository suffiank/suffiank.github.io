
"use strict";

var global;

function refreshSimulation() {
   
    let input = global.input;

    // collect 'trials' number of simulations
    let mctrials = []
    for (let i = 0; i < input.montecarlo.trials; i++) {
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

function simulateRandomWalk() {

    let input = global.input;

    // create deep copy of starting conditions
    let market = JSON.parse(JSON.stringify(input.market));
    let agent = JSON.parse(JSON.stringify(input.agent))

    let timeStep = input.montecarlo.timeStep;
    let nyears = agent.stopAge - agent.startAge;
    let nsteps = Math.floor(nyears/timeStep);

    let today = new Date().getTime();
    let lastRecordedAt = -1e5;
    let dead = false;

    let accrued = {
        dividends: 0.0,
        coupons: 0.0,
        income: 0.0,
        expense: 0.0,
        matured: 0.0,
        transactions: 0.0,
    };

    let comment = "";
    
    let walk = [];
    for (let i = 0; i < nsteps; i++) {

        let relativeTime = i*timeStep;
        let absoluteTime = today + 365*24*3600*1000*relativeTime;
        let age = agent.startAge + relativeTime;

        if (relativeTime - lastRecordedAt > input.montecarlo.recordStep) {

            let stockValue = agent.portfolio
                .filter((asset) => market.securities[asset.symbol].class == "stock")
                .reduce((value, stock) => value + 
                    stock.units * market.securities[stock.symbol].price, 0.0);

            let bondsValue = agent.portfolio
                .filter((asset) => market.securities[asset.symbol].class == "bond")
                .reduce((value, bond) => value + 
                    bond.units * getBondValue(
                        bond, market.securities[bond.symbol], absoluteTime, market.interest), 0.0);

            let assetValue = agent.cash + stockValue + bondsValue;
            if (assetValue < 0.0) dead = true;
            if (dead) comment += "Bankrupt :(\n"

            var point = {
                time: new Date(absoluteTime),
                assetValue: assetValue,
                cash: agent.cash,
                spyPrice: market.securities['SPY'].price,
                stockValue: stockValue,
                bondsValue: bondsValue,
                interestRate: market.interest,
                inflationRate: market.inflation,                
                coupons: accrued.coupons,
                dividends: accrued.dividends,
                matured: accrued.matured,
                transactions: accrued.transactions,
                income: accrued.income,
                expense: accrued.expense,
                comment: comment,
            }
            walk.push(point);

            for (let property in accrued) {
                accrued[property] = 0.0;
            }
            lastRecordedAt = relativeTime;
            comment = "";

            if (dead) break;
        }

        // random walk equities
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

        // random walk interest
        let step = market.interestSigma * Math.sqrt(timeStep);
        let delta = Math.random() < 0.5? -step : step;

        market.interest += market.vasicek.a*(market.vasicek.b - market.interest)*timeStep + delta;
        if (market.interest < 0.0) market.interest = 0.0;

        // coupons and dividends
        let expire = [];
        let payments = {dividends: 0.0, coupons: 0.0, matured: 0.0};

        agent.portfolio.forEach((asset, index) => {

            let security = market.securities[asset.symbol];
            if (["stock", "bond"].includes(security.class) && security.frequency > 0.0) {
                if (absoluteTime - asset.lastPaymentOn >= (365*24*3600*1000)/security.frequency) {
                    switch (security.class) {
                        case "stock": 
                            payments.dividends += asset.units * security.dividend;
                            break;
                        case "bond":  
                            payments.coupons += asset.units * security.coupon;
                            break;
                    }
                    asset.lastPaymentOn = absoluteTime;
                }
                if (security.class == "bond")
                if (absoluteTime - asset.purchased >= (365*24*3600*1000)*security.duration) {
                    payments.matured += asset.units * security.faceValue;
                    comment += `Matured ${asset.units} bonds at $${security.faceValue.toFixed(2)} each.<br>`
                    expire.push(index);
                }
            }
        });

        while (expire.length) {
            agent.portfolio.splice(expire.pop(), 1);
        }


        // income and expense adjustments
        agent.cash += agent.income*timeStep;
        agent.cash += payments.dividends;
        agent.cash += payments.coupons;        
        agent.cash += payments.matured;
        agent.cash += age > 67? agent.socialsecurity*timeStep : 0.0;

        agent.cash -= agent.expenses*timeStep;
        agent.cash -= age < 65? agent.healthcare*timeStep : 0.0;

        // buy and sell to maintain cash range
        agent.portfolio = agent.portfolio.sort((a,b) => a.purchased < b.purchased? -1:1);

        let capitalGain = 0.0, salesIncome = 0.0;
        while (agent.cash < agent.minCash && agent.portfolio.length > 0) {

            let asset = agent.portfolio[0];

            let saleNeed = (agent.maxCash + agent.minCash)/2.0 - agent.cash;
            let fetchPrice = getAssetValue(asset, market, absoluteTime);

            let neededUnits = Math.floor(saleNeed/fetchPrice);
            let saleUnits = Math.min(asset.units, neededUnits);

            let saleCash = saleUnits*fetchPrice;
            capitalGain += saleCash - saleUnits*agent.portfolio.costBasis;
            salesIncome += saleCash;
            agent.cash += saleCash;
            asset.units -= saleUnits;
            
            comment += `Sold ${saleUnits} shares of ${asset.symbol} for $${fetchPrice.toFixed(2)} each.<br>`;

            if (asset.units == 0) {
                agent.portfolio.splice(0, 1);
            }
        }

        let purchaseCosts = 0.0;
        if (agent.cash > agent.maxCash) {

            let purchasePower = agent.cash - (agent.maxCash + agent.minCash)/2.0;

            let purchaseStock = purchasePower*agent.stockToBonds;
            let purchaseBonds = purchasePower - purchaseStock;

            let classes = ['stock', 'bonds']
            for (let i = 0; i < classes.length; i++) {

                let symbol = classes[i] == 'stock'? 'SPY' : 'UST';
                let purchaseAmount = classes[i] == 'stock'? purchaseStock : purchaseBonds;

                // this needs to be done better!
                let startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
                let yearsToMs = 1000*3600*24*365;
                let msToYears = 1.0/yearsToMs;

                let f = market.securities[symbol].frequency;
                let n = Math.floor( (absoluteTime - startOfYear)*msToYears*f );
                let lastPaymentOn = startOfYear + yearsToMs*n/f;

                let asset = {
                    symbol: symbol,
                    purchased: absoluteTime,
                    lastPaymentOn: lastPaymentOn
                };                
                asset.price = +(getAssetValue(asset, market, absoluteTime).toFixed(2));
                asset.units = Math.floor(purchaseAmount/asset.price);
                agent.portfolio.push(asset);
    
                purchaseCosts += asset.units*asset.price;
                agent.cash -= asset.units*asset.price;
    
                comment += `Purchased ${asset.units} shares of ${symbol} at $${asset.price.toFixed(2)}.<br>`;                
            }
        }
        
        // accruals
        accrued.transactions += salesIncome - purchaseCosts;
        accrued.matured += payments.matured;
        accrued.coupons += payments.coupons;
        accrued.dividends += payments.dividends;
        accrued.income += agent.income*timeStep + payments.coupons + payments.dividends;
        accrued.expense += agent.expenses*timeStep;

        // inflation adjustment
        agent.income *= 1.0 + market.inflation*timeStep;
        agent.expenses *= 1.0 + market.inflation*timeStep;
    }

    return walk;
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

    const yearsToMs = 365*24*3600*1000;
    const msToYears = 1.0/yearsToMs;

    // t0 = time in years to next coupon
    // t1 = time in years to maturity date
    let f = bondIssue.frequency;
    let n = Math.ceil( (absoluteTime - bondAsset.lastPaymentOn)*msToYears*f );
    let t0 = (bondAsset.lastPaymentOn - absoluteTime)*msToYears + n/f;
    let t1 = (bondAsset.purchased - absoluteTime)*msToYears + bondIssue.duration;

    let value = 0.0;
    for (let t = t0; t < t1; t += 1.0/f) {
        value += bondIssue.coupon / Math.pow(1.0 + interest, t);
    }

    value += bondIssue.faceValue / Math.pow(1.0 + interest, t1);
    return value;
}