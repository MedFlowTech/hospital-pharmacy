// backend/routes/settings.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');

/**
 * GET /settings  -> [{key,value}]
 */
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT key, value, updated_at FROM settings ORDER BY key', []
    );
    res.json(rows);
  } catch (e) {
    console.error('settings:list error', e);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * GET /settings/public -> { currency, default_tax_rate }
 * (safe subset for frontend)
 */
router.get('/public', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM settings WHERE key IN ($1,$2)', ['currency','default_tax_rate']);
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    // ensure defaults if keys missing
    if (!out.currency) out.currency = 'USD';
    if (!out.default_tax_rate) out.default_tax_rate = '0';
    res.json(out);
  } catch (e) {
    console.error('settings:public error', e);
    res.json({ currency: 'USD', default_tax_rate: '0' });
  }
});

/**
 * PUT /settings  body: { key1: value1, key2: value2, ... }
 */
router.put('/', async (req, res) => {
  try {
    const body = req.body || {};
    const entries = Object.entries(body);
    if (entries.length === 0) return res.status(400).json({ error: 'No settings to update' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const [k, v] of entries) {
        await client.query(
          `INSERT INTO settings(key,value,updated_at)
           VALUES($1,$2, NOW())
           ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [String(k), String(v)]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('settings:update error', e);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /company-profile -> single row
 */
router.get('/company-profile', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, address, phone, email, tax_id, receipt_footer, updated_at
       FROM company_profile ORDER BY id LIMIT 1`, []
    );
    res.json(rows[0] || null);
  } catch (e) {
    console.error('company:get error', e);
    res.status(500).json({ error: 'Failed to fetch company profile' });
  }
});

/**
 * PUT /company-profile -> upsert row id=1
 */
router.put('/company-profile', async (req, res) => {
  try {
    const { name, address, phone, email, tax_id, receipt_footer } = req.body || {};
    if (!name || String(name).trim() === '') return res.status(400).json({ error: 'name is required' });

    await db.query(
      `INSERT INTO company_profile (id, name, address, phone, email, tax_id, receipt_footer, created_at, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         name=$1, address=$2, phone=$3, email=$4, tax_id=$5, receipt_footer=$6, updated_at=NOW()`,
      [name, address || null, phone || null, email || null, tax_id || null, receipt_footer || null]
    );

    const { rows } = await db.query(
      `SELECT id, name, address, phone, email, tax_id, receipt_footer, updated_at
       FROM company_profile WHERE id = 1`, []
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('company:update error', e);
    res.status(500).json({ error: 'Failed to update company profile' });
  }
});

module.exports = router;
