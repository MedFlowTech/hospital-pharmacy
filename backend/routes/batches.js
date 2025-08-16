// backend/routes/batches.js — CTE version (no db.connect), atomic insert/update + stock recalc
const express = require('express');
const router  = express.Router({ mergeParams: true });
const db      = require('../db');

// GET /items/:itemId/batches
router.get('/', async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId)) return res.status(400).json({ error: 'Invalid item id' });

    const { rows } = await db.query(
      `SELECT id, batch_no, expiry_date, qty, created_at
       FROM batches
       WHERE item_id = $1
       ORDER BY expiry_date NULLS LAST, id DESC`,
      [itemId]
    );
    res.json(rows);
  } catch (e) {
    console.error('batches:list error', e);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// POST /items/:itemId/batches
// body: { batch_no: string, qty: int >=0, expiry_date?: "YYYY-MM-DD" }
router.post('/', async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId)) return res.status(400).json({ error: 'Invalid item id' });

    const { batch_no, qty, expiry_date } = req.body || {};
    if (!batch_no || qty === undefined || qty === null) {
      return res.status(400).json({ error: 'batch_no (string) & qty (number) are required' });
    }
    const qtyNum = Number(qty);
    if (!Number.isInteger(qtyNum) || qtyNum < 0) {
      return res.status(400).json({ error: 'qty must be a non-negative integer' });
    }

    // Single atomic statement: insert batch, then recalc item stock from all batches
    const sql = `
      WITH ins AS (
        INSERT INTO batches (item_id, batch_no, expiry_date, qty)
        VALUES ($1, $2, $3, $4)
        RETURNING id, batch_no, expiry_date, qty, created_at
      ),
      recalc AS (
        UPDATE items
        SET stock_qty = (
          SELECT COALESCE(SUM(qty),0) FROM batches WHERE item_id = $1
        )
        WHERE id = $1
        RETURNING id
      )
      SELECT id, batch_no, expiry_date, qty, created_at FROM ins
    `;
    const { rows } = await db.query(sql, [itemId, String(batch_no), expiry_date ?? null, qtyNum]);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('batches:create error', e);
    if (e.code === '23503') return res.status(400).json({ error: 'Invalid item id (FK)' });
    if (e.code === '23505') return res.status(409).json({ error: 'Batch number already exists for this item' });
    if (e.code === '22P02') return res.status(400).json({ error: 'Invalid value (date/number)' });
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// PUT /items/:itemId/batches/:batchId
// body: may include { qty, expiry_date, batch_no } — qty must be non-negative int if provided
router.put('/:batchId', async (req, res) => {
  try {
    const itemId  = Number(req.params.itemId);
    const batchId = Number(req.params.batchId);
    if (!Number.isInteger(itemId) || !Number.isInteger(batchId)) {
      return res.status(400).json({ error: 'Invalid ids' });
    }

    const { qty, expiry_date, batch_no } = req.body || {};
    if (qty === undefined && expiry_date === undefined && batch_no === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    if (qty !== undefined) {
      const n = Number(qty);
      if (!Number.isInteger(n) || n < 0) {
        return res.status(400).json({ error: 'qty must be a non-negative integer' });
      }
    }

    // Atomic: update batch (COALESCE keeps existing values),
    // then recalc item stock from all batches of that item.
    const sql = `
      WITH upd AS (
        UPDATE batches
        SET
          qty         = COALESCE($3, qty),
          expiry_date = COALESCE($4, expiry_date),
          batch_no    = COALESCE($5, batch_no)
        WHERE id = $2 AND item_id = $1
        RETURNING id, batch_no, expiry_date, qty, created_at, item_id
      ),
      recalc AS (
        UPDATE items
        SET stock_qty = (
          SELECT COALESCE(SUM(qty),0) FROM batches WHERE item_id = $1
        )
        WHERE id = $1
        RETURNING id
      )
      SELECT id, batch_no, expiry_date, qty, created_at FROM upd
    `;
    const params = [
      itemId,
      batchId,
      qty === undefined ? null : Number(qty),
      expiry_date === undefined ? null : (expiry_date === null ? null : expiry_date),
      batch_no === undefined ? null : String(batch_no)
    ];
    const { rows } = await db.query(sql, params);
    if (!rows.length) return res.status(404).json({ error: 'Batch not found for item' });
    res.json(rows[0]);
  } catch (e) {
    console.error('batches:update error', e);
    if (e.code === '23505') return res.status(409).json({ error: 'Batch number already exists for this item' });
    if (e.code === '22P02') return res.status(400).json({ error: 'Invalid value (date/number)' });
    res.status(500).json({ error: 'Failed to update batch' });
  }
});

module.exports = router;
