// backend/routes/currencies.js
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT code, symbol, name FROM currencies ORDER BY code', []);
    res.json(rows);
  } catch (e) {
    console.error('currencies:list error', e);
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

module.exports = router;
