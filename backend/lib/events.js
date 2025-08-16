// backend/lib/events.js
const db = require('../db');
const { render, dispatch } = require('./smsDispatch');

async function ensureTemplateByName(name, defaultBody) {
  const sel = await db.query('SELECT id, body FROM sms_templates WHERE name=$1', [name]);
  if (sel.rows.length) return sel.rows[0];
  const ins = await db.query(
    'INSERT INTO sms_templates (name, body) VALUES ($1,$2) RETURNING id, body',
    [name, defaultBody]
  );
  return ins.rows[0];
}

async function queueAndSend({ to, templateName, defaultBody, params }) {
  if (!to) return;
  const tpl = await ensureTemplateByName(templateName, defaultBody);
  const text = render(tpl.body, params || {});
  const ins = await db.query(
    `INSERT INTO sms_outbox (to_number, template_id, body_resolved, status, provider)
     VALUES ($1,$2,$3,'QUEUED',$4)
     RETURNING id`,
    [to, tpl.id, text, (process.env.SMS_PROVIDER || 'console')]
  );
  const outboxId = ins.rows[0].id;
  try {
    const result = await dispatch({ to, message: text });
    await db.query(
      `UPDATE sms_outbox
       SET status='SENT', provider_response=$1, sent_at=NOW()
       WHERE id=$2`,
      [JSON.stringify(result.response || {}), outboxId]
    );
  } catch (e) {
    await db.query(
      `UPDATE sms_outbox
       SET status='FAILED', provider_response=$1
       WHERE id=$2`,
      [String(e.message || e), outboxId]
    );
  }
}

async function notifyOrderReady({ saleId, customerId }) {
  if (!process.env.SMS_ORDER_READY_ENABLED || process.env.SMS_ORDER_READY_ENABLED.toLowerCase() !== 'true') return;
  if (!customerId) return;
  const c = await db.query('SELECT name, phone FROM customers WHERE id=$1', [customerId]);
  if (!c.rows.length) return;
  const { name, phone } = c.rows[0];
  if (!phone) return;
  const s = await db.query('SELECT total_amount FROM sales WHERE id=$1', [saleId]);
  const total = s.rows.length ? Number(s.rows[0].total_amount || 0).toFixed(2) : '0.00';

  await queueAndSend({
    to: phone,
    templateName: process.env.SMS_ORDER_READY_TEMPLATE || 'OrderReady',
    defaultBody: 'Hi {{name}}, your order {{sale_id}} totaling {{total}} is ready. Thank you.',
    params: { name: name || 'Customer', sale_id: saleId, total }
  });
}

async function notifyLowStock({ items }) {
  if (!process.env.SMS_LOW_STOCK_ENABLED || process.env.SMS_LOW_STOCK_ENABLED.toLowerCase() !== 'true') return;
  const toList = (process.env.SMS_LOW_STOCK_TO || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (!toList.length) return;

  const ids = Array.from(new Set((items || []).map(it => Number(it.item_id || it.id)).filter(Boolean)));
  if (!ids.length) return;

  const { rows } = await db.query(
    `SELECT id, sku, name, stock_qty, min_stock
     FROM items
     WHERE id = ANY($1::int[])`,
    [ids]
  );

  const alerts = rows.filter(r => Number(r.stock_qty || 0) <= Number(r.min_stock || 0));
  if (!alerts.length) return;

  for (const a of alerts) {
    for (const to of toList) {
      await queueAndSend({
        to,
        templateName: process.env.SMS_LOW_STOCK_TEMPLATE || 'LowStockAlert',
        defaultBody: 'Low stock: {{sku}} {{name}} now {{qty}} (min {{min}}).',
        params: { sku: a.sku, name: a.name, qty: a.stock_qty, min: a.min_stock }
      });
    }
  }
}

async function afterSaleCommitted({ saleId, customerId, items }) {
  // fire and forget
  notifyOrderReady({ saleId, customerId }).catch(() => {});
  notifyLowStock({ items }).catch(() => {});
}

module.exports = { afterSaleCommitted };
