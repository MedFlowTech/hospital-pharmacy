// frontend/src/components/SMS.js
import React, { useEffect, useState } from 'react';
const API = 'http://localhost:3001';

function authHeaders(token) {
  const t = token || localStorage.getItem('pharmacyToken') || '';
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
}

export default function SMS({ token }) {
  const [templates, setTemplates] = useState([]);
  const [tplName, setTplName] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [to, setTo] = useState('');
  const [selectedTpl, setSelectedTpl] = useState('');
  const [params, setParams] = useState('{}'); // JSON string
  const [plainBody, setPlainBody] = useState('');
  const [outbox, setOutbox] = useState([]);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  async function loadTemplates() {
    const res = await fetch(`${API}/sms/templates`, { headers: authHeaders(token) });
    const data = await res.json().catch(() => []);
    setTemplates(Array.isArray(data) ? data : []);
  }
  async function loadOutbox() {
    const res = await fetch(`${API}/sms/outbox`, { headers: authHeaders(token) });
    const data = await res.json().catch(() => []);
    setOutbox(Array.isArray(data) ? data : []);
  }

  useEffect(() => { loadTemplates(); loadOutbox(); /* eslint-disable-next-line */ }, [token]);

  async function addTemplate() {
    setErr(null); setInfo(null);
    if (!tplName.trim() || !tplBody.trim()) { setErr('Template name & body are required'); return; }
    const res = await fetch(`${API}/sms/templates`, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ name: tplName.trim(), body: tplBody })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data?.error || `HTTP ${res.status}`); return; }
    setTplName(''); setTplBody(''); loadTemplates();
    setInfo('Template created');
  }

  async function sendSMS() {
    setErr(null); setInfo(null);
    if (!to.trim()) { setErr('"To" number is required'); return; }

    let body = null, template_id = null, paramsObj = null;
    if (selectedTpl) {
      try { paramsObj = JSON.parse(params || '{}'); }
      catch { setErr('Params must be valid JSON'); return; }
      template_id = Number(selectedTpl);
    } else {
      if (!plainBody.trim()) { setErr('Provide a template or plain body'); return; }
      body = plainBody;
    }

    const payload = { to: to.trim() };
    if (template_id) { payload.template_id = template_id; payload.params = paramsObj || {}; }
    else { payload.body = body; }

    const res = await fetch(`${API}/sms/send`, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data?.error || `HTTP ${res.status}`); return; }
    setInfo(`Sent via provider`);
    setPlainBody(''); setSelectedTpl(''); setParams('{}');
    loadOutbox();
  }

  return (
    <div>
      <h2>SMS</h2>
      {err && <div style={{ color:'crimson' }}>{err}</div>}
      {info && <div style={{ color:'green' }}>{info}</div>}

      {/* Templates manager */}
      <section style={{ border:'1px solid #eee', padding:10, borderRadius:8, marginBottom:12 }}>
        <h3 style={{ marginTop:0 }}>Templates</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr auto', gap:8, maxWidth:900 }}>
          <label>Name<br/>
            <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="ReadyForPickup" />
          </label>
          <label>Body<br/>
            <input value={tplBody} onChange={e => setTplBody(e.target.value)} placeholder="Hi {{name}}, order {{order_no}} is ready." />
          </label>
          <div style={{ alignSelf:'end' }}>
            <button onClick={addTemplate}>Add</button>
          </div>
        </div>

        <ul style={{ marginTop:10 }}>
          {templates.map(t => (
            <li key={t.id}><b>{t.name}</b> — <code>{t.body}</code></li>
          ))}
          {templates.length === 0 && <li>No templates yet.</li>}
        </ul>
      </section>

      {/* Send SMS */}
      <section style={{ border:'1px solid #eee', padding:10, borderRadius:8, marginBottom:12 }}>
        <h3 style={{ marginTop:0 }}>Send</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, maxWidth:900 }}>
          <label>To (phone)<br/>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="+2348012345678" />
          </label>
          <label>Use Template?<br/>
            <select value={selectedTpl} onChange={e => setSelectedTpl(e.target.value)}>
              <option value="">— none —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>

        {selectedTpl ? (
          <div style={{ marginTop:8 }}>
            <label>Params (JSON) for placeholders<br/>
              <textarea rows={3} style={{ width:'100%' }} value={params} onChange={e => setParams(e.target.value)} placeholder='{"name":"Ola","order_no":"A123"}' />
            </label>
          </div>
        ) : (
          <div style={{ marginTop:8 }}>
            <label>Plain Message Body<br/>
              <textarea rows={3} style={{ width:'100%' }} value={plainBody} onChange={e => setPlainBody(e.target.value)} />
            </label>
          </div>
        )}

        <div style={{ marginTop:8 }}>
          <button onClick={sendSMS}>Send</button>
        </div>
      </section>

      {/* Outbox */}
      <section style={{ border:'1px solid #eee', padding:10, borderRadius:8 }}>
        <h3 style={{ marginTop:0 }}>Outbox (latest)</h3>
        <button onClick={loadOutbox} style={{ marginBottom:8 }}>Refresh</button>
        {outbox.length === 0 ? (
          <div>No messages.</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table cellPadding="6" style={{ borderCollapse:'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
                  <th>ID</th><th>To</th><th>Status</th><th>Provider</th><th>Body</th><th>Created</th><th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {outbox.map(r => (
                  <tr key={r.id} style={{ borderBottom:'1px solid #f5f5f5' }}>
                    <td>{r.id}</td>
                    <td>{r.to_number}</td>
                    <td>{r.status}</td>
                    <td>{r.provider}</td>
                    <td style={{ maxWidth:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.body_resolved}</td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.sent_at ? new Date(r.sent_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
