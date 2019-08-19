
"use strict";

function onPageLoad() {

    refreshSimulation();

    refreshGraph();
    refreshTable();
}

function onPercentileChange() {

    refreshGraph();
    refreshTable();
}

var data;
function refreshSimulation() {
   
    // collect 'trials' number of simulations
    let ntrials = Math.floor(document.getElementById("trials").value);
    data = []
    for (let i = 0; i < ntrials; i++) {
        data.push(simulateRandomWalk());
    }

    // sort trials by survival and time-average fair value
    // warning: assumes all time steps are equal
    data = data.sort(
        (s,t) => {

            let savg = s.reduce((p,q) => p + q.value, 0)/s.length;
            let tavg = t.reduce((p,q) => p + q.value, 0)/t.length;

            let sfinal = s[s.length-1].value;
            let tfinal = t[t.length-1].value;

            if (sfinal <= 0.0) return -1;
            if (tfinal <= 0.0) return 1;
            return savg < tavg? -1 : 1;
    });
}

function simulateRandomWalk() {

    // pull input parameters from page
    let age0 = parseInt(document.getElementById("start-age").value);
    let age1 = age0 + (parseInt(document.getElementById("end-year").value)-2019);
    let cash = parseFloat(document.getElementById("start-cash").value);

    let income = parseFloat(document.getElementById("income").value);
    let expenses = parseFloat(document.getElementById("expenditure").value);
    let healthcare = parseFloat(document.getElementById("healthcare").value);
    let socialsecurity = parseFloat(document.getElementById("social-security").value);

    let bond_units = parseFloat(document.getElementById("bond-units").value);
    let interest = parseFloat(document.getElementById("interest-rate").value);

    const simulation_step = parseFloat( document.getElementById("mc-step").value)/365.0;
    const recording_step =  (age1-age0)/50.0 * 10.0/365.0;

    // all units per annum
    let step = simulation_step;
    let nyears = age1-age0;
    let nsteps = Math.floor(nyears/step);

    let spdr_stddev = parseFloat(document.getElementById("spdr-sigma").value);
    let spdr_return = parseFloat(document.getElementById("spdr-return").value);
    let spdr_price = parseFloat(document.getElementById("spdr-price").value);;
    let spdr_units = parseInt(document.getElementById("spdr-units").value);

    let today = new Date().getTime();
    let lastRecordedAt = -1e5;
    let dead = false;

    let series = [];
    for (let i = 0; i < nsteps; i++) {

        let spdr_delta = spdr_stddev * Math.sqrt(step);
        spdr_delta *= (Math.random() < 0.5? -1.0 : 1.0);
        spdr_price *= 1.0 + step*spdr_return + spdr_delta;
        if (spdr_price < 0.0) spdr_price = 0.0;

        let time = i*step;
        let age = age0 + time;

        if (time - lastRecordedAt > recording_step) {

            var point = {
                time: new Date(today + 365*24*3600*1000*time),
                cash: cash,
                equity_value: spdr_units*spdr_price.toFixed(0),
                bond_value: bond_units*1000.0, // inaccurate
            }
            point.value = point.cash + point.equity_value + point.bond_value;
            if (point.value <= 0.0) dead = true;
            if (dead) point.value = 0.0;
            series.push(point);

            lastRecordedAt = time;
        }

        cash += income * step;
        cash += age > 67? socialsecurity*step : 0.0;
        cash += interest*bond_units*1000.0 * step;

        cash -= expenses * step;
        cash -= age < 65? healthcare*step : 0.0;
    }

    return series;
}

var chart;
function refreshGraph() {

    let percentile = parseInt(document.getElementById("percentile-bar").value);
    let percentileIndex = percentile/100.0 * data.length;

    let time_data = data[percentileIndex].map(a => a.time);
    let value_data = data[percentileIndex].map(a => a.value);
    let cash_data = data[percentileIndex].map(a => a.cash);
    let bond_data = data[percentileIndex].map(a => a.bond_value);
    let equity_data = data[percentileIndex].map(a => a.equity_value);

    let datasets = [];
    datasets.push({
        fill: true,
        label: 'Market Value',
        data: value_data,
        borderColor: 'green',
        backgroundColor: '#00440077',
        pointRadius: 0,
        lineTension: 0,
    });

    const data_feed = {
        labels: time_data,
        datasets: datasets
    }

    if (typeof chart === 'undefined') {

        let canvas = document.getElementById('graph-canvas-id');
        chart = new Chart(canvas, {
            type: 'line',
            data: data_feed,
            options: {
                title: {
                    display: true,
                    text: 'Market Value',
                    position: 'top'
                },
                maintainAspectRatio: false,
                scales: {
                    xAxes: [{
                        type: 'time',
                        time: {
                            unit: 'year'
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                            callback: (value, index, values) =>
                                "$"+(value).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                        }
                    }]
                },
                legend: {
                    display: false
                }
            }
        });
    }
    else {
        chart.data = data_feed;
        chart.update();
    }
}

var table;
function refreshTable() {

    let startAge = parseInt(document.getElementById("start-age").value);
    const printStep = parseFloat( document.getElementById("print-step").value)/365.0;

    let percentile = parseInt(document.getElementById("percentile-bar").value);
    let percentileIndex = percentile/100.0 * data.length;

    let time_data = data[percentileIndex].map(a => a.time);
    let value_data = data[percentileIndex].map(a => a.value);
    let cash_data = data[percentileIndex].map(a => a.cash);
    let bond_data = data[percentileIndex].map(a => a.bond_value);
    let equity_data = data[percentileIndex].map(a => a.equity_value);
    
    // define fields
    let fields = [];
    fields.push({title: "Date", field: "date", width: 75, align: 'center', headerSort: false});
    fields.push({title: "Age", field: "age", width: 60, align: 'center', headerSort: false});
    fields.push({

        title: `${percentile}th percentile`,
        columns:[{
            title:`Value`,
            field:`value`, 
            align:"right", 
            width: 120,
            formatter:"money", 
            formatterParams: {symbol: "$"},
            headerSort: false,
        },
        {
            title:`Cash`,
            field:`cash`, 
            align:"right", 
            width: 120,
            formatter:"money", 
            formatterParams: {symbol: "$"},
            headerSort:false,
        },
        {
            title:`Bonds`,
            field:`bonds`, 
            align:"right", 
            width: 120,
            formatter:"money", 
            formatterParams: {symbol: "$"},
            headerSort:false
        },
        {
            title:`Equity`,
            field:`equity`, 
            align:"right", 
            width: 120,
            formatter:"money", 
            formatterParams: {symbol: "$"},
            headerSort:false
        }]
    });
    fields.push({title: "Comments", field: "comment", align: 'left', headerSort: false, widthGrow: 1});

    // define row data
    var format = { year: 'numeric', month: '2-digit' };
    let lastPrintedAt = -1e5;

    let rows = [];
    for (let i = 0; i < time_data.length; i++) {
    
        let relativeTime = (time_data[i].getTime() - time_data[0].getTime())
            /(1000*3600*24*365);

        if (relativeTime - lastPrintedAt > printStep) {

            let row = {id: rows.length, date: time_data[i].toLocaleDateString("en-US", format)};
            row.age = Math.floor(startAge + relativeTime);
            row[`cash`] = parseFloat(cash_data[i]);
            row[`bonds`] = parseFloat(bond_data[i]);
            row[`equity`] = parseFloat(equity_data[i]);
            row[`value`] = parseFloat(value_data[i]);

            rows.push(row);
            lastPrintedAt = relativeTime;
        }
    }

    // display table
    if (typeof table === 'undefined') {
        table = new Tabulator("#cashflow-table-id", {
            data: rows, 
            clipboard: true,
            layout:"fitColumns",
            columns:fields,
        });
    }
    else {
        table.setColumns(fields);
        table.replaceData(rows);
    }
}