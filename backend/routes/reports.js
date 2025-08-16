// backend/routes/reports.js
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /reports/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns:
 * {
 *   from, to,
 *   sales: { sub_total, tax_total, discount_total, sales_total },
 *   cogs: number,
 *   expenses: number,
 *   gross_profit: number,  // sub_total - cogs
 *   net_profit: number     // sales_total - cogs - expenses
 * }
 */
router.get('/pnl', async (req, res) => {
  try {
    const { from, to } = req.query;

    const whereSales = [];
    const pSales = [];
    if (from) { pSales.push(from); whereSales.push(`s.sale_date >= $${pSales.length}`); }
    if (to)   { pSales.push(to);   whereSales.push(`s.sale_date <= $${pSales.length}`); }
    const whereSalesSQL = whereSales.length ? `WHERE ${whereSales.join(' AND ')}` : '';

    // Sales totals
    const salesSql = `
      SELECT
        COALESCE(SUM(s.sub_total), 0)      AS sub_total,
        COALESCE(SUM(s.tax_amount), 0)     AS tax_total,
        COALESCE(SUM(s.discount_amount),0) AS discount_total,
        COALESCE(SUM(s.total_amount), 0)   AS sales_total
      FROM sales s
      ${whereSalesSQL}
    `;
    const salesRow = (await db.query(salesSql, pSales)).rows[0];

    // COGS based on cost_price at time of sale (using current items.cost_price)
    const cogsSql = `
      SELECT COALESCE(SUM(si.qty * i.cost_price), 0) AS cogs
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN items i ON i.id = si.item_id
      ${whereSalesSQL}
    `;
    const cogsRow = (await db.query(cogsSql, pSales)).rows[0];

    // Expenses totals
    const whereExp = [];
    const pExp = [];
    if (from) { pExp.push(from); whereExp.push(`expense_date >= $${pExp.length}`); }
    if (to)   { pExp.push(to);   whereExp.push(`expense_date <= $${pExp.length}`); }
    const whereExpSQL = whereExp.length ? `WHERE ${whereExp.join(' AND ')}` : '';

    const expSql = `
      SELECT COALESCE(SUM(amount), 0) AS expenses_total
      FROM expenses
      ${whereExpSQL}
    `;
    const expRow = (await db.query(expSql, pExp)).rows[0];

    const sub_total     = Number(salesRow.sub_total || 0);
    const tax_total     = Number(salesRow.tax_total || 0);
    const discount_total= Number(salesRow.discount_total || 0);
    const sales_total   = Number(salesRow.sales_total || 0);
    const cogs          = Number(cogsRow.cogs || 0);
    const expenses      = Number(expRow.expenses_total || 0);

    const gross_profit  = sub_total - cogs;
    const net_profit    = sales_total - cogs - expenses;

    res.json({
      from: from || null,
      to: to || null,
      sales: { sub_total, tax_total, discount_total, sales_total },
      cogs,
      expenses,
      gross_profit,
      net_profit
    });
  } catch (e) {
    console.error('reports:pnl error', e);
    res.status(500).json({ error: 'Failed to compute P&L' });
  }
});

module.exports = router;
