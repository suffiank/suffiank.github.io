
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
                    bond.units * getBondValue(market.securities[bond.symbol], market.interest), 0.0);

            var point = {
                time: new Date(absoluteTime),
                cash: agent.cash,
                spyPrice: market.securities['SPY'].price,
                stockValue: stockValue,
                bondsValue: bondsValue,
                interestRate: market.interest,
                inflationRate: market.inflation,
                coupons: accrued.coupons,
                dividends: accrued.dividends,
                matured: accrued.matured,
                income: accrued.income,
                expense: accrued.expense,
                comment: comment,
            }

            point.assetValue = point.cash + point.stockValue + point.bondsValue;

            if (point.assetValue <= 0.0) dead = true;
            if (dead) point.assetValue = 0.0;
            walk.push(point);

            for (let property in accrued) {
                accrued[property] = 0.0;
            }
            lastRecordedAt = relativeTime;
            comment = "";
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

function getSecurityValue(security) {
    switch (security.kind) {
        case "stock": return security.price;
        case "bond": return bondValue(security);
    }
}

function getBondValue(bond, interest) {

    let value = 0.0, discount = 1.0;
    for (let t = 0; t < bond.duration * bond.frequency; t++) {
        discount /= 1.0 + interest;
        value += discount*bond.coupon
    }

    value += bond.faceValue / Math.pow(1.0 + interest, bond.duration);
    return value;
}