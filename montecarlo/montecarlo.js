
"use strict";

function onPageLoad() {

    onResize();
    refreshSimulation();
}

function onResize() {

}

function refreshSimulation() {
   
    // collect 'trials' number of simulations
    let ntrials = Math.floor(document.getElementById("trials").value);
    let data = []
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

    // retain only 25th, 50th, and 75th percentile
    let samples = []
    samples.push(data[Math.floor(0.25*data.length)]);
    samples.push(data[Math.floor(0.50*data.length)]);
    samples.push(data[Math.floor(0.75*data.length)]);

    refreshGraph(samples);
    refreshTable(samples);
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

    let data = [];
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
            data.push(point);

            lastRecordedAt = time;
        }

        cash += income * step;
        cash += age > 67? socialsecurity*step : 0.0;
        cash += interest*bond_units*1000.0 * step;

        cash -= expenses * step;
        cash -= age < 65? healthcare*step : 0.0;
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
            borderColor: i == 0? 'red' : (i == 1? 'yellow' : 'green'),
            backgroundColor: i == 0? '#44000077' : (i == 1? '#44440077' : '#00440077'),
            pointRadius: 0,
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
function refreshTable(data) {

    let startAge = parseInt(document.getElementById("start-age").value);
    const printStep = parseFloat( document.getElementById("print-step").value)/365.0;

    let time_data = data[0].map(a => a.time);
    let value_data = data.map(trial => trial.map(b => b.value));
    let cash_data = data.map(trial => trial.map(b => b.cash));
    let bond_data = data.map(trial => trial.map(b => b.bond_value));
    let equity_data = data.map(trial => trial.map(b => b.equity_value));
    
    // define fields
    let fields = [];
    fields.push({title: "Date", field: "date", width: 80, align: 'center', headerSort: false});
    fields.push({title: "Age", field: "age", width: 65, align: 'center', headerSort: false});
    for (let trial = 0; trial < data.length; trial++) {

        if (trial == 1) continue;

        let percentile = Math.floor(100.0*(trial+1)/(data.length+1)).toString() + "th";
        fields.push({

            title: `${percentile} percentile`,
            columns:[{
                title:`Value`,
                field:`value${trial}`, 
                align:"right", 
                width: 120,
                // formatter:"money", 
                // formatterParams: {symbol: "$"},
                headerSort: false,
                formatter: function(cell, formatterParams) {

                    let color = trial == 0? '#990000' : (trial == 1? '#999900' : '#009900');
                    let money = parseFloat(cell.getValue()).toFixed(2);
                    return `<span style='color:${color};'>$` +  money + "</span>";
                }
            },
            {
                title:`Cash`,
                field:`cash${trial}`, 
                align:"right", 
                width: 120,
                formatter:"money", 
                formatterParams: {symbol: "$"},
                headerSort:false,
            },
            {
                title:`Bonds`,
                field:`bonds${trial}`, 
                align:"right", 
                width: 120,
                formatter:"money", 
                formatterParams: {symbol: "$"},
                headerSort:false
            },
            {
                title:`Equity`,
                field:`equity${trial}`, 
                align:"right", 
                width: 120,
                formatter:"money", 
                formatterParams: {symbol: "$"},
                headerSort:false
            }]
        });
    }
    fields.push({title: "Comments", field: "comment", align: 'left'});

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

            for (let trial = 0; trial < data.length; trial++) {
                if (trial == 1) continue;
                
                row[`cash${trial}`] = parseFloat(cash_data[trial][i]);
                row[`bonds${trial}`] = parseFloat(bond_data[trial][i]);
                row[`equity${trial}`] = parseFloat(equity_data[trial][i]);
                row[`value${trial}`] = parseFloat(value_data[trial][i]);
            }

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