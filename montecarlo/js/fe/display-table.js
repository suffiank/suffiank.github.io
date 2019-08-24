"use strict";
var global = {};

global.expandComments = true;

function getCommentHtml(lines, expand) {

    let display = expand? 'inline' : 'none';
    let comment = 
    `<div>`
        + lines.slice(0, 1) + 
    "</div>" +
    `<div style="display: ${display};">`
        + lines.slice(1).join("<br>") + 
    "</div>";

    return comment;
}

function setCommentExpansion(index, expand) {

    let row = global.table.getRow(index);

    // retrieve comment from table, stripping HTML
    let lines = row.getData().comment
        .split(/<[\/]*div[^>]*>/g)
        .filter(line => line.length > 0);

    global.table.updateData([{
        id: index, 
        expander: lines.length > 1? (expand? "-" : "+") : "",
        comment: getCommentHtml(lines, expand)
    }]);

    row.normalizeHeight();
}

function toggleCellComment(cell) {

    let index = cell.getRow().getPosition();
    let expand = cell.getRow().getData().expander == '+';
    setCommentExpansion(index, expand);
}

function toggleComments() {

    let table = global.table;
    let header = document.getElementById("expander-id");
    let expand = header.innerHTML == "+";
    header.innerHTML = expand? "-" : "+";

    let nrows = global.table.getDataCount();
    for (let index = 0; index < nrows; index++)
        setCommentExpansion(index, expand);
}

function getColumns(percentile) {

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

    addColumn(agentColumns, defaults, {title: 'Assets', field: 'assetValue'});
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
        formatter: (cell, formatterParams) => asRate(cell.getValue()),
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
                cellClick: (e, cell) => toggleCellComment(cell),
                headerClick: (e, column) => toggleComments()
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

    return fields;
}

function getRows(percentile) {

    let percentileIndex = clamp( 
        Math.floor(percentile/100.0*global.mctrials.length), 
        0, global.mctrials.length-1);

    let walk = global.mctrials[percentileIndex];
    let startedAt = walk.length > 0? walk[0].time.getTime() : new Date().getTime();

    var format = { year: 'numeric', month: '2-digit', day: '2-digit' };
    let lastPrintedAt = -1e5;

    let accrued = {};
    let comment = "";

    let rows = [];
    for (let t = 0; t < walk.length; t++) {
    
        // fraction of years from start of simulation
        let relativeTime = 
            (walk[t].time.getTime() - startedAt)*global.msToYears;

        // some numeric values need to accrued for printing
        for (let p in walk[t].accrued) {

            if (!accrued.hasOwnProperty(p)) 
                accrued[p] = 0.0;

            accrued[p] += parseFloat(walk[t].accrued[p]);
        }
        comment += walk[t].comment;

        // sample row data when reached print step
        const printStep = global.input.display.printStep
        if (relativeTime - lastPrintedAt >= printStep || t == walk.length-1) {

            const dateFormat = {year: 'numeric', month: '2-digit', day: '2-digit'};
            let date = walk[t].time.toLocaleDateString("en-US", dateFormat);

            let row = {id: rows.length, date: date};
            row.age = Math.floor(global.input.agent.startAge + relativeTime);
            
            for (let property in walk[t]) {
                switch (property) {

                    case 'cash':
                    case 'bondsValue':
                    case 'stockValue':
                    case 'assetValue':
                    case 'interest':
                    case 'spyPrice':
                    case 'inflation':
                        row[property] = parseFloat(walk[t][property]);
                        break;

                    case 'accrued':
                        for (let p in walk[t].accrued)
                            row[p] = accrued[p];
                        break;

                    case 'comment':
                        let lines = comment.trim().split('\n');
                        row.comment = getCommentHtml(lines, true);
                        row.expander = lines.length > 1? "-":"";
                        break;

                    default:
                        row[property] = walk[t][property];
                        break;
                }
            }

            rows.push(row);
            lastPrintedAt = relativeTime;

            accrued = {};
            comment = "";
        }
    }

    return rows;
}

function refreshTable() {

    // retrieve Monte Carlo simulation at requested percentile
    let percentile = global.input.display.percentile;
    let fields = getColumns(percentile);
    let rows = getRows(percentile);

    // display table
    if (typeof global.table === 'undefined') {

        global.table = new Tabulator("#cashflow-table-id", {
            columns:fields,
            data: rows, 
            layout:"fitDataFill",
            clipboard: true,
            virtualDomBuffer: 1000
        });
        global.table.replaceData(rows);
    }
    else {

        global.table.setColumns(fields);
        global.table.replaceData(rows);
    }
}