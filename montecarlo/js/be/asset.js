"use strict";

import { YEARS_TO_MS, MS_TO_YEARS } from "./world";

class Asset {

    constructor(world, symbol, units) {
 
        this.world = world;

        this.symbol = symbol;
        this.units = units;
        this.purchased = new Date().getTime();

        this.security = world.market.securities[symbol];
        this._initFakeLastPaid();
    }

    value() {

        let security = this.security;

        switch (security.class) {

            case "stock": 
                return this.units * security.price;

            case "bond": 
                return this.units * this._valueAsBond();
        }
    
        return 0.0;
    }

    kind() {
        return this.security.class;
    }

    getPayment() {

        let time = this.world.unixTime;
        let security = this.security;

        if (time - this.lastPaymentOn >= security.paymentPeriod*YEARS_TO_MS) {

            this.lastPaymentOn = time;
            switch (security.class) {

                case "stock": 
                    return this.units * security.dividend;

                case "bond":  
                    return this.units * security.coupon;
            }
        }

        return 0.0;
    }

    // use Python underscore convention to mark private
    _valueAsBond() {

        let issue = this.security;
        let now = this.world.unixTime;
        let interest = this.world.market.interest;

        // t0 = time in years to next coupon
        // t1 = time in years to maturity date
        let f = 1.0/issue.paymentPeriod;
        let n = Math.ceil( (now - this.lastPaymentOn)*MS_TO_YEARS*f );
        let t0 = (this.lastPaymentOn - now)*MS_TO_YEARS + n/f;
        let t1 = (this.purchased - now)*MS_TO_YEARS + issue.duration;

        let value = 0.0;
        for (let t = t0; t < t1; t += 1.0/f) {
            value += issue.coupon / Math.pow(1.0 + interest, t);
        }

        value += issue.faceValue / Math.pow(1.0 + interest, t1);
        return value;
    }

    _initFakeLastPaid() {

        let security = this.security;
    
        if (security.paysForever) {

            let f = 1.0/security.paymentPeriod;
            let n = Math.floor( (this.purchased - security.refPaymentOn)*MS_TO_YEARS*f );

            this.lastPaymentOn = 
                security.refPaymentOn + n*security.paymentPeriod*YEARS_TO_MS;
        }
    }
}