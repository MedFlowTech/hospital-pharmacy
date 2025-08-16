// backend/routes/salesReturnsAdvanced.js
const express = require('express');
const router = express.Router();
const db = require('../db');

function ymd(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// GET /sales-returns/advanced
router.get('/advanced', async (req, res) => {
  try {
    const df = ymd(req.query.date_from) || new Date().toISOString().slice(0,10);
    const dt = ymd(req.query.date_to)   || df;

    const { rows } = await db.query(
      `
      SELECT
        r.id,
        r.return_date,
        r.sub_total::float  AS sub_total,
        r.tax_amount::float AS tax_amount,
        (COALESCE(r.sub_total,0) + COALESCE(r.tax_amount,0) - COALESCE(r.total_amount,0))::float AS discount_amount,
        r.total_amount::float AS total_amount,
        r.reason
      FROM sale_returns r
      WHERE r.return_date >= $1::date
        AND r.return_date <  ($2::date + INTERVAL '1 day')
      ORDER BY r.return_date DESC, r.id DESC
      LIMIT 200
      `,[df, dt]
    );
    res.json(rows);
  } catch (e) {
    console.error('salesReturns:advanced error', e);
    res.status(500).json({ error: 'Failed to fetch return list' });
  }
});

// GET /sales-returns/summary
router.get('/summary', async (req, res) => {
  try {
    const df = ymd(req.query.date_from) || new Date().toISOString().slice(0,10);
    const dt = ymd(req.query.date_to)   || df;

    const { rows } = await db.query(
      `
      SELECT
        COUNT(*)::int AS return_count,
        COALESCE(SUM(sub_total),0)::float  AS sub_total,
        COALESCE(SUM(tax_amount),0)::float AS tax_amount,
        COALESCE(SUM(COALESCE(sub_total,0) + COALESCE(tax_amount,0) - COALESCE(total_amount,0)),0)::float AS discount_amount,
        COALESCE(SUM(total_amount),0)::float AS total_amount
      FROM sale_returns
      WHERE return_date >= $1::date
        AND return_date <  ($2::date + INTERVAL '1 day')
      `,[df, dt]
    );
    res.json({ range: { from: df, to: dt }, totals: rows[0] });
  } catch (e) {
    console.error('salesReturns:summary error', e);
    res.status(500).json({ error: 'Failed to summarize returns' });
  }
});

// GET /sales-returns/:id/detail
router.get('/:id/detail', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    console.log('salesReturns:detail id param =', req.params.id, 'parsed =', id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid return id' });

    const hdr = await db.query(
      `SELECT
          r.id,
          r.return_date,
          r.sub_total::float  AS sub_total,
          r.tax_amount::float AS tax_amount,
          (COALESCE(r.sub_total,0) + COALESCE(r.tax_amount,0) - COALESCE(r.total_amount,0))::float AS discount_amount,
          r.total_amount::float AS total_amount,
          r.reason
       FROM sale_returns r
       WHERE r.id = $1::int`,
      [id]
    );
    console.log('salesReturns:detail header rows =', hdr.rows.length);

    if (!hdr.rows.length) return res.status(404).json({ error: 'Return not found' });

    const lines = await db.query(
      `SELECT
          ri.id,
          ri.item_id,
          i.sku,
          i.name AS item_name,
          ri.qty::int           AS qty,
          ri.unit_price::float  AS unit_price,
          ri.line_total::float  AS line_total
       FROM sale_return_items ri
       JOIN items i ON i.id = ri.item_id
       WHERE ri.return_id = $1::int
       ORDER BY ri.id`,
      [id]
    );

    res.json({ header: hdr.rows[0], lines: lines.rows });
  } catch (e) {
    console.error('salesReturns:detail error', e);
    res.status(500).json({ error: 'Failed to fetch return detail' });
  }
});

module.exports = router;
