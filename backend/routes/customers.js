// backend/routes/customers.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /customers?q=search
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let rows;
    if (q) {
      rows = (await db.query(
        `SELECT id, name, phone, email, address, notes, created_at
         FROM customers
         WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
         ORDER BY created_at DESC
         LIMIT 200`,
        [`%${q}%`]
      )).rows;
    } else {
      rows = (await db.query(
        `SELECT id, name, phone, email, address, notes, created_at
         FROM customers
         ORDER BY created_at DESC
         LIMIT 200`, []
      )).rows;
    }
    res.json(rows);
  } catch (e) {
    console.error('customers:list error', e);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /customers/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, phone, email, address, notes, created_at
       FROM customers WHERE id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('customers:detail error', e);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// POST /customers
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const { rows } = await db.query(
      `INSERT INTO customers (name, phone, email, address, notes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, phone, email, address, notes, created_at`,
      [name.trim(), phone || null, email || null, address || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    // duplicate phone/email friendly message
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Duplicate phone or email' });
    }
    console.error('customers:create error', e);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT /customers/:id
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, email, address, notes } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const { rows } = await db.query(
      `UPDATE customers
         SET name=$1, phone=$2, email=$3, address=$4, notes=$5
       WHERE id=$6
       RETURNING id, name, phone, email, address, notes, created_at`,
      [name.trim(), phone || null, email || null, address || null, notes || null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Duplicate phone or email' });
    }
    console.error('customers:update error', e);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE /customers/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM customers WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('customers:delete error', e);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// POST /customers/import  { rows: [{name,phone,email,address,notes}, ...] }
router.post('/import', async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'rows[] required' });

    // simple transaction
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      let ok = 0, dup = 0, bad = 0;
      for (const r of rows) {
        const name = (r.name || '').trim();
        if (!name) { bad++; continue; }
        try {
          await client.query(
            `INSERT INTO customers (name, phone, email, address, notes)
             VALUES ($1,$2,$3,$4,$5)`,
            [name, r.phone || null, r.email || null, r.address || null, r.notes || null]
          );
          ok++;
        } catch (e) {
          if (e.code === '23505') dup++;
          else throw e;
        }
      }
      await client.query('COMMIT');
      res.json({ imported: ok, duplicates: dup, invalid: bad });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('customers:import error', e);
    res.status(500).json({ error: 'Failed to import customers' });
  }
});

module.exports = router;
