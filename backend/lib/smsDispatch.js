// backend/lib/smsDispatch.js
// Shared render + provider dispatch used by both /sms and backend events.

function render(body, values = {}) {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = values[key];
    return v == null ? '' : String(v);
  });
}

async function sendConsole({ to, message }) {
  console.log(`📨 [console] to=${to} message="${message}"`);
  return { ok: true, provider: 'console', response: { logged: true } };
}

async function sendTwilio({ to, message }) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const tok  = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !tok || !from) {
    throw new Error('Twilio env not set (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)');
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${tok}`).toString('base64');
  const form = new URLSearchParams({ To: to, From: from, Body: message });

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Twilio HTTP ${res.status}: ${JSON.stringify(data)}`);
  return { ok: true, provider: 'twilio', response: data };
}

async function dispatch({ to, message }) {
  const prov = (process.env.SMS_PROVIDER || 'console').toLowerCase();
  if (prov === 'twilio') return sendTwilio({ to, message });
  return sendConsole({ to, message });
}

module.exports = { render, dispatch };
