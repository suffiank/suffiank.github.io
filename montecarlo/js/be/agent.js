"use strict";

class Agent {

    // portfolio of assets
    // market strategy
    constructor(world) {

        this.world = world;

        for (property in world.inputs.agent) {
            this.property = world.inputs.agent.property;
        }
    }
}