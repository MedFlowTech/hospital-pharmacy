// backend/routes/reorders.js
const express = require('express');
const router = express.Router();
const db = require('../db');
router.get('/__ping', (req, res) => res.json({ ok: true }));

// Helper: compute a sensible default qty if not provided
async function computeDefaultQty(itemId) {
  const { rows } = await db.query(
    `SELECT stock_qty, min_stock, max_stock FROM items WHERE id = $1`,
    [itemId]
  );
  if (!rows.length) return 1;
  const it = rows[0];
  const stock = Number(it.stock_qty || 0);
  const min   = Number(it.min_stock || 0);
  const max   = Number(it.max_stock || 0);

  // aim to fill up to max (or 2*min if no max)
  const target = max > 0 ? max : (min > 0 ? min * 2 : stock);
  const need = Math.max((target - stock), 1);
  return need;
}

// GET /reorders?status=pending|ordered|all
router.get('/', async (req, res) => {
  try {
    const status = (req.query.status || 'pending').toLowerCase();
    const where = status === 'all' ? '' : 'WHERE r.status = $1';
    const args  = status === 'all' ? [] : [status];

    const { rows } = await db.query(
      `
      SELECT
        r.id, r.item_id, r.requested_qty, r.status, r.supplier_id, r.notes,
        r.created_at, r.ordered_at,
        i.sku, i.name, i.stock_qty, i.min_stock, i.max_stock,
        s.name AS supplier_name
      FROM reorders r
      JOIN items i      ON i.id = r.item_id
      LEFT JOIN suppliers s ON s.id = r.supplier_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT 500
      `,
      args
    );
    res.json(rows);
  } catch (e) {
    console.error('reorders:list error', e);
    res.status(500).json({ error: 'Failed to fetch reorders' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='ordered' AND ordered_at::date = CURRENT_DATE THEN 1 ELSE 0 END) AS ordered_today
       FROM reorders`
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// POST /reorders { item_id, requested_qty?, supplier_id?, notes? }
router.post('/', async (req, res) => {
  try {
    const { item_id, requested_qty, supplier_id, notes } = req.body || {};
    if (!item_id) return res.status(400).json({ error: 'item_id is required' });

    // ensure item exists
    const item = (await db.query(`SELECT id FROM items WHERE id = $1`, [item_id])).rows[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // if pending reorder already exists for this item, merge/increment
    const existing = (await db.query(
      `SELECT id, requested_qty FROM reorders WHERE item_id = $1 AND status = 'pending'`,
      [item_id]
    )).rows[0];

    const qty = Number.isFinite(Number(requested_qty))
      ? Math.max(1, Number(requested_qty))
      : await computeDefaultQty(item_id);

    if (existing) {
      const newQty = Math.max(1, Number(existing.requested_qty || 0) + qty);
      const { rows } = await db.query(
        `UPDATE reorders
           SET requested_qty = $1,
               supplier_id = COALESCE($2, supplier_id),
               notes = COALESCE($3, notes)
         WHERE id = $4
         RETURNING *`,
        [newQty, supplier_id || null, notes || null, existing.id]
      );
      return res.status(200).json(rows[0]);
    } else {
      const { rows } = await db.query(
        `INSERT INTO reorders (item_id, requested_qty, supplier_id, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [item_id, qty, supplier_id || null, notes || null]
      );
      return res.status(201).json(rows[0]);
    }
  } catch (e) {
    console.error('reorders:create error', e);
    res.status(500).json({ error: 'Failed to create reorder' });
  }
});

// PUT /reorders/:id  { requested_qty?, supplier_id?, notes?, status? }
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { requested_qty, supplier_id, notes, status } = req.body || {};
    const st = status ? String(status).toLowerCase() : null;
    if (st && !['pending','ordered','cancelled'].includes(st)) {
      return res.status(400).json({ error: 'invalid status' });
    }

    const { rows } = await db.query(
      `UPDATE reorders
          SET requested_qty = COALESCE($1, requested_qty),
              supplier_id   = COALESCE($2, supplier_id),
              notes         = COALESCE($3, notes),
              status        = COALESCE($4, status),
              ordered_at    = CASE WHEN $4 = 'ordered' THEN NOW() ELSE ordered_at END
        WHERE id = $5
        RETURNING *`,
      [
        Number.isFinite(Number(requested_qty)) ? Math.max(1, Number(requested_qty)) : null,
        supplier_id || null,
        notes || null,
        st,
        id
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('reorders:update error', e);
    res.status(500).json({ error: 'Failed to update reorder' });
  }
});

// DELETE /reorders/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(`DELETE FROM reorders WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('reorders:delete error', e);
    res.status(500).json({ error: 'Failed to delete reorder' });
  }
});

module.exports = router;
