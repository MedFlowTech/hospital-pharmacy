// backend/routes/expenses.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /expenses?from=YYYY-MM-DD&to=YYYY-MM-DD&category_id=#
router.get('/', async (req, res) => {
  try {
    const { from, to, category_id } = req.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push(`expense_date >= $${params.length}`); }
    if (to)   { params.push(to);   where.push(`expense_date <= $${params.length}`); }
    if (category_id) { params.push(category_id); where.push(`e.category_id = $${params.length}`); }
    const sql = `
      SELECT e.id, e.expense_date, e.category_id, c.name AS category_name,
             e.description, e.amount, e.payment_type, e.created_at
      FROM expenses e
      JOIN expense_categories c ON c.id = e.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.expense_date DESC, e.id DESC
      LIMIT 1000
    `;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('expenses:list error', e);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// POST /expenses
router.post('/', async (req, res) => {
  try {
    const { expense_date, category_id, description, amount, payment_type } = req.body || {};
    if (!category_id) return res.status(400).json({ error: 'category_id is required' });

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return res.status(400).json({ error: 'amount must be >= 0' });

    const { rows } = await db.query(
      `INSERT INTO expenses (expense_date, category_id, description, amount, payment_type)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, expense_date, category_id, description, amount, payment_type, created_at`,
      [
        expense_date || null,      // null uses DEFAULT CURRENT_DATE
        Number(category_id),
        description || null,
        amt,
        payment_type || null
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: 'Invalid category_id' });
    console.error('expenses:create error', e);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// GET /expenses/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push(`expense_date >= $${params.length}`); }
    if (to)   { params.push(to);   where.push(`expense_date <= $${params.length}`); }

    const byCategorySql = `
      SELECT c.id AS category_id, c.name AS category_name, COALESCE(SUM(e.amount),0) AS total
      FROM expense_categories c
      LEFT JOIN expenses e ON e.category_id = c.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      GROUP BY c.id, c.name
      ORDER BY c.name
    `;
    const overallSql = `
      SELECT COALESCE(SUM(amount),0) AS total
      FROM expenses
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    `;

    const [byCat, all] = await Promise.all([
      db.query(byCategorySql, params),
      db.query(overallSql, params)
    ]);

    res.json({
      overall: all.rows[0].total,
      by_category: byCat.rows
    });
  } catch (e) {
    console.error('expenses:summary error', e);
    res.status(500).json({ error: 'Failed to summarize expenses' });
  }
});

module.exports = router;
