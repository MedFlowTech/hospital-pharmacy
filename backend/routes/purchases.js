// backend/routes/purchases.js
const express = require('express');
const router  = express.Router();
const db      = require('../db'); // exports { query, pool }

//
// GET /purchases  ?page=1&limit=50
//
router.get('/', async (req, res) => {
  try {
    const page  = Number(req.query.page  || 1);
    const limit = Number(req.query.limit || 50);
    const offset = (page - 1) * limit;

    const { rows } = await db.query(
      `SELECT p.id, p.supplier_id, s.name AS supplier_name,
              p.invoice_no, p.purchase_date, p.sub_total, p.tax_amount, p.total_amount,
              p.status, p.created_at
         FROM purchases p
         JOIN suppliers s ON s.id = p.supplier_id
        ORDER BY p.id DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (e) {
    console.error('purchases:list error', e);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

//
// GET /purchases/:id  (header + lines)
//
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const headQ = await db.query(
      `SELECT p.id, p.supplier_id, s.name AS supplier_name,
              p.invoice_no, p.purchase_date, p.sub_total, p.tax_amount, p.total_amount,
              p.status, p.created_at
         FROM purchases p
         JOIN suppliers s ON s.id = p.supplier_id
        WHERE p.id = $1`,
      [id]
    );
    if (!headQ.rows.length) return res.status(404).json({ error: 'Not found' });

    const linesQ = await db.query(
      `SELECT pi.id, pi.item_id, i.sku, i.name AS item_name,
              pi.batch_no, pi.expiry_date, pi.qty, pi.unit_cost, pi.line_total, pi.created_at
         FROM purchase_items pi
         JOIN items i ON i.id = pi.item_id
        WHERE pi.purchase_id = $1
        ORDER BY pi.id`,
      [id]
    );

    res.json({ header: headQ.rows[0], lines: linesQ.rows });
  } catch (e) {
    console.error('purchases:detail error', e);
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
});

//
// POST /purchases
// Body:
// {
//   "supplier_id": 1,
//   "invoice_no": "INV-001",
//   "purchase_date": "2025-08-10",
//   "tax_amount": 0,          // optional, default 0
//   "notes": "optional",
//   "lines": [
//     { "item_id": 4, "batch_no": "B-001", "expiry_date": "2026-12-31", "qty": 50, "unit_cost": 2.50 },
//     { "item_id": 4, "batch_no": "B-002", "expiry_date": "2027-12-31", "qty": 30, "unit_cost": 2.45 }
//   ]
// }
// Behavior:
// - inserts purchase header
// - inserts purchase_items lines
// - UPSERTS batches (item_id,batch_no), increasing qty
// - recalculates items.stock_qty from all batches for affected items
//
router.post('/', async (req, res) => {
  const {
    supplier_id,
    invoice_no,
    purchase_date,
    tax_amount = 0,
    notes,
    lines
  } = req.body || {};

  try {
    // Basic validation
    if (!supplier_id) return res.status(400).json({ error: 'supplier_id is required' });
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'lines array is required' });
    }
    for (const [idx, ln] of lines.entries()) {
      if (!ln.item_id || !ln.batch_no || ln.qty === undefined || ln.unit_cost === undefined) {
        return res.status(400).json({ error: `line ${idx+1}: item_id, batch_no, qty, unit_cost required` });
      }
      if (!Number.isInteger(Number(ln.qty)) || Number(ln.qty) < 0) {
        return res.status(400).json({ error: `line ${idx+1}: qty must be non-negative integer` });
      }
      if (Number.isNaN(Number(ln.unit_cost))) {
        return res.status(400).json({ error: `line ${idx+1}: unit_cost must be a number` });
      }
    }

    // Compute totals
    let subTotal = 0;
    for (const ln of lines) {
      subTotal += Number(ln.qty) * Number(ln.unit_cost);
    }
    const tax  = Number(tax_amount || 0);
    const total = subTotal + tax;

    // Use a transaction for atomicity
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert header
      const headIns = await client.query(
        `INSERT INTO purchases
           (supplier_id, invoice_no, purchase_date, sub_total, tax_amount, total_amount, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'POSTED')
         RETURNING id`,
        [
          Number(supplier_id),
          invoice_no ?? null,
          purchase_date ?? null, // NULL uses default CURRENT_DATE if omitted at table level; OK to pass null
          subTotal.toFixed(2),
          tax.toFixed(2),
          total.toFixed(2),
          notes ?? null
        ]
      );
      const purchaseId = headIns.rows[0].id;

      // Keep track of items to recalc stock once at end
      const affectedItemIds = new Set();

      // Insert each line and upsert batch
      for (const ln of lines) {
        const itemId = Number(ln.item_id);
        const qty    = Number(ln.qty);
        const cost   = Number(ln.unit_cost);
        const lineTotal = qty * cost;

        // Insert line
        await client.query(
          `INSERT INTO purchase_items
             (purchase_id, item_id, batch_no, expiry_date, qty, unit_cost, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            purchaseId,
            itemId,
            String(ln.batch_no),
            ln.expiry_date ?? null,
            qty,
            cost.toFixed(2),
            lineTotal.toFixed(2)
          ]
        );

        // Upsert batch (increment qty)
        await client.query(
          `INSERT INTO batches (item_id, batch_no, expiry_date, qty)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (item_id, batch_no)
           DO UPDATE SET
             qty = batches.qty + EXCLUDED.qty,
             expiry_date = COALESCE(EXCLUDED.expiry_date, batches.expiry_date)`,
          [itemId, String(ln.batch_no), ln.expiry_date ?? null, qty]
        );

        affectedItemIds.add(itemId);
      }

      // Recalculate stock for affected items from batches
      const ids = Array.from(affectedItemIds);
      if (ids.length) {
        await client.query(
          `UPDATE items i
             SET stock_qty = COALESCE(b.sum_qty, 0)
            FROM (
              SELECT item_id, SUM(qty) AS sum_qty
                FROM batches
               WHERE item_id = ANY($1::int[])
               GROUP BY item_id
            ) b
           WHERE i.id = b.item_id`,
          [ids]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        id: purchaseId,
        supplier_id: Number(supplier_id),
        invoice_no: invoice_no ?? null,
        purchase_date: purchase_date ?? null,
        sub_total: Number(subTotal.toFixed(2)),
        tax_amount: Number(tax.toFixed(2)),
        total_amount: Number(total.toFixed(2)),
        status: 'POSTED',
        line_count: lines.length
      });
    } catch (eTx) {
      await client.query('ROLLBACK');
      console.error('purchases:create error', eTx);
      if (eTx.code === '23503') return res.status(400).json({ error: 'Invalid supplier_id or item_id (FK)' });
      if (eTx.code === '22P02') return res.status(400).json({ error: 'Invalid number format' });
      if (eTx.code === '23505') return res.status(409).json({ error: 'Duplicate key (check invoice_no uniqueness if added)' });
      return res.status(500).json({ error: 'Failed to create purchase' });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('purchases:create outer error', e);
    res.status(500).json({ error: 'Failed to create purchase' });
  }
});

module.exports = router;
