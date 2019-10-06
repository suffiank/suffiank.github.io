"use strict;"

class Government {

    constructor(world) {

        this.world = world;
    }

    recieveTaxes(agent, taxYear, earnedIncome, capitalGain) {

        // need to include FICA and separate social security
    
        // individual
        let standardDeduction = 12200.0;
        let federalBrackets = [
            {rate: 0.10, upto: 9700.0},
            {rate: 0.12, upto: 39475.0},
            {rate: 0.22, upto: 84200.0},
            {rate: 0.24, upto: 160725.0},
            {rate: 0.32, upto: 204100.0},
            {rate: 0.35, upto: 510300.0},
            {rate: 0.37, upto: Infinity},
        ];
        let taxableIncome = earnedIncome - standardDeduction;
        let earnedTaxes = calculateTaxes(federalBrackets, taxableIncome);
    
        // long-term capital gains
        let capitalGainBrackets = [
            {rate: 0.10, upto: 9700.0},
            {rate: 0.12, upto: 39475.0},
            {rate: 0.22, upto: 84200.0},
            {rate: 0.24, upto: 160725.0},
            {rate: 0.32, upto: 204100.0},
            {rate: 0.35, upto: 510300.0},
            {rate: 0.37, upto: Infinity},
        ];
        let capitalTaxes = calculateTaxes(capitalGainBrackets, capitalGain);
    
        agent.cash -= earnedTaxes + capitalTaxes;
        agent.lastPaidTaxYear = taxYear;
    
        return {earnedTaxes: earnedTaxes, capitalTaxes: capitalTaxes};
    }

    // using _ for private functions
    calculateTaxes_(brackets, income) {

        let taxes = 0.0, covered = 0.0;
        for (let i = 0; i < brackets.length; i++) {
            if (income >= covered) {
    
                let portion = Math.min(brackets[i].upto, income) - covered;
                taxes += brackets[i].rate*portion;
                covered += portion;
            }
        }
    
        return taxes;
    }    
}