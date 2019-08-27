"use strict";
var global = {};

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

async function setCommentExpansion(index, expand) {

    let row = global.table.getRow(index);

    // retrieve comment from table, stripping HTML
    let lines = row.getData().comment
        .split(/<[\/]*div[^>]*>/g)
        .filter(line => line.length > 0);

    return global.table.updateData([{
        id: index, 
        expander: lines.length > 1? (expand? "-" : "+") : "",
        comment: getCommentHtml(lines, expand)
    }]).then(row.normalizeHeight());
}

function toggleCellComment(cell) {

    let index = cell.getRow().getPosition();
    let expand = cell.getRow().getData().expander == '+';
    setCommentExpansion(index, expand);
}

async function toggleComments() {

    global.expandComments = !global.expandComments;
    await refreshTable();
}

function toggleCashFlows() {

    global.expandAccruals = !global.expandAccruals;
    refreshTable();
}

function asColoredDollars(cell, reverse = false) {

    let amount = cell.getValue();

    let condition = amount >= 0.0;
    if (reverse) condition = !condition;

    cell.getElement().style.color = 
        condition? '#007700' : '#770000';

    return asUsdDollars(cell);
}

function asUsdDollars(cell) {

    let amount = cell.getValue();

    let content = 
        parseFloat(Math.abs(amount)).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");        
    content = '$' + (amount >= 0.0? content : '(' + content + ')');
    return content;
}

function asColoredRate(cell) {

    let rate = cell.getValue();
    cell.getElement().style.color = rate >= 0.0? '#007700' : '#770000';

    return asRate(rate);
}


function getColumns(percentile) {

    let addColumn = (columnListing, defaults, column) => 
        columnListing.push(Object.assign({}, defaults, column));

    let defaults = {
        align: 'center', 
        headerSort: false
    };

    let fields = [];
    addColumn(fields, {title: "Date", field: "date", width: 85}, defaults);
    addColumn(fields, {title: "Age", field: "age", width: 42}, defaults);

    let valueColumns = [];
    let cashflowColumns = [];
    let marketColumns = [];

    defaults = {
        align: 'right', 
        headerSort: false, 
        formatter: (cell, formatterParams) => asUsdDollars(cell), 
    }

    defaults.width = 110;
    addColumn(valueColumns, defaults, {title: 'Assets', field: 'assetValue'});
    addColumn(valueColumns, defaults, {title: 'Cash', field: 'cash'});
    addColumn(valueColumns, defaults, {title: 'Bonds', field: 'bondsValue'});
    addColumn(valueColumns, defaults, {title: 'Stocks', field: 'stockValue'});

    defaults.formatter = (cell, formatterParams) => asColoredDollars(cell);
    addColumn(cashflowColumns, defaults, {title: 'Cashflow', field: 'cashflow'});

    defaults.formatter = (cell, formatterParams) => asColoredRate(cell);
    addColumn(cashflowColumns, defaults, {title: 'Growth', field: 'growth', width: 70});

    if (global.expandAccruals) {

        defaults.width = 90;
        defaults.formatter = (cell, formatterParams) => asColoredDollars(cell);
        addColumn(cashflowColumns, defaults, {title: 'Earned', field: 'earned'})
        addColumn(cashflowColumns, defaults, {title: 'Spent', field: 'spent'})
        addColumn(cashflowColumns, defaults, {title: 'Coupons', field: 'coupons'})
        addColumn(cashflowColumns, defaults, {title: 'Dividends', field: 'dividends'});
        addColumn(cashflowColumns, defaults, {title: 'Matured', field: 'matured'});
        addColumn(cashflowColumns, defaults, {title: 'Sold', field: 'liquidated'});

        defaults.formatter = (cell, formatterParams) => asColoredDollars(cell, true);
        addColumn(cashflowColumns, defaults, {title: 'Invested', field: 'invested'});
        addColumn(cashflowColumns, defaults, {title: 'Taxes', field: 'taxes'});
    }

    defaults.visible = true;
    defaults.width = 80;
    defaults.formatter = (cell, formatterParams) => asUsdDollars(cell);
    addColumn(marketColumns, defaults, {title: 'S&P 500', field: 'spyPrice'});

    defaults = {
        align: 'right',
        headerSort: false,
        formatter: (cell, formatterParams) => asRate(cell.getValue()),
        width: 75,
    }

    addColumn(marketColumns, defaults, {title: 'Interest', field: 'interest'});

    fields.push({
        title: `Agent Valuation at ${percentile}th percentile`,
        columns: valueColumns
    });

    let cashflowHeader = global.expandAccruals? '- Flows' : '+ Flows';
    fields.push({
        title: `<div id="cashflow-expander-id" style="cursor: pointer;">${cashflowHeader}</div>`,
        columns: cashflowColumns,
        headerClick: (e, column) => toggleCashFlows(),
    });

    fields.push({
        title: `Market Conditions`,
        columns: marketColumns
    });

    let expandToken = global.expandComments? '-' : '+';
    fields.push({
        title: "",
        columns: [
            {                
                title: `<div id="comment-expander-id" style="cursor: pointer;">${expandToken}</div>`,
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
                title: '<div style="cursor: pointer;">Comments</div>', 
                field: "comment", 
                align: 'left', 
                formatter:"html",
                headerClick: (e, column) => toggleComments(),
                headerSort: false, 
                widthGrow: 1,
                minWidth: 250
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
    let comments = [];
    let lastAssetValue = mcwalk.length > 0? mcwalk[0].assetValue : 0.0;

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
        comments.push.apply(comments, mcwalk[t].comments);
        
        // sample row data when reached print step
        const printStep = global.input.display.printStep
        if (relativeTime - lastPrintedAt >= printStep || t == mcwalk.length-1) {

            let date = mcwalk[t].time.toLocaleDateString("en-US", global.dateFormat);

            let row = {id: rows.length, date: date};
            row.age = Math.floor(global.input.agent.startAge + relativeTime);
            
            for (let property in mcwalk[t]) {
                switch (property) {

                    case 'cash':
                    case 'bondsValue':
                    case 'stockValue':
                    case 'interest':
                    case 'spyPrice':
                    case 'inflation':
                        row[property] = parseFloat(mcwalk[t][property]);
                        break;

                    case 'assetValue':
                        row.assetValue = parseFloat(mcwalk[t]['assetValue']);
                        row.growth = (row.assetValue - lastAssetValue)/lastAssetValue;
                        lastAssetValue = row.assetValue;
                        break;

                    case 'accrued':
                        for (let p in mcwalk[t].accrued)
                            row[p] = accrued[p];
                        break;

                    case 'comments':
                        let expand = global.expandComments;
                        row.comment = getCommentHtml(comments, expand);
                        row.expander = comments.length > 1? (expand? '-' : '+'): '';
                        break;

                    default:
                        row[property] = mcwalk[t][property];
                        break;
                }
            }

            rows.push(row);
            lastPrintedAt = relativeTime;

            accrued = {};
            comments = [];
        }
    }

    return rows;
}

function refreshTable() {

    // define globals
    if (typeof global.expandComments === 'undefined') {

        global.expandComments = true;
        global.expandAccruals = false;
    }

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
            virtualDomBuffer: 2000,
            layoutColumnsOnNewData:true
        });
        global.table.redraw();
    }
    else {

        global.table.setColumns(fields);
        global.table.replaceData(rows);
        global.table.redraw();
    }
}