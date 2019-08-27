"use strict";
var global = {};

// absolute time and dates in UNIX time (or ms since 1970).
// relative time and durations expressed as fraction of years.
global.yearsToMs = 1000*3600*24*365;
global.msToYears = 1.0/global.yearsToMs;
global.dateFormat = {year: 'numeric', month: '2-digit', day: '2-digit'};

function onPageLoad() {

    onSimulate();
}

function launchWorker() {
    return new Worker(
        URL.createObjectURL(
            new Blob(["("+workerCodeWrap.toString()+")()"], 
            {type: 'text/javascript'}
        )
    ));
}

function onSimulate() {

    refreshInputs();
    refreshPercentileText();

    if (typeof global.worker  === 'undefined') {
        global.worker = launchWorker();
        global.worker.addEventListener('message', recieveWorkerMessage, false);
    }

    global.worker.postMessage({command: 'simulate', input: global.input});
}

function recieveWorkerMessage(event) {

    switch (event.data.notice) {
        case 'done':
            global.mctrials = event.data.mctrials;
            refreshGraph();
            refreshTable();
            break;
    }
}

function onPercentileChange() {

    refreshPercentileText();
    refreshGraph();
    refreshTable();
}

function onPercentileInput() {

    refreshPercentileText();
    refreshTable();
}

function getInput(id, kind = "float") {

    switch(kind) {
        case "float":
            return +(parseFloat(document.getElementById(id).value).toFixed(4));
        case "int":
            return parseInt(document.getElementById(id).value);
        case "money":
            return +(parseFloat(document.getElementById(id).value).toFixed(2));
        case "days":
            return parseFloat(document.getElementById(id).value)/365.0;
    }

    throw `Cannot fetch input ${id} of unknown kind '${kind}'`;
}

function refreshPercentileText() {

    let percentile = getInput("percentile-bar", "int");
    global.input.display.percentile = percentile;
    document.getElementById("percentile-text-id").innerHTML = `${percentile}th percentile`;
}

function refreshInputs() {

    let input = {};

    // agent profile (age, income etc.)
    input.agent = getAgentProfile();
    input.market = getMarketConditions();

    // starting agent portfolio 

    // Monte Carlo simulation parameters
    input.montecarlo = {};
    let delYears = input.agent.stopYear - new Date().getFullYear();
    input.montecarlo.trials = getInput("trials", "int");
    input.montecarlo.timeStep = getInput("mc-step", "days");
    input.montecarlo.recordStep = delYears/50.0 * 20.0/365.0;
    input.agent.stopAge = input.agent.startAge + delYears;

    // display parameters
    input.display = {};
    input.display.percentile = getInput("percentile-bar", "int");
    input.display.printStep = getInput("print-step", "days");

    global.input = input;
}

function getAgentProfile() {

    let agent = {};

    // basic profile
    agent.startAge = getInput("start-age", "int");
    agent.stopYear = getInput("stop-year", "int");
    agent.cash = getInput("start-cash", "money");

    agent.earnings = getInput("income", "money");
    agent.expenses = getInput("expenditure", "money");
    agent.healthcare = getInput("healthcare", "money");
    agent.socialsecurity = getInput("social-security", "money");

    // portfolio and strategy
    agent.strategy = "cash-balance";
    agent.minCash = getInput("min-cash", "money");
    agent.maxCash = getInput("max-cash", "money");
    agent.stockToBonds = getInput("stock-to-bonds");
    agent.portfolio = getStartPortfolio();

    return agent;
}

function getMarketConditions() {

    // starting market conditions
    let market = {};
    market.securities = {};

    // payment delay is offset from start of year
    let SPY = market.securities['SPY'] = {};
    SPY.class = "stock";
    SPY.price = getInput("spy-price", "money");
    SPY.return = getInput("spy-return");    
    SPY.sigma = getInput("spy-sigma");
    SPY.dividend = 1.43;
    SPY.paymentPeriod = 0.25;
    SPY.paymentDelay = 0.0; 

    let UST = market.securities['UST'] = {};
    UST.class = "bond";
    UST.faceValue = 1000.00;
    UST.coupon = getInput("bond-coupon", "money");
    UST.paymentPeriod = 1.0/getInput("bond-frequency", "int");
    UST.paymentDelay = 0.0;
    UST.duration = getInput("bond-duration");
    UST.moodys = "Aaa";

    market.inflation = getInput("inflation-rate");
    market.inflationSigma = getInput("inflation-sigma");

    market.interest = getInput("interest-rate");
    market.interestSigma = getInput("interest-sigma");

    market.vasicek = {}
    market.vasicek.a = getInput("vasicek-speed");
    market.vasicek.b = getInput("vasicek-rate"); 
    
    return market;
}

function getStartPortfolio () {

    let today = new Date().getTime();
    
    let portfolio = [
        {
            symbol: 'SPY', 
            units: getInput("spy-units", "int"), 
            purchased: today,
            costBasis: getInput("spy-price", "money"),
            paymentsMade: 0,
        },
        {
            symbol: 'UST', 
            units: getInput("bond-units", "int"), 
            purchased: today,
            costBasis: 1000.0,
            paymentsMade: 0
        }
    ];

    return portfolio;
}