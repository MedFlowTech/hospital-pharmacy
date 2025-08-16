// backend/routes/taxes.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// list taxes
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, rate_percent FROM taxes ORDER BY name', []);
    res.json(rows);
  } catch (e) {
    console.error('taxes:list error', e);
    res.status(500).json({ error: 'Failed to fetch taxes' });
  }
});

// create
router.post('/', async (req, res) => {
  try {
    const { name, rate_percent } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const rate = Number(rate_percent);
    if (!Number.isFinite(rate) || rate < 0) return res.status(400).json({ error: 'rate_percent must be >= 0' });

    const { rows } = await db.query(
      `INSERT INTO taxes (name, rate_percent) VALUES ($1,$2)
       RETURNING id, name, rate_percent`,
      [name.trim(), rate]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Tax name already exists' });
    console.error('taxes:create error', e);
    res.status(500).json({ error: 'Failed to create tax' });
  }
});

// update
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, rate_percent } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const rate = Number(rate_percent);
    if (!Number.isFinite(rate) || rate < 0) return res.status(400).json({ error: 'rate_percent must be >= 0' });

    const { rows } = await db.query(
      `UPDATE taxes SET name=$1, rate_percent=$2
       WHERE id=$3
       RETURNING id, name, rate_percent`,
      [name.trim(), rate, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Tax name already exists' });
    console.error('taxes:update error', e);
    res.status(500).json({ error: 'Failed to update tax' });
  }
});

// delete
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM taxes WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('taxes:delete error', e);
    res.status(500).json({ error: 'Failed to delete tax' });
  }
});

module.exports = router;
