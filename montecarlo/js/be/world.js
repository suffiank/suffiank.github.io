"use strict";

export const YEARS_TO_MS = 86400.0*365.25;
export const MS_TO_YEARS = 1.0/YEARS_TO_MS;

class World {

    constructor(inputs) {

        // milliseconds since Jan 1st 1970
        this.unixTime = new Date().getTime();

        // years from start of episode
        this.time = 0.0;

        // record of simulation
        this.history = []

        // actors in the world
        this.inputs = inputs;
        this.agent = new Agent(this);
        this.market = new Market(this);
        this.government = new Government(this);
    }

    step(timeStep) {

        this.time += timeStep;
        this.unixTime += timeStep*YEARS_TO_MS;

        market.step(timeStep);
        agent.step(timeStep);
    }

    run(timeStep, stopTime) {
        
        while (this.time <= stopTime) {
            this.step(timeStep);
        }
    }
}
