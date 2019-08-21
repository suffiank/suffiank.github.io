
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

    // pull parameters from input settings
    let input = global.input;

    let timeStep = input.montecarlo.timeStep;
    let nyears = input.agent.stopAge - input.agent.startAge;
    let nsteps = Math.floor(nyears/timeStep);

    let today = new Date().getTime();
    let lastRecordedAt = -1e5;
    let dead = false;

    let cash = input.agent.cash;
    let income = input.agent.income;
    let expenses = input.agent.expenses;

    let accruedInterest = 0.0;
    let accruedIncome = 0.0;
    let accruedExpense = 0.0;
    
    let stock = {};
    stock.price = input.market.securities['SPY'].price;
    stock.units = input.agent.portfolio
        .filter((asset) => asset.symbol == 'SPY')
        .reduce((units, asset) => units + asset.units, 0);

    let bonds = {};
    bonds.units = input.agent.portfolio
        .filter((asset) => asset.symbol == 'UST')
        .reduce((units, asset) => units + asset.units, 0);

    let interest = input.market.interest;
    let inflation = input.market.inflation;

    let walk = [];
    for (let i = 0; i < nsteps; i++) {

        let time = i*timeStep;
        let age = input.agent.startAge + time;

        if (time - lastRecordedAt > input.montecarlo.recordStep) {

            var point = {
                time: new Date(today + 365*24*3600*1000*time),
                cash: cash,
                stockPrice: stock.price,
                stockValue: stock.units*stock.price,
                bondsValue: bonds.units*1000.0,
                interestRate: interest,
                inflationRate: inflation,
                interestIncome: accruedInterest,
                income: accruedIncome,
                expense: accruedExpense,
            }

            point.assetValue = point.cash + point.stockValue + point.bondsValue;

            if (point.assetValue <= 0.0) dead = true;
            if (dead) point.assetValue = 0.0;
            walk.push(point);

            accruedInterest = 0.0;
            accruedIncome = 0.0;
            accruedExpense = 0.0;
            lastRecordedAt = time;
        }

        // random walk equity
        let step = input.market.securities['SPY'].sigma * Math.sqrt(timeStep);
        let delta = Math.random() < 0.5? -step : step;        

        stock.price *= 1.0 + timeStep*input.market.securities['SPY'].return + delta;
        if (stock.price < 0.0) stock.price = 0.0;

        // random walk interest
        step = input.market.interestSigma * Math.sqrt(timeStep);
        delta = Math.random() < 0.5? -step : step;

        interest *= 1.0 + delta;        
        if (interest < 0.0) interest = 0.0;

        cash += income * timeStep;
        cash += age > 67? input.agent.socialsecurity*timeStep : 0.0;
        cash += interest*bonds.units*1000.0*timeStep;

        accruedInterest += interest*bonds.units*1000.0*timeStep;
        accruedIncome += (income + interest*bonds.units*1000.0)*timeStep 
        accruedExpense += expenses * timeStep;

        cash -= expenses * timeStep;
        cash -= age < 65? input.agent.healthcare*timeStep : 0.0;

        income *= 1.0 + inflation*timeStep;
        expenses *= 1.0 + inflation*timeStep;
    }

    return walk;
}