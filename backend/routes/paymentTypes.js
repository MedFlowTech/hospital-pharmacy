// backend/routes/paymentTypes.js
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name FROM payment_types ORDER BY name', []);
    res.json(rows);
  } catch (e) {
    console.error('paymentTypes:list error', e);
    res.status(500).json({ error: 'Failed to fetch payment types' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await db.query(
      'INSERT INTO payment_types (name) VALUES ($1) RETURNING id, name',
      [name.trim().toUpperCase()]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Payment type exists' });
    console.error('paymentTypes:create error', e);
    res.status(500).json({ error: 'Failed to create payment type' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM payment_types WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('paymentTypes:delete error', e);
    res.status(500).json({ error: 'Failed to delete payment type' });
  }
});

module.exports = router;
