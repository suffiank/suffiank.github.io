
"use strict";

var global = {};

function onPageLoad() {

    onSimulate();
}

function onSimulate() {

    refreshInputs();
    refreshPercentileText();
    refreshSimulation();

    refreshGraph();
    refreshTable();
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
    input.agent = {};
    input.agent.startAge = getInput("start-age", "int");
    input.agent.stopYear = getInput("stop-year", "int");

    input.agent.cash = getInput("start-cash", "money");
    input.agent.maxCash = getInput("max-cash", "money");

    input.agent.income = getInput("income", "money");
    input.agent.expenses = getInput("expenditure", "money");
    input.agent.healthcare = getInput("healthcare", "money");
    input.agent.socialsecurity = getInput("social-security", "money");

    input.agent.portfolio = [];

    let assetStockMarket = {
        symbol: 'SPY', 
        units: getInput("spy-units", "int"), 
        purchased: new Date()
    }
    input.agent.portfolio.push(assetStockMarket);

    let assetFixedIncome = {
        symbol: 'UST', 
        units: getInput("bond-units", "int"), 
        purchased: new Date()
    }
    input.agent.portfolio.push(assetFixedIncome);
    input.agent.strategy = "cash-balance";

    // market conditions
    input.market = {};
    input.market.securities = {};

    input.market.securities['SPY'] = {};
    input.market.securities['SPY'].kind = "stock";
    input.market.securities['SPY'].price = getInput("spy-price", "money");
    input.market.securities['SPY'].return = getInput("spy-return");
    input.market.securities['SPY'].sigma = getInput("spy-sigma");

    input.market.securities['UST'] = {};
    input.market.securities['UST'].kind = "bond";
    input.market.securities['UST'].faceValue = 1000.00;
    input.market.securities['UST'].coupon = getInput("bond-coupon", "money");
    input.market.securities['UST'].frequency =  getInput("bond-frequency", "int");
    input.market.securities['UST'].duration = getInput("bond-duration");    

    input.market.inflation = getInput("inflation-rate");
    input.market.inflationSigma = getInput("inflation-sigma");

    input.market.interest = getInput("interest-rate");
    input.market.interestSigma = getInput("interest-sigma");

    input.market.vasicek = {}
    input.market.vasicek.a = 0.01;
    input.market.vasicek.b = 0.05;

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

function refreshGraph() {

    // extract Monte Carlo simulation for requested %-tile
    let clamp = (x, min, max) => Math.min(Math.max(x, min), max);
    let percentile = global.input.display.percentile;
    let percentileIndex = Math.floor(percentile/100.0*global.mctrials.length);
    percentileIndex = clamp(percentileIndex, 0, global.mctrials.length-1);
    let walk = global.mctrials[percentileIndex];

    let datasets = [];
    datasets.push({
        fill: false,
        label: 'S&P 500 (SPY)',
        data:  walk.map(a => a.stockPrice),
        yAxisID: 'price',
        borderColor: 'blue',
        backgroundColor: '#00004477',
        pointRadius: 0,
        lineTension: 0,
    });
    datasets.push({
        fill: false,
        label: 'Interest Rate',
        data:  walk.map(a => a.interestRate),
        yAxisID: 'rate',
        borderColor: '#9370DB',
        backgroundColor: '#9370DB77',
        pointRadius: 0,
        lineTension: 0,
    });
    datasets.push({
        fill: true,
        label: 'Asset Value',
        data:  walk.map(a => a.assetValue),
        yAxisID: 'dollars',
        borderColor: 'green',
        backgroundColor: '#00440077',
        pointRadius: 0,
        lineTension: 0,
    });

    const data_feed = {
        labels: walk.map(a => a.time),
        datasets: datasets
    }

    let startAge = global.input.agent.startAge;
    let startYear = parseInt(new Date().getFullYear());

    if (typeof global.chart === 'undefined') {

        let canvas = document.getElementById('graph-canvas-id');

        let float2dollar = function(value, index, values) {
            return "$"+parseFloat(value).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
            
        let options = {
            title: {
                display: false,
                text: 'Market',
                position: 'top'
            },
            tooltips: {
                callbacks: {
                    label: (tooltipItem, data) => {

                        let s = `${data.datasets[tooltipItem.datasetIndex].label} : `;
                        switch (tooltipItem.datasetIndex) {
                            case 0: return s + `${float2dollar(tooltipItem.value, null, null)}`;
                            case 1: return s + `${(100.*parseFloat(tooltipItem.value)).toFixed(2)}%`;
                            case 2: return s + `${float2dollar(tooltipItem.value, null, null)}`;
                        }

                        return s + `${tooltipItem.value}`;
                    }
                }
            },
            maintainAspectRatio: false,
            scales: {
                xAxes: [{
                    type: 'time',
                    time: {
                        unit: 'year'
                    },
                }],
                yAxes: [
                    {
                        id: 'dollars',
                        position: 'left',
                        ticks: {
                            beginAtZero: true,
                            callback: float2dollar
                        },
                    },
                    {
                        id: 'rate',
                        position: 'right',
                        ticks: {
                            beginAtZero: true,              
                            callback: (value, index, values) => 
                                (100.0*value).toFixed(2) + "%"
                        },
                        gridLines: {display: false}
                    },
                    {
                        id: 'price',
                        position: 'right',
                        ticks: {
                            beginAtZero: true,
                            callback: float2dollar
                        },
                        gridLines: {display: false}
                    }    
                ]
            },
            legend: {
                display: true,
                position: 'top'
            }
        };

        global.chart = new Chart(canvas, {
            type: 'line',
            data: data_feed,
            options: options,
        });
    }
    else {

        global.chart.data = data_feed;
        global.chart.update();
    }
}

function refreshTable() {

    // extract Monte Carlo simulation for requested %-tile
    let clamp = (x, min, max) => Math.min(Math.max(x, min), max);
    let percentile = global.input.display.percentile;
    let percentileIndex = Math.floor(percentile/100.0*global.mctrials.length);
    percentileIndex = clamp(percentileIndex, 0, global.mctrials.length-1);
    let walk = global.mctrials[percentileIndex];

    // define fields and their display settings
    let defaults;
    let withDefaults = (x) => Object.assign(x, defaults);

    defaults = {
        align: 'center', 
        headerSort: false
    };

    let fields = [];    
    fields.push(withDefaults({title: "Date", field: "date", width: 70}));
    fields.push(withDefaults({title: "Age", field: "age", width: 55}));

    let walkColumns = [];

    defaults = {
        align: 'right', 
        headerSort: false, 
        width: 110, 
        formatter: "money", 
        formatterParams: {symbol: "$"}
    }

    walkColumns.push(withDefaults({title: 'Asset Value', field: 'value'}));
    walkColumns.push(withDefaults({title: 'Cash', field: 'cash'}));
    walkColumns.push(withDefaults({title: 'Bonds', field: 'bonds'}));
    walkColumns.push(withDefaults({title: 'Stock', field: 'stock'}));
    walkColumns.push(withDefaults({title: 'Income', field: 'income'}));
    walkColumns.push(withDefaults({title: 'Expense', field: 'expense'}));

    defaults = {
        align: 'right',
        headerSort: false,
        width: 80,
        formatter: (cell, formatterParams) => (100.0*cell.getValue()).toFixed(2) + "%",
    }

    walkColumns.push(withDefaults({title: 'Interest', field: 'interest'}));

    fields.push({
        title: `${percentile}th percentile`,
        columns:walkColumns
    });

    fields.push({
        title: "Comments", 
        field: "comment", 
        align: 'left', 
        headerSort: false, 
        widthGrow: 1
    });

    // define row data from walk data
    var format = { year: 'numeric', month: '2-digit' };
    let lastPrintedAt = -1e5;

    let accruedIncome = 0.0;
    let accruedExpense = 0.0;

    let rows = [];
    for (let i = 0; i < walk.length; i++) {
    
        let relativeTime = (walk[i].time.getTime() - walk[0].time.getTime())
            /(1000*3600*24*365);

        accruedIncome += walk[i].income;
        accruedExpense += walk[i].expense;

        const printStep = global.input.display.printStep
        if (relativeTime - lastPrintedAt >= printStep) {

            let row = {id: rows.length, date: walk[i].time.toLocaleDateString("en-US", format)};
            row.age = Math.floor(global.input.agent.startAge + relativeTime);
            row[`cash`] = parseFloat(walk[i].cash);
            row[`bonds`] = parseFloat(walk[i].bondsValue);
            row[`stock`] = parseFloat(walk[i].stockValue);
            row[`value`] = parseFloat(walk[i].assetValue);
            row[`income`] = accruedIncome;
            row[`expense`] = accruedExpense;
            row[`interest`] = parseFloat(walk[i].interestRate);
            row[`inflation`] = parseFloat(walk[i].inflationRate);

            rows.push(row);            
            lastPrintedAt = relativeTime;

            accruedIncome = 0.0;
            accruedExpense = 0.0;
        }
    }

    // display table
    if (typeof global.table === 'undefined') {
        global.table = new Tabulator("#cashflow-table-id", {
            data: rows, 
            clipboard: true,
            layout:"fitColumns",
            columns:fields,
        });
    }
    else {
        global.table.setColumns(fields);
        global.table.replaceData(rows);
    }
}