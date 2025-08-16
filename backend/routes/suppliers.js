// backend/routes/suppliers.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// quick ping to prove mount: GET /suppliers/ping
router.get('/ping', (_req, res) => res.send('suppliers ok'));

// List suppliers
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, phone, email, address, created_at FROM suppliers ORDER BY name',
      []
    );
    res.json(rows);
  } catch (e) {
    console.error('suppliers:list error', e);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Create supplier
router.post('/', async (req, res) => {
  const { name, phone, email, address } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const { rows } = await db.query(
      `INSERT INTO suppliers (name, phone, email, address)
       VALUES ($1,$2,$3,$4)
       RETURNING id, name, phone, email, address, created_at`,
      [name, phone ?? null, email ?? null, address ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('suppliers:create error', e);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

module.exports = router;
