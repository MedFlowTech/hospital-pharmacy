// backend/routes/brands.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// quick ping to prove mount: GET /brands/ping
router.get('/ping', (_req, res) => res.send('brands ok'));

// List brands
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, description FROM brands ORDER BY name',
      []
    );
    res.json(rows);
  } catch (e) {
    console.error('brands:list error', e);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// Create brand
router.post('/', async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await db.query(
      `INSERT INTO brands (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description`,
      [name, description ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('brands:create error', e);
    if (e.code === '23505') return res.status(409).json({ error: 'Brand name already exists' });
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

module.exports = router;
