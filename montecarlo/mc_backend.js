
"use strict";

var globalSimulationInputs;
var globalSimulationWalks;

function refreshSimulation() {
   
    let inputs = globalSimulationInputs;

    // collect 'trials' number of simulations
    let walks = []
    for (let i = 0; i < inputs.montecarlo.trials; i++) {
        walks.push(simulateRandomWalk());
    }

    // sort trials by survival and time-average fair value
    // warning: assumes all time steps are equal
    walks = walks.sort(
        (s,t) => {

            let savg = s.reduce((p,q) => p + q.value, 0)/s.length;
            let tavg = t.reduce((p,q) => p + q.value, 0)/t.length;

            let sfinal = s[s.length-1].assetValue;
            let tfinal = t[t.length-1].assetValue;

            if (sfinal <= 0.0) return -1;
            if (tfinal <= 0.0) return 1;
            return savg < tavg? -1 : 1;
    });

    globalSimulationWalks = walks;
}

function simulateRandomWalk() {

    // pull parameters from input settings
    let inputs = globalSimulationInputs;

    let timeStep = inputs.montecarlo.timeStep;
    let nyears = inputs.stopAge - inputs.startAge;
    let nsteps = Math.floor(nyears/timeStep);

    let today = new Date().getTime();
    let lastRecordedAt = -1e5;
    let dead = false;

    let cash = inputs.cash;
    let income = inputs.income;
    let expenses = inputs.expenses;
    
    let stock = {};
    stock.price = inputs.stock.price;
    stock.units = inputs.stock.units;

    let bonds = {};
    bonds.units = inputs.bonds.units;

    let interest = inputs.interest.rate;

    let walk = [];
    for (let i = 0; i < nsteps; i++) {

        // random walk equity
        let step = inputs.stock.sigma * Math.sqrt(timeStep);
        let delta = Math.random() < 0.5? -step : step;        

        stock.price *= 1.0 + timeStep*inputs.stock.return + delta;
        if (stock.price < 0.0) stock.price = 0.0;
        stock.price = stock.price.toFixed(2);

        // random walk interest
        step = inputs.interest.sigma * Math.sqrt(timeStep);
        delta = Math.random() < 0.5? -step : step;

        interest *= 1.0 + delta;        
        if (interest < 0.0) interest = 0.0;
        interest = interest.toFixed(4);

        let time = i*timeStep;
        let age = inputs.startAge + time;
        console.log(inputs.interest.sigma);
        throw "stop";

        cash += income * timeStep;
        cash += age > 67? inputs.socialsecurity*timeStep : 0.0;
        cash += interest*bonds.units*1000.0*timeStep;

        cash -= expenses * timeStep;
        cash -= age < 65? inputs.healthcare*timeStep : 0.0;

        income *= 1.0 + inputs.inflation*timeStep;
        expenses *= 1.0 + inputs.inflation*timeStep;

        if (time - lastRecordedAt > inputs.montecarlo.recordStep) {

            var point = {
                time: new Date(today + 365*24*3600*1000*time),
                cash: cash,
                stockValue: stock.units*stock.price,
                bondsValue: bonds.units*1000.0,
                interestRate: interest
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