// backend/routes/salesAdvanced.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// helpers to parse dates safely
function toDate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// GET /sales/advanced?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&payment_type_id=ID
router.get('/advanced', async (req, res) => {
  try {
    const df = toDate(req.query.date_from) || toDate(new Date().toISOString().slice(0,10)); // today default
    const dt = toDate(req.query.date_to)   || df;
    const pt = req.query.payment_type_id ? Number(req.query.payment_type_id) : null;

    const { rows } = await db.query(
      `
      SELECT
        s.id,
        s.sale_date,
        s.sub_total::float   AS sub_total,
        s.tax_amount::float  AS tax_amount,
        s.discount_amount::float AS discount_amount,
        s.total_amount::float AS total_amount,
        COALESCE(SUM(sp.amount),0)::float AS paid_amount
      FROM sales s
      LEFT JOIN sale_payments sp ON sp.sale_id = s.id
      WHERE s.sale_date >= $1::date
        AND s.sale_date < ($2::date + INTERVAL '1 day')
        AND ($3::int IS NULL OR EXISTS (
          SELECT 1 FROM sale_payments sp2 WHERE sp2.sale_id = s.id AND sp2.payment_type_id = $3
        ))
      GROUP BY s.id
      ORDER BY s.sale_date DESC
      LIMIT 200
      `,
      [df, dt, pt]
    );
    res.json(rows);
  } catch (e) {
    console.error('sales:advanced error', e);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET /sales/summary?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
router.get('/summary', async (req, res) => {
  try {
    const df = toDate(req.query.date_from) || toDate(new Date().toISOString().slice(0,10));
    const dt = toDate(req.query.date_to)   || df;

    const hdr = await db.query(
      `
      SELECT
        COUNT(*)::int                                AS sale_count,
        COALESCE(SUM(s.sub_total),0)::float         AS sub_total,
        COALESCE(SUM(s.tax_amount),0)::float        AS tax_amount,
        COALESCE(SUM(s.discount_amount),0)::float   AS discount_amount,
        COALESCE(SUM(s.total_amount),0)::float      AS total_amount
      FROM sales s
      WHERE s.sale_date >= $1::date AND s.sale_date < ($2::date + INTERVAL '1 day')
      `,
      [df, dt]
    );

    const pays = await db.query(
      `
      SELECT
        pt.id,
        pt.name,
        COALESCE(SUM(sp.amount),0)::float AS amount
      FROM sale_payments sp
      JOIN payment_types pt ON pt.id = sp.payment_type_id
      JOIN sales s          ON s.id = sp.sale_id
      WHERE s.sale_date >= $1::date AND s.sale_date < ($2::date + INTERVAL '1 day')
      GROUP BY pt.id, pt.name
      ORDER BY pt.name
      `,
      [df, dt]
    );

    res.json({
      range: { from: df, to: dt },
      totals: hdr.rows[0],
      payments: pays.rows
    });
  } catch (e) {
    console.error('sales:summary error', e);
    res.status(500).json({ error: 'Failed to summarize sales' });
  }
});

module.exports = router;
