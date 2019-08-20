
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

            let savg = s.reduce((p,q) => p + q.value, 0)/s.length;
            let tavg = t.reduce((p,q) => p + q.value, 0)/t.length;

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
    let nyears = input.stopAge - input.startAge;
    let nsteps = Math.floor(nyears/timeStep);

    let today = new Date().getTime();
    let lastRecordedAt = -1e5;
    let dead = false;

    let cash = input.cash;
    let income = input.income;
    let expenses = input.expenses;
    
    let stock = {};
    stock.price = input.stock.price;
    stock.units = input.stock.units;

    let bonds = {};
    bonds.units = input.bonds.units;

    let interest = input.interest.rate;
    let inflation = input.inflation.rate;

    let walk = [];
    for (let i = 0; i < nsteps; i++) {

        // random walk equity
        let step = input.stock.sigma * Math.sqrt(timeStep);
        let delta = Math.random() < 0.5? -step : step;        

        stock.price *= 1.0 + timeStep*input.stock.return + delta;
        if (stock.price < 0.0) stock.price = 0.0;
        stock.price = +(stock.price.toFixed(2));

        // random walk interest
        step = input.interest.sigma * Math.sqrt(timeStep);
        delta = Math.random() < 0.5? -step : step;

        interest *= 1.0 + delta;        
        if (interest < 0.0) interest = 0.0;
        interest = +(interest.toFixed(4));

        let time = i*timeStep;
        let age = input.startAge + time;

        cash += income * timeStep;
        cash += age > 67? input.socialsecurity*timeStep : 0.0;
        cash += interest*bonds.units*1000.0*timeStep;

        cash -= expenses * timeStep;
        cash -= age < 65? input.healthcare*timeStep : 0.0;

        income *= 1.0 + inflation*timeStep;
        expenses *= 1.0 + inflation*timeStep;

        if (time - lastRecordedAt > input.montecarlo.recordStep) {

            var point = {
                time: new Date(today + 365*24*3600*1000*time),
                cash: cash,
                stockValue: stock.units*stock.price,
                bondsValue: bonds.units*1000.0,
                interestRate: interest,
            }

            point.assetValue = point.cash + point.stockValue + point.bondsValue;

            if (point.assetValue <= 0.0) dead = true;
            if (dead) point.assetValue = 0.0;
            walk.push(point);

            lastRecordedAt = time;
        }
    }

    return walk;
}