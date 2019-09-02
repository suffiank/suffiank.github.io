"use strict";

class Portfolio {

    constructor(world) {

        this.world = world;

        this.assets = [];
        world.inputs.assets.forEach((asset) => {
            this.assets.push(new Asset(world, asset.symbol, asset.units));
        });
    }
    
    get value(kind) {

        let market = this.world.market;
        let time = this.world.unixTime;

        let total = this.assets
            .filter((asset) => market.securities[asset.symbol].class == kind)
            .reduce((value, asset) => value + 
                asset.units * market.securities[asset.symbol].value(), 0.0);

        return total;
    }

    getPayments() {

        payments = {};
        this.assets.forEach((asset) => {
            payments[asset.kind()] += asset.getPayment();
        })

        return payments;
    }
}