// backend/routes/sms.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Ensure outbox (and patch columns)
async function ensureOutbox() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.sms_outbox (
      id SERIAL PRIMARY KEY,
      to_number VARCHAR(40) NOT NULL,
      template_id INTEGER REFERENCES public.sms_templates(id),
      body_resolved TEXT NOT NULL
    );
  `, []);
  await db.query(`
    ALTER TABLE public.sms_outbox
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
      ADD COLUMN IF NOT EXISTS provider VARCHAR(40) NOT NULL DEFAULT 'console',
      ADD COLUMN IF NOT EXISTS provider_response TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP NULL;
  `, []);
}

// simple mustache-ish render: replaces {{key}} with params[key]
function renderTemplate(tpl, params = {}) {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : ''
  );
}

// POST /sms/send
router.post('/send', async (req, res) => {
  try {
    await ensureOutbox();

    const { to, template_id, params, body } = req.body || {};
    if (!to?.trim()) return res.status(400).json({ error: 'to is required' });

    let resolved;
    if (template_id != null) {
      // Ensure templates table exists & has columns
      await db.query(`
        CREATE TABLE IF NOT EXISTS public.sms_templates (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          body TEXT NOT NULL
        );`, []);
      await db.query(`
        ALTER TABLE public.sms_templates
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
      `, []);

      const tid = Number(template_id);
      if (!Number.isFinite(tid)) return res.status(400).json({ error: 'Invalid template_id' });
      const t = await db.query('SELECT body FROM sms_templates WHERE id=$1', [tid]);
      if (!t.rows.length) return res.status(400).json({ error: 'Invalid template_id' });
      resolved = renderTemplate(t.rows[0].body, params || {});
    } else if (body?.trim()) {
      resolved = body;
    } else {
      return res.status(400).json({ error: 'Either template_id or body is required' });
    }

    // “Send” via console provider
    console.log(`📨 [console] to=${to} message="${resolved}"`);

    const ins = await db.query(
      `INSERT INTO sms_outbox (to_number, template_id, body_resolved, status, provider, provider_response, created_at, sent_at)
       VALUES ($1,$2,$3,'SENT','console','OK', NOW(), NOW())
       RETURNING id, to_number, template_id, body_resolved, status, provider, provider_response, created_at, sent_at`,
      [to.trim(), template_id ?? null, resolved]
    );

    res.status(201).json({ ok: true, ...ins.rows[0] });
  } catch (e) {
    console.error('sms:send error', e);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// GET /sms/outbox
router.get('/outbox', async (req, res) => {
  try {
    await ensureOutbox();
    const { rows } = await db.query(
      `SELECT id, to_number, template_id, body_resolved, status, provider, provider_response, created_at, sent_at
       FROM sms_outbox ORDER BY id DESC LIMIT 100`, []
    );
    res.json(rows);
  } catch (e) {
    console.error('sms:outbox error', e);
    res.status(500).json({ error: 'Failed to fetch outbox' });
  }
});

module.exports = router;
