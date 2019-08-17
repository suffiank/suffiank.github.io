
function float2dollar(value) {
    return "$"+(value).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");;
}

let age0 = 55.0;
let age1 = 90.0;

let T = age1-age0;
let dT = 1.0/365.0;

let nsteps = Math.floor(T/dT);
let trials = 1;

// Warning! Do not include PII
let stock_stddev = 0.20;
let stock_return = 0.05;
let stock_price = 10000.0;

let today = new Date().getTime();

let time_data = [];
let price_data = [];
let dead = false; 

for (let i = 0; i < nsteps; i++) {

    let delta = stock_stddev * Math.sqrt(dT);
    delta *= ( Math.random() < 0.5? -1.0 : 1.0 );

    let step_return = 1.0 + stock_return*dT + delta;
    stock_price *= step_return;

    if (stock_price < 0.0) dead = true;
    stock_price = Math.max(stock_price, 0.0);
    if (dead) stock_price = 0.0;

    if (i % 91 == 0) {
        time_data.push(new Date(today + 365*24*3600*1000*i*dT));
        price_data.push(stock_price.toFixed(0));
    }
}

var canvas = document.getElementById('graph-canvas-id');

const data = {

    labels: time_data,
    datasets: [{
        fill: true,
        label: 'Market Value',
        data: price_data,
        borderColor: 'green',
        backgroundColor: '#00440077',
        lineTension: 0,
    }]
}

var myChart = new Chart(canvas, {
    type: 'line',
    data: data,
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
                        return float2dollar(value);
                    }
                }
            }]
        },
        legend: {
            display: false
        }
    }
});

var tabledata = [];
for (let i = 0; i < time_data.length; i++) {
    tabledata.push({id: i, year: time_data[i].toLocaleDateString("en-US"), value: parseFloat(price_data[i])});
}

var table = new Tabulator("#cashflow-table-id", {
    data: tabledata, 
    clipboard: true,
    selectable: true,
    layout:"fitColumns",
    columns:[
        {title:"Year", field:"year"},
        {title:"Fair Value", field:"value", align:"right", formatter:"money", formatterParams: {symbol: "$"}}
    ],
});