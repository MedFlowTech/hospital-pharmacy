// backend/routes/saleReturns.js
const express = require('express');
const router  = express.Router({ mergeParams: true }); // get :saleId from parent mount
const db      = require('../db'); // { query, pool }

/**
 * GET /sales/:saleId/returns
 * List return headers for a sale
 */
router.get('/', async (req, res) => {
  try {
    const saleId = Number(req.params.saleId);
    if (!Number.isInteger(saleId)) return res.status(400).json({ error: 'Invalid sale id' });

    const { rows } = await db.query(
      `SELECT id, sale_id, return_date, reason, sub_total, tax_amount, total_amount, created_at
         FROM sale_returns
        WHERE sale_id = $1
        ORDER BY id DESC`,
      [saleId]
    );
    res.json(rows);
  } catch (e) {
    console.error('saleReturns:list error', e);
    res.status(500).json({ error: 'Failed to fetch sale returns' });
  }
});

/**
 * GET /sales/:saleId/returns/:returnId
 * Header + lines + per-batch puts
 */
router.get('/:returnId', async (req, res) => {
  try {
    const saleId   = Number(req.params.saleId);
    const returnId = Number(req.params.returnId);
    if (!Number.isInteger(saleId) || !Number.isInteger(returnId)) {
      return res.status(400).json({ error: 'Invalid ids' });
    }

    const headQ = await db.query(
      `SELECT id, sale_id, return_date, reason, sub_total, tax_amount, total_amount, created_at
         FROM sale_returns
        WHERE id = $1 AND sale_id = $2`,
      [returnId, saleId]
    );
    if (!headQ.rows.length) return res.status(404).json({ error: 'Not found' });

    const linesQ = await db.query(
      `SELECT sri.id, sri.item_id, i.sku, i.name AS item_name,
              sri.qty, sri.unit_price, sri.line_total, sri.created_at
         FROM sale_return_items sri
         JOIN items i ON i.id = sri.item_id
        WHERE sri.sale_return_id = $1
        ORDER BY sri.id`,
      [returnId]
    );

    const batchesQ = await db.query(
      `SELECT srb.id, srb.item_id, b.batch_no, b.expiry_date, srb.qty
         FROM sale_return_batches srb
         JOIN batches b ON b.id = srb.batch_id
        WHERE srb.sale_return_id = $1
        ORDER BY b.expiry_date DESC NULLS FIRST, b.id DESC`,
      [returnId]
    );

    res.json({ header: headQ.rows[0], lines: linesQ.rows, batches: batchesQ.rows });
  } catch (e) {
    console.error('saleReturns:detail error', e);
    res.status(500).json({ error: 'Failed to fetch sale return' });
  }
});

/**
 * POST /sales/:saleId/returns
 * Body:
 * {
 *   "reason": "Damaged pack",
 *   "tax_amount": 0,              // optional
 *   "lines": [
 *     { "item_id": 4, "qty": 2 }  // unit_price taken from original sale (fallback to items.unit_price)
 *   ]
 * }
 *
 * Behavior:
 * - Validates qty <= (sold - previously returned) per item for that sale
 * - Inserts sale_returns header + sale_return_items
 * - Restores qty back to original batches used by the sale, in reverse FEFO
 * - Recalculates items.stock_qty from batches for affected items
 */
router.post('/', async (req, res) => {
  const saleId = Number(req.params.saleId);
  if (!Number.isInteger(saleId)) return res.status(400).json({ error: 'Invalid sale id' });

  const { reason, tax_amount = 0, lines } = req.body || {};
  if (!Array.isArray(lines) || !lines.length) {
    return res.status(400).json({ error: 'lines array is required' });
  }

  // Validate lines
  for (const [idx, ln] of lines.entries()) {
    if (!ln.item_id || ln.qty === undefined) {
      return res.status(400).json({ error: `line ${idx + 1}: item_id & qty required` });
    }
    const q = Number(ln.qty);
    if (!Number.isInteger(q) || q <= 0) {
      return res.status(400).json({ error: `line ${idx + 1}: qty must be positive integer` });
    }
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure sale exists
    const saleQ = await client.query(`SELECT id FROM sales WHERE id = $1`, [saleId]);
    if (!saleQ.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Validate against sold - previously returned
    for (const ln of lines) {
      const itemId = Number(ln.item_id);

      const soldQ = await client.query(
        `SELECT COALESCE(SUM(qty),0) AS sold_qty
           FROM sale_batches
          WHERE sale_id = $1 AND item_id = $2`,
        [saleId, itemId]
      );
      const returnedQ = await client.query(
        `SELECT COALESCE(SUM(srb.qty),0) AS ret_qty
           FROM sale_return_batches srb
          WHERE srb.sale_id = $1 AND srb.item_id = $2`,
        [saleId, itemId]
      );

      const sold = Number(soldQ.rows[0].sold_qty);
      const alreadyReturned = Number(returnedQ.rows[0].ret_qty);
      const remaining = sold - alreadyReturned;
      if (Number(ln.qty) > remaining) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Return qty exceeds remaining sold qty for item_id=${itemId}` });
      }
    }

    // Compute sub_total using original sale prices (fallback to current item price)
    let subTotal = 0;
    const pricedLines = [];
    for (const ln of lines) {
      const itemId = Number(ln.item_id);
      const qty    = Number(ln.qty);

      // Try original sale price for that item
      const priceQ = await client.query(
        `SELECT unit_price
           FROM sale_items
          WHERE sale_id = $1 AND item_id = $2
          ORDER BY id DESC
          LIMIT 1`,
        [saleId, itemId]
      );
      let unitPrice;
      if (priceQ.rows.length) {
        unitPrice = Number(priceQ.rows[0].unit_price);
      } else {
        const itemQ = await client.query(`SELECT unit_price FROM items WHERE id = $1`, [itemId]);
        unitPrice = itemQ.rows.length ? Number(itemQ.rows[0].unit_price) : 0;
      }
      const lineTotal = qty * unitPrice;
      subTotal += lineTotal;
      pricedLines.push({ item_id: itemId, qty, unit_price: unitPrice, line_total: lineTotal });
    }
    const tax = Number(tax_amount || 0);
    const total = subTotal + tax;

    // Insert return header
    const headIns = await client.query(
      `INSERT INTO sale_returns (sale_id, reason, sub_total, tax_amount, total_amount)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [saleId, reason ?? null, subTotal.toFixed(2), tax.toFixed(2), total.toFixed(2)]
    );
    const saleReturnId = headIns.rows[0].id;

    // Insert lines + restore to batches (reverse FEFO)
    const affectedItemIds = new Set();
    for (const ln of pricedLines) {
      // line row
      await client.query(
        `INSERT INTO sale_return_items (sale_return_id, item_id, qty, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5)`,
        [saleReturnId, ln.item_id, ln.qty, ln.unit_price.toFixed(2), ln.line_total.toFixed(2)]
      );

      let remaining = ln.qty;

      // Get batches used by this sale for the item, reverse FEFO
      const usedBatchesQ = await client.query(
        `SELECT sb.batch_id, sb.qty AS sold_qty, b.expiry_date
           FROM sale_batches sb
           JOIN batches b ON b.id = sb.batch_id
          WHERE sb.sale_id = $1 AND sb.item_id = $2
          ORDER BY b.expiry_date DESC NULLS FIRST, b.id DESC`,
        [saleId, ln.item_id]
      );

      for (const row of usedBatchesQ.rows) {
        if (remaining <= 0) break;

        // how much already returned to this batch for this sale+item?
        const alreadyQ = await client.query(
          `SELECT COALESCE(SUM(qty),0) AS ret
             FROM sale_return_batches srb
            WHERE srb.sale_id = $1 AND srb.item_id = $2 AND srb.batch_id = $3`,
          [saleId, ln.item_id, row.batch_id]
        );
        const already = Number(alreadyQ.rows[0].ret);
        const capacity = Number(row.sold_qty) - already;
        if (capacity <= 0) continue;

        const putBack = Math.min(remaining, capacity);

        // increase batch qty
        await client.query(
          `UPDATE batches SET qty = qty + $1 WHERE id = $2`,
          [putBack, row.batch_id]
        );

        // log the put-back
        await client.query(
          `INSERT INTO sale_return_batches (sale_return_id, sale_id, item_id, batch_id, qty)
           VALUES ($1,$2,$3,$4,$5)`,
          [saleReturnId, saleId, ln.item_id, row.batch_id, putBack]
        );

        remaining -= putBack;
      }

      if (remaining > 0) {
        // This should be impossible due to earlier validation, but guard anyway.
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Unable to map entire return qty to original batches for item_id=${ln.item_id}` });
      }

      affectedItemIds.add(ln.item_id);
    }

    // Recalc items.stock_qty from all batches (only affected items)
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
      id: saleReturnId,
      sale_id: saleId,
      sub_total: Number(subTotal.toFixed(2)),
      tax_amount: Number(tax.toFixed(2)),
      total_amount: Number(total.toFixed(2)),
      line_count: pricedLines.length
    });
  } catch (e) {
    await db.pool.query('ROLLBACK').catch(() => {});
    console.error('saleReturns:create error', e);
    if (e.code === '23503') return res.status(400).json({ error: 'Invalid FK (sale_id / item_id / batch_id)' });
    if (e.code === '22P02') return res.status(400).json({ error: 'Invalid number format' });
    res.status(500).json({ error: 'Failed to create sale return' });
  } finally {
    // release if we acquired client
    try { /* if we have client, release */ } catch {}
  }
});

module.exports = router;
