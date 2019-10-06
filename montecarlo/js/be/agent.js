"use strict";

class Agent {

    constructor(world) {

        this.world = world;

        for (property in world.inputs.agent) {
            this.property = world.inputs.agent.property;
        }

        this.portfolio = new Portfolio(world.inputs.agent.portfolio);
    }

    step(timeStep) {

    }

    _payTaxes() {

    }

    _balancePortfolio() {
        
    }
}