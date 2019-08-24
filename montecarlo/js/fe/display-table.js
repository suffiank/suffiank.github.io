"use strict";
var global = {};

function refreshTable() {

    // retrieve Monte Carlo simulation at requested percentile
    let percentile = global.input.display.percentile;
    let percentileIndex = clamp( 
        Math.floor(percentile/100.0*global.mctrials.length), 
        0, global.mctrials.length-1);
    let walk = global.mctrials[percentileIndex];

    // define fields and their display settings
    let addColumn = (columnListing, defaults, column) => 
        columnListing.push(Object.assign({}, defaults, column));

    let defaults = {
        align: 'center', 
        headerSort: false
    };

    let fields = [];
    addColumn(fields, {title: "Date", field: "date"}, defaults);
    addColumn(fields, {title: "Age", field: "age"}, defaults);

    let agentColumns = [];
    let marketColumns = [];

    defaults = {
        align: 'right', 
        headerSort: false, 
        formatter: "money", 
        formatterParams: {symbol: "$"}
    }

    addColumn(agentColumns, defaults, {title: 'Assets', field: 'value'});
    addColumn(agentColumns, defaults, {title: 'Cash', field: 'cash'});
    addColumn(agentColumns, defaults, {title: 'Bonds', field: 'bondsValue'});
    addColumn(agentColumns, defaults, {title: 'Stocks', field: 'stockValue'});
    addColumn(agentColumns, defaults, {title: 'Income', field: 'income'});
    addColumn(agentColumns, defaults, {title: 'Expense', field: 'expense'});

    defaults.width = 90;
    addColumn(agentColumns, defaults, {title: 'Coupons', field: 'coupons'})
    addColumn(agentColumns, defaults, {title: 'Dividends', field: 'dividends'});
    addColumn(agentColumns, defaults, {title: 'Matured', field: 'matured'});
    addColumn(agentColumns, defaults, {title: 'Buy/Sell', field: 'transactions'});
    addColumn(marketColumns, defaults, {title: 'S&P 500', field: 'spyPrice'});

    defaults = {
        align: 'right',
        headerSort: false,
        formatter: (cell, formatterParams) => 
            (100.0*cell.getValue()).toFixed(2) + "%",
    }

    addColumn(marketColumns, defaults, {title: 'Interest', field: 'interest'});

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
                title: '<div id="expander-id" style="cursor: pointer;">-</div>',
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

                        // bug: some cells not added to DOM due to lazy evaluation .. 
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
            layout:"fitDataFill",
            columns:fields,
            virtualDomBuffer: 1000
        });
        global.table.replaceData(rows);
    }
    else {
        global.table.setColumns(fields);
        global.table.replaceData(rows);
    }
}