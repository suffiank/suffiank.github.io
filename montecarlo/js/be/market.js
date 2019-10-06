"use strict";

class Market {

    constructor(world) {

        this.world = world;
        
        for (property in world.inputs.market) {
            this.property = world.inputs.market.property;
        }

        let securitiesPOD = world.inputs.market.securities;

        this.securities = [];
        for (let i = 0; i < securitiesPOD.length; i++) {
            this.securities.push(new Security(securitiesPOD[i]));
        }
    }

    step(timeStep) {

        this._stepStockMarket(timeStep);
        this._stepInterestRates(timeStep);
    }

    _stepStockMarket(timeStep) {

        for (let symbol in this.securities) {

            let security = this.securities[symbol];
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

    _stepInterestRates(timeStep) {
            
        let step = this.interestSigma * Math.sqrt(timeStep);
        let delta = Math.random() < 0.5? -step : step;

        this.interest += 
            this.vasicek.a*(this.vasicek.b - this.interest)*timeStep + delta;
            
        if (this.interest < 0.0) this.interest = 0.0;
    }
}