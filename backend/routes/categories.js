// backend/routes/categories.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// quick ping to prove mount: GET /categories/ping
router.get('/ping', (_req, res) => res.send('categories ok'));

// List
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, description FROM categories ORDER BY name', []
    );
    res.json(rows);
  } catch (e) {
    console.error('categories:list error', e);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create
router.post('/', async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO categories (name, description)
       VALUES ($1,$2)
       RETURNING id, name, description`,
      [name, description ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('categories:create error', e);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

module.exports = router;
