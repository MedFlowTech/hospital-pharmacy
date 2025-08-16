// backend/routes/units.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// quick ping to prove mount: GET /units/ping
router.get('/ping', (_req, res) => res.send('units ok'));

// List units
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name FROM units ORDER BY name',
      []
    );
    res.json(rows);
  } catch (e) {
    console.error('units:list error', e);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

// Create unit
router.post('/', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await db.query(
      `INSERT INTO units (name)
       VALUES ($1)
       RETURNING id, name`,
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('units:create error', e);
    if (e.code === '23505') return res.status(409).json({ error: 'Unit name already exists' });
    res.status(500).json({ error: 'Failed to create unit' });
  }
});

module.exports = router;
