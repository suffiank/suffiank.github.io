
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
    input.agent.minCash = getInput("min-cash", "money");
    input.agent.maxCash = getInput("max-cash", "money");

    input.agent.income = getInput("income", "money");
    input.agent.expenses = getInput("expenditure", "money");
    input.agent.healthcare = getInput("healthcare", "money");
    input.agent.socialsecurity = getInput("social-security", "money");

    // starting market conditions
    input.market = {};
    input.market.securities = {};

    input.market.securities['SPY'] = {};
    input.market.securities['SPY'].class = "stock";
    input.market.securities['SPY'].price = getInput("spy-price", "money");
    input.market.securities['SPY'].return = getInput("spy-return");    
    input.market.securities['SPY'].sigma = getInput("spy-sigma");
    input.market.securities['SPY'].dividend = 1.43;
    input.market.securities['SPY'].frequency = 4;

    input.market.securities['UST'] = {};
    input.market.securities['UST'].class = "bond";
    input.market.securities['UST'].faceValue = 1000.00;
    input.market.securities['UST'].coupon = getInput("bond-coupon", "money");
    input.market.securities['UST'].frequency = getInput("bond-frequency", "int");
    input.market.securities['UST'].duration = getInput("bond-duration");
    input.market.securities['UST'].moodys = "Aaa";

    input.market.inflation = getInput("inflation-rate");
    input.market.inflationSigma = getInput("inflation-sigma");

    input.market.interest = getInput("interest-rate");
    input.market.interestSigma = getInput("interest-sigma");
    input.market.vasicekSpeed = getInput("vasicek-speed");
    input.market.vasicekRate = getInput("vasicek-rate");

    input.market.vasicek = {}
    input.market.vasicek.a = input.market.vasicekSpeed;
    input.market.vasicek.b = input.market.vasicekRate;

    // starting agent portfolio 

    input.agent.portfolio = [];
    input.agent.strategy = "cash-balance";
    input.agent.stockToBonds = getInput("stock-to-bonds");

    let today = new Date().getTime();
    let startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
    let yearsToMs = 1000*3600*24*365;
    let msToYears = 1.0/yearsToMs;

    let assetStockMarket = {
        symbol: 'SPY', 
        units: getInput("spy-units", "int"), 
        purchased: today,
        beginPaymentsOn: startOfYear,        
        costBasis: getInput("spy-price", "money"),
    }
    let f = input.market.securities['SPY'].frequency;
    let n = Math.floor( (today - startOfYear)*msToYears*f );
    assetStockMarket.lastPaymentOn = startOfYear + yearsToMs*n/f;
    input.agent.portfolio.push(assetStockMarket);

    let assetFixedIncome = {
        symbol: 'UST', 
        units: getInput("bond-units", "int"), 
        purchased: today,
        beginPaymentsOn: startOfYear,
        costBasis: 1000.0,
    }
    f = input.market.securities['UST'].frequency;
    n = Math.floor( (today - startOfYear)*msToYears*f );
    assetFixedIncome.lastPaymentOn = startOfYear + yearsToMs*n/f;
    input.agent.portfolio.push(assetFixedIncome);

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
        data:  walk.map(a => a.spyPrice),
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
                            callback: float2dollar,
                            min: 0.0
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
    fields.push(withDefaults({title: "Date", field: "date"}));
    fields.push(withDefaults({title: "Age", field: "age"}));

    let agentColumns = [];
    let marketColumns = [];

    defaults = {
        align: 'right', 
        headerSort: false, 
        formatter: "money", 
        formatterParams: {symbol: "$"}
    }

    agentColumns.push(withDefaults({title: 'Assets', field: 'value'}));
    agentColumns.push(withDefaults({title: 'Cash', field: 'cash'}));
    agentColumns.push(withDefaults({title: 'Bonds', field: 'bondsValue'}));
    agentColumns.push(withDefaults({title: 'Stock', field: 'stockValue'}));
    agentColumns.push(withDefaults({title: 'Income', field: 'income'}));;
    agentColumns.push(withDefaults({title: 'Expense', field: 'expense'}));

    defaults.width = 90;
    agentColumns.push(withDefaults({title: 'Coupons', field: 'coupons'}));
    agentColumns.push(withDefaults({title: 'Dividends', field: 'dividends'}))
    agentColumns.push(withDefaults({title: 'Matured', field: 'matured'}));
    agentColumns.push(withDefaults({title: 'Buy/Sell', field: 'transactions'}))
    marketColumns.push(withDefaults({title: 'S&P 500', field: 'spyPrice'}));

    defaults = {
        align: 'right',
        headerSort: false,
        formatter: (cell, formatterParams) => (100.0*cell.getValue()).toFixed(2) + "%",
    }

    marketColumns.push(withDefaults({title: 'Interest', field: 'interest'}));

    fields.push({
        title: `Agent at ${percentile}th percentile`,
        columns: agentColumns
    });
    fields.push({
        title: `Market Conditions`,
        columns: marketColumns
    });

    fields.push({
        title: "",
        columns: [
            {
                title: '<div id = "expander-id">-</div>',
                field: 'expander',
                headerSort: false,
                width: 22,
                minWidth: 22,
                align: 'center',
                formatter: 'html',
                cellClick: (e, cell) => {
                    let index = cell.getRow().getPosition();
                    let extraText = document.getElementById(`comment${index}-body`);
                    if (cell.getValue() == "") return;
                    if (extraText.style.display != "none") {
                        extraText.style.display = "none";
                        cell.setValue("+");
                    }
                    else {
                        extraText.style.display = "inline";
                        cell.setValue("-");
                    }
                    cell.getRow().normalizeHeight();
                },
                headerClick: (e, column) => {

                    let header = document.getElementById("expander-id");
                    let expand = header.innerHTML == "+";
                    header.innerHTML = expand? "-" : "+";

                    let cells = column.getCells();
                    for (let index = 0; index < cells.length; index++) {

                        let expandableText = document.getElementById(`comment${index}-body`);
                        let cell = cells[index];

                        // why this happens?
                        if (!cell || cell == null) continue;
                        if (cell.getValue() == "") continue;

                        expandableText.style.display = expand? "inline" : "none";
                        cell.setValue(expand? "-" : "+");
                        cell.getRow().normalizeHeight();
                    }
                }
            },
            {
                title: "Comments", 
                field: "comment", 
                align: 'left', 
                formatter:"html",
                headerSort: false, 
                widthGrow: 1
            },
        ]
    });

    // define row data from walk data
    var format = { year: 'numeric', month: '2-digit', day: '2-digit' };
    let lastPrintedAt = -1e5;

    let accrued = {
        income: 0.0,
        expense: 0.0,
        coupons: 0.0,
        matured: 0.0,
        dividends: 0.0,
        transactions: 0.0,
    };
    let comment = "";

    let rows = [];
    for (let i = 0; i < walk.length; i++) {
    
        let relativeTime = (walk[i].time.getTime() - walk[0].time.getTime())
            /(1000*3600*24*365);

        accrued.income += walk[i].income;
        accrued.expense += walk[i].expense;
        accrued.dividends += walk[i].dividends;
        accrued.coupons += walk[i].coupons;
        accrued.matured += walk[i].matured;
        accrued.transactions += walk[i].transactions;
        comment += walk[i].comment;

        const printStep = global.input.display.printStep
        if (relativeTime - lastPrintedAt >= printStep || i == walk.length-1) {

            let row = {id: rows.length, date: walk[i].time.toLocaleDateString("en-US", format)};
            row.age = Math.floor(global.input.agent.startAge + relativeTime);
            row[`cash`] = parseFloat(walk[i].cash);
            row[`bondsValue`] = parseFloat(walk[i].bondsValue);
            row[`stockValue`] = parseFloat(walk[i].stockValue);
            row[`value`] = parseFloat(walk[i].assetValue);
            row[`income`] = accrued.income;
            row[`expense`] = accrued.expense;
            row[`dividends`] = accrued.dividends;
            row[`coupons`] = accrued.coupons;
            row[`matured`] = accrued.matured;
            row[`transactions`] = accrued.transactions;
            row[`interest`] = parseFloat(walk[i].interestRate);
            row[`spyPrice`] = parseFloat(walk[i].spyPrice);
            row[`inflation`] = parseFloat(walk[i].inflationRate);

            let lines = comment.split('<br>');
            row[`comment`] = `<div id="comment${rows.length}-head">` +
                lines.slice(0, 1) + "</div>" +
                `<div id="comment${rows.length}-body">` + 
                lines.slice(1).join("<br>") + "</div>";
            row["expander"] = lines.length > 2? "-":"";

            rows.push(row);            
            lastPrintedAt = relativeTime;

            for (let property in accrued) {
                accrued[property] = 0.0;
            }
            comment = "";
        }
    }

    // display table
    if (typeof global.table === 'undefined') {
        global.table = new Tabulator("#cashflow-table-id", {
            data: rows, 
            clipboard: true,
            layout:"fitData",
            columns:fields
        });
        global.table.replaceData(rows);
    }
    else {
        global.table.setColumns(fields);
        global.table.replaceData(rows);
    }
}