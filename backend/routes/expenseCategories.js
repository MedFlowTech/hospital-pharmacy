// backend/routes/expenseCategories.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /expense-categories
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, description FROM expense_categories ORDER BY name', []
    );
    res.json(rows);
  } catch (e) {
    console.error('expenseCategories:list error', e);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /expense-categories
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await db.query(
      `INSERT INTO expense_categories (name, description)
       VALUES ($1,$2)
       RETURNING id, name, description`,
      [name.trim(), description || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Category already exists' });
    console.error('expenseCategories:create error', e);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /expense-categories/:id
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await db.query(
      `UPDATE expense_categories SET name=$1, description=$2
       WHERE id=$3
       RETURNING id, name, description`,
      [name.trim(), description || null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Category already exists' });
    console.error('expenseCategories:update error', e);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /expense-categories/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM expense_categories WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') {
      return res.status(409).json({ error: 'Category in use by expenses' });
    }
    console.error('expenseCategories:delete error', e);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
