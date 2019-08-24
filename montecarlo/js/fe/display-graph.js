"use strict";
var global = {};

function clamp(x, min, max) {
    return Math.min(Math.max(x, min), max);
} 

function asDollars(value) {
    return "$"+parseFloat(value).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function refreshGraph() {

    // retrieve Monte Carlo simulation at requested percentile
    let percentile = global.input.display.percentile;
    let percentileIndex = clamp( 
        Math.floor(percentile/100.0*global.mctrials.length), 
        0, global.mctrials.length-1);
    let walk = global.mctrials[percentileIndex];

    // define data feed and its presentation
    let datafeed = {

        labels: walk.map(a => a.time),
        datasets: 
        [
            {
                label: 'S&P 500 (SPY)',
                data:  walk.map(a => a.spyPrice),
                yAxisID: 'price',
                borderColor: 'blue',
                backgroundColor: '#00004477',
                pointRadius: 0,
                lineTension: 0,
                fill: false,
            },
            {
                label: 'Interest Rate',
                data:  walk.map(a => a.interestRate),
                yAxisID: 'rate',
                borderColor: '#9370DB',
                backgroundColor: '#9370DB77',
                pointRadius: 0,
                lineTension: 0,
                fill: false,
            },
            {
                label: 'Asset Value',
                data:  walk.map(a => a.assetValue),
                yAxisID: 'dollars',
                borderColor: 'green',
                backgroundColor: '#00440077',
                pointRadius: 0,
                lineTension: 0,
                fill: true,
            }
        ]
    }

    // refine graph display options
    let options = {
        maintainAspectRatio: false,
        title: {
            display: false,
            text: 'Market',
            position: 'top'
        },
        legend: {
            display: true,
            position: 'top'
        },
        tooltips: {
            callbacks: {
                label: (tooltipItem, data) => {

                    let s = `${data.datasets[tooltipItem.datasetIndex].label} : `;
                    switch (tooltipItem.datasetIndex) {
                        case 0: return s + `${asDollars(tooltipItem.value)}`;
                        case 1: return s + `${(100.*parseFloat(tooltipItem.value)).toFixed(2)}%`;
                        case 2: return s + `${asDollars(tooltipItem.value)}`;
                    }

                    return s + `${tooltipItem.value}`;
                }
            }
        },
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
                        callback: (value, index, values) => asDollars(value),
                        min: 0.0
                    },
                },
                {
                    id: 'rate',
                    position: 'right',
                    ticks: {
                        beginAtZero: true,              
                        callback: (value, index, values) => (100.0*value).toFixed(2) + "%"
                    },
                    gridLines: {display: false}
                },
                {
                    id: 'price',
                    position: 'right',
                    ticks: {
                        beginAtZero: true,
                        callback: (value, index, values) => asDollars(value)
                    },
                    gridLines: {display: false}
                }    
            ]
        },
    };

    // create or update the graph itself
    if (typeof global.chart === 'undefined') {

        let canvas = document.getElementById('graph-canvas-id');
        global.chart = new Chart(canvas, {
            type: 'line',
            data: datafeed,
            options: options,
        });
    }
    else {

        global.chart.data = datafeed;
        global.chart.update();
    }
}
