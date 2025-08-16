// backend/routes/itemLookup.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /items/lookup?q=...&limit=20
// Finds items by SKU or Name (case-insensitive), returns basics for POS
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(50, Number(req.query.limit || 20));
    if (!q) return res.json([]); // empty query ⇒ empty list

    const { rows } = await db.query(
      `SELECT 
         i.id,
         i.sku,
         i.name,
         i.unit_price::float AS unit_price,
         i.stock_qty,
         COALESCE(c.name,'') AS category,
         COALESCE(b.name,'') AS brand
       FROM items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN brands b     ON b.id = i.brand_id
       WHERE i.sku ILIKE $1 OR i.name ILIKE $1
       ORDER BY i.name
       LIMIT $2`,
      [`%${q}%`, limit]
    );
    res.json(rows);
  } catch (e) {
    console.error('itemLookup error', e);
    res.status(500).json({ error: 'Failed to lookup items' });
  }
});

module.exports = router;
