
"use strict";

function onPageLoad() {

    refreshSimulation();
}

function refreshSimulation() {
   
    let ntrials = document.getElementById("trials").value;

    let data = []
    for (let i = 0; i < ntrials; i++) {
        data.push(simulateRandomWalk());
    }

    refreshGraph(data);
    refreshTable(data);
}

function simulateRandomWalk() {

    // pull input parameters from page
    let age0 = document.getElementById("start-age").value;
    let age1 = document.getElementById("end-age").value;
    let initial_cash = document.getElementById("start-cash").value;

    const simulation_step = 1.0/365.0;
    const recording_step = 1.0/4.0;

    // all units per annum
    let step = simulation_step;
    let nyears = age1-age0;
    let nsteps = Math.floor(nyears/step);

    let spdr_stddev = 0.20;
    let spdr_return = 0.05;
    let spdr_price = 289.0;
    let spdr_units = Math.floor(initial_cash/spdr_price);

    let today = new Date().getTime();
    let lastRecordedAt = -1e5;

    let data = [];
    for (let i = 0; i < nsteps; i++) {

        let spdr_delta = spdr_stddev * Math.sqrt(step);
        spdr_delta *= (Math.random() < 0.5? -1.0 : 1.0);
        spdr_price *= 1.0 + step*spdr_return + spdr_delta;
        if (spdr_price < 0.0) spdr_price = 0.0;

        let time = i*step;
        if (time - lastRecordedAt > recording_step) {

            var point = {
                time: new Date(today + 365*24*3600*1000*time),
                value: spdr_units*spdr_price.toFixed(0)
            }
            data.push(point);

            lastRecordedAt = time;
        }
    }

    return data;
}

var chart;
function refreshGraph(data) {

    let time_data = data[0].map(a => a.time);
    let value_data = data.map(trial => trial.map(b => b.value));

    let datasets = [];
    for (let i = 0; i < data.length; i++) {
        datasets.push({
            fill: true,
            label: 'Market Value',
            data: value_data[i],
            borderColor: 'green',
            backgroundColor: '#00440077',
            lineTension: 0,
        });
    }

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
                            callback: function(value, index, values) {
                                return "$"+(value).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                            }
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
function refreshTable(data) {

    let time_data = data[0].map(a => a.time);
    let value_data = data.map(trial => trial.map(b => b.value));

    // define fields
    let fields = [{title: "Year", field: "year"}];
    for (let trial = 0; trial < data.length; trial++) {

        fields.push({
            title:`Value (Trial #${trial+1})`, 
            field:`value${trial}`, 
            align:"right", 
            formatter:"money", 
            formatterParams: {symbol: "$"}
        });
    }

    // define row data
    let rows = [];
    for (let time = 0; time < time_data.length; time++) {
        let row = {id: time, year: time_data[time].toLocaleDateString("en-US")};
        for (let trial = 0; trial < data.length; trial++) {
            row[`value${trial}`] = parseFloat(value_data[trial][time]);
        }
        rows.push(row);
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