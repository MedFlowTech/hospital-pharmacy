// backend/routes/smsTemplates.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Ensure schema (idempotent)
async function ensureTemplatesTable() {
  // Create if missing
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.sms_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      body TEXT NOT NULL
    );
  `, []);
  // Patch columns used by code
  await db.query(`
    ALTER TABLE public.sms_templates
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
  `, []);
}

// GET /sms/templates
router.get('/', async (req, res) => {
  try {
    await ensureTemplatesTable();
    const { rows } = await db.query(
      'SELECT id, name, body, created_at FROM sms_templates ORDER BY name',
      []
    );
    res.json(rows);
  } catch (e) {
    console.error('smsTemplates:list error', e);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /sms/templates
router.post('/', async (req, res) => {
  try {
    await ensureTemplatesTable();
    const { name, body } = req.body || {};
    if (!name?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'name and body are required' });
    }
    const { rows } = await db.query(
      `INSERT INTO sms_templates (name, body)
       VALUES ($1,$2)
       RETURNING id, name, body, created_at`,
      [name.trim(), body]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Template name already exists' });
    console.error('smsTemplates:create error', e);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /sms/templates/:id
router.put('/:id', async (req, res) => {
  try {
    await ensureTemplatesTable();
    const id = Number(req.params.id);
    const { name, body } = req.body || {};
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    if (!name?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'name and body are required' });
    }
    const { rows } = await db.query(
      `UPDATE sms_templates SET name=$1, body=$2
       WHERE id=$3
       RETURNING id, name, body, created_at`,
      [name.trim(), body, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Template name already exists' });
    console.error('smsTemplates:update error', e);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /sms/templates/:id
router.delete('/:id', async (req, res) => {
  try {
    await ensureTemplatesTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    const { rowCount } = await db.query('DELETE FROM sms_templates WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('smsTemplates:delete error', e);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;
