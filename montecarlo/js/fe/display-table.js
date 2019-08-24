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
    let header = document.getElementById("comment-expander-id");
    let expand = header.innerHTML == "+";
    header.innerHTML = expand? "-" : "+";

    let nrows = global.table.getDataCount();
    for (let index = 0; index < nrows; index++)
        setCommentExpansion(index, expand);
}

function toggleCashFlows() {

    global.table.getColumn('earned').toggle();
    global.table.getColumn('spent').toggle();
    global.table.getColumn('coupons').toggle();
    global.table.getColumn('dividends').toggle();
    global.table.getColumn('matured').toggle();
    global.table.getColumn('invested').toggle();
    global.table.getColumn('liquidated').toggle();
    global.table.getColumn('taxes').toggle();

    let header = document.getElementById("cashflow-expander-id");
    let expand = header.innerHTML.indexOf('+') >= 0;
    header.innerHTML = 
        header.innerHTML.replace(expand? '+':'-', expand? '-':'+');
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

    let valueColumns = [];
    let cashflowColumns = [];
    let marketColumns = [];

    defaults = {
        align: 'right', 
        headerSort: false, 
        formatter: "money", 
        formatterParams: {symbol: "$"}
    }

    addColumn(valueColumns, defaults, {title: 'Assets', field: 'assetValue'});
    addColumn(valueColumns, defaults, {title: 'Cash', field: 'cash'});
    addColumn(valueColumns, defaults, {title: 'Bonds', field: 'bondsValue'});
    addColumn(valueColumns, defaults, {title: 'Stocks', field: 'stockValue'});
    addColumn(cashflowColumns, defaults, {title: 'Income', field: 'income'});
    addColumn(cashflowColumns, defaults, {title: 'Expense', field: 'expense'});

    defaults.minWidth = 60;
    defaults.visible = false;
    addColumn(cashflowColumns, defaults, {title: 'Earned', field: 'earned'})
    addColumn(cashflowColumns, defaults, {title: 'Spent', field: 'spent'})
    addColumn(cashflowColumns, defaults, {title: 'Coupons', field: 'coupons'})
    addColumn(cashflowColumns, defaults, {title: 'Dividends', field: 'dividends'});
    addColumn(cashflowColumns, defaults, {title: 'Matured', field: 'matured'});
    addColumn(cashflowColumns, defaults, {title: 'Liquidated', field: 'liquidated'});
    addColumn(cashflowColumns, defaults, {title: 'Invested', field: 'invested'});
    addColumn(cashflowColumns, defaults, {title: 'Taxes', field: 'taxes'});

    defaults.visible = true;
    addColumn(marketColumns, defaults, {title: 'S&P 500', field: 'spyPrice'});

    defaults = {
        align: 'right',
        headerSort: false,
        formatter: (cell, formatterParams) => asRate(cell.getValue()),
    }

    addColumn(marketColumns, defaults, {title: 'Interest', field: 'interest'});

    fields.push({
        title: `Agent Valuation at ${percentile}th percentile`,
        columns: valueColumns
    });

    fields.push({
        title: `<div id="cashflow-expander-id" style="cursor: pointer;">+ Agent Cash Flows</div>`,
        columns: cashflowColumns,
        headerClick: (e, column) => toggleCashFlows(),
    });

    fields.push({
        title: `Market Conditions`,
        columns: marketColumns
    });

    fields.push({
        title: "",
        columns: [
            {
                title: '<div id="comment-expander-id" style="cursor: pointer;">-</div>',
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

    let mcwalk = global.mctrials[percentileIndex];
    let startedAt = mcwalk.length > 0? mcwalk[0].time.getTime() : new Date().getTime();
    let lastPrintedAt = -1e5;

    let accrued = {};
    let comment = "";

    let rows = [];
    for (let t = 0; t < mcwalk.length; t++) {
    
        // fraction of years from start of simulation
        let relativeTime = 
            (mcwalk[t].time.getTime() - startedAt)*global.msToYears;

        // some numeric values need to accrued for printing
        for (let p in mcwalk[t].accrued) {

            if (!accrued.hasOwnProperty(p)) 
                accrued[p] = 0.0;

            accrued[p] += parseFloat(mcwalk[t].accrued[p]);
        }
        comment += mcwalk[t].comment;

        // sample row data when reached print step
        const printStep = global.input.display.printStep
        if (relativeTime - lastPrintedAt >= printStep || t == mcwalk.length-1) {

            const dateFormat = {year: 'numeric', month: '2-digit', day: '2-digit'};
            let date = mcwalk[t].time.toLocaleDateString("en-US", dateFormat);

            let row = {id: rows.length, date: date};
            row.age = Math.floor(global.input.agent.startAge + relativeTime);
            
            for (let property in mcwalk[t]) {
                switch (property) {

                    case 'cash':
                    case 'bondsValue':
                    case 'stockValue':
                    case 'assetValue':
                    case 'interest':
                    case 'spyPrice':
                    case 'inflation':
                        row[property] = parseFloat(mcwalk[t][property]);
                        break;

                    case 'accrued':
                        for (let p in mcwalk[t].accrued)
                            row[p] = accrued[p];
                        break;

                    case 'comment':
                        let lines = comment.trim().split('\n');
                        row.comment = getCommentHtml(lines, true);
                        row.expander = lines.length > 1? "-":"";
                        break;

                    default:
                        row[property] = mcwalk[t][property];
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