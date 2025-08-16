const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /sales/:id  -> sale header + lines
router.get('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'invalid sale id' });
    }

    const hdrQ = await db.query(
      `SELECT s.id, s.sale_date, s.sub_total::float AS sub_total,
              s.tax_amount::float AS tax_amount, s.discount_amount::float AS discount_amount,
              s.total_amount::float AS total_amount,
              s.customer_id, c.name AS customer_name, s.notes
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.id = $1`,
      [id]
    );
    if (!hdrQ.rows.length) return res.status(404).json({ error: 'Sale not found' });
    const header = hdrQ.rows[0];

    const linesQ = await db.query(
      `SELECT si.id, si.item_id, i.sku, i.name AS item_name,
              si.batch_id, b.batch_no, b.expiry_date,
              si.qty::int AS qty,
              si.unit_price::float AS unit_price,
              si.line_total::float AS line_total
       FROM sale_items si
       JOIN items i    ON i.id = si.item_id
       LEFT JOIN batches b ON b.id = si.batch_id
       WHERE si.sale_id = $1
       ORDER BY si.id`,
      [id]
    );

    res.json({ header, lines: linesQ.rows });
  } catch (e) {
    console.error('sales:detail error', e);
    res.status(500).json({ error: 'Failed to fetch sale detail' });
  }
});
module.exports = router;
