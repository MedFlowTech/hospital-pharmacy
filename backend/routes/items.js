// backend/routes/items.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');

/**
 * GET /items
 * Optional filters: ?q=search&category_id=1&brand_id=1&low_stock=1&page=1&limit=50
 */
router.get('/', async (req, res) => {
  try {
    const { q, category_id, brand_id, low_stock, page = 1, limit = 50 } = req.query;
    const where = [];
    const params = [];
    let idx = 1;

    if (q) {
      where.push(`(i.sku ILIKE $${idx} OR i.name ILIKE $${idx})`);
      params.push(`%${q}%`); idx++;
    }
    if (category_id) { where.push(`i.category_id = $${idx++}`); params.push(Number(category_id)); }
    if (brand_id)    { where.push(`i.brand_id = $${idx++}`);    params.push(Number(brand_id)); }
    if (low_stock)   { where.push(`i.stock_qty <= i.min_stock`); }

    const offset = (Number(page) - 1) * Number(limit);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT i.id, i.sku, i.name, i.category_id, i.brand_id,
             i.cost_price, i.unit_price, i.stock_qty,
             i.min_stock, i.max_stock, i.default_unit_id, i.created_at
      FROM items i
      ${whereSql}
      ORDER BY i.id DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('items:list error', e);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

/**
 * POST /items
 * Required: sku, name, unit_price
 */
router.post('/', async (req, res) => {
  try {
    const {
      sku, name,
      category_id, brand_id,
      cost_price, unit_price,
      stock_qty, min_stock, max_stock,
      default_unit_id
    } = req.body || {};

    if (!sku || !name || unit_price === undefined || unit_price === null) {
      return res.status(400).json({ error: 'sku, name & unit_price are required' });
    }

    // Validate FKs if provided
    async function ensureExists(table, id) {
      if (id === undefined || id === null) return null;
      const { rows } = await db.query(`SELECT id FROM ${table} WHERE id = $1`, [Number(id)]);
      return rows.length ? Number(id) : null;
    }

    const categoryId = await ensureExists('categories', category_id);
    const brandId    = await ensureExists('brands',     brand_id);
    const unitId     = await ensureExists('units',      default_unit_id);

    const { rows } = await db.query(
      `INSERT INTO items
        (sku, name, category_id, brand_id, cost_price, unit_price,
         stock_qty, min_stock, max_stock, default_unit_id)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, sku, name, category_id, brand_id, cost_price, unit_price,
                 stock_qty, min_stock, max_stock, default_unit_id, created_at`,
      [
        sku,
        name,
        categoryId,
        brandId,
        cost_price ?? null,
        Number(unit_price),
        Number(stock_qty ?? 0),
        Number(min_stock ?? 0),
        max_stock !== undefined && max_stock !== null ? Number(max_stock) : null,
        unitId
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('items:create error', e);
    if (e.code === '23505') return res.status(409).json({ error: 'SKU already exists' });
    if (e.code === '22P02') return res.status(400).json({ error: 'Invalid number format' });
    if (e.code === '23503') return res.status(400).json({ error: 'Invalid foreign key id' });
    res.status(500).json({ error: 'Failed to create item' });
  }
});

/**
 * GET /items/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await db.query(
      `SELECT id, sku, name, category_id, brand_id, cost_price, unit_price,
              stock_qty, min_stock, max_stock, default_unit_id, created_at
       FROM items WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('items:detail error', e);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

/**
 * PUT /items/:id — robust partial update with number validation
 */
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      sku, name,
      category_id, brand_id,
      cost_price, unit_price,
      stock_qty, min_stock, max_stock,
      default_unit_id
    } = req.body || {};

    const sets = [];
    const vals = [];
    let idx = 1;

    const addText = (field, val) => {
      if (val === undefined) return;
      sets.push(`${field} = $${idx++}`);
      vals.push(String(val));
    };

    const addInt = (field, val) => {
      if (val === undefined) return;
      if (val === null) { sets.push(`${field} = NULL`); return; }
      const n = Number(val);
      if (!Number.isInteger(n)) {
        const err = new Error(`invalid integer for ${field}`); err.status = 400; err.code = 'EINVAL_INT'; err.field = field;
        throw err;
      }
      sets.push(`${field} = $${idx++}`); vals.push(n);
    };

    const addNum = (field, val) => {
      if (val === undefined) return;
      if (val === null) { sets.push(`${field} = NULL`); return; }
      const n = Number(val);
      if (Number.isNaN(n)) {
        const err = new Error(`invalid number for ${field}`); err.status = 400; err.code = 'EINVAL_NUM'; err.field = field;
        throw err;
      }
      sets.push(`${field} = $${idx++}`); vals.push(n);
    };

    addText('sku', sku);
    addText('name', name);
    addInt('category_id', category_id);
    addInt('brand_id', brand_id);
    addNum('cost_price', cost_price);
    addNum('unit_price', unit_price);
    addInt('stock_qty', stock_qty);
    addInt('min_stock', min_stock);
    // allow null for max_stock (unbounded)
    if (max_stock === null) { sets.push(`max_stock = NULL`); }
    else addInt('max_stock', max_stock);
    addInt('default_unit_id', default_unit_id);

    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

    vals.push(id);
    const sql = `
      UPDATE items
      SET ${sets.join(', ')}
      WHERE id = $${idx}
      RETURNING id, sku, name, category_id, brand_id, cost_price, unit_price,
                stock_qty, min_stock, max_stock, default_unit_id, created_at
    `;
    const { rows } = await db.query(sql, vals);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('items:update error', e);
    if (e.status) return res.status(e.status).json({ error: e.message, code: e.code, field: e.field });
    if (e.code === '23505') return res.status(409).json({ error: 'SKU already exists' });
    if (e.code === '22P02') return res.status(400).json({ error: 'Invalid number format' });
    if (e.code === '23503') return res.status(400).json({ error: 'Invalid foreign key id' });
    res.status(500).json({ error: 'Failed to update item' });
  }
});

module.exports = router;
