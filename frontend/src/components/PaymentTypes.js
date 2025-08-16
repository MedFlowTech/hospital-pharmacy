// frontend/src/components/PaymentTypes.js
import React, { useEffect, useState } from 'react';
const API = 'http://localhost:3001';

export default function PaymentTypes({ token }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const headers = {
    Authorization: `Bearer ${token || localStorage.getItem('pharmacyToken') || ''}`,
    'Content-Type': 'application/json'
  };

  async function load() {
    setErr(''); setMsg('');
    try {
      const r = await fetch(`${API}/payment-types`, { headers });
      const data = await r.json().catch(() => []);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setErr('Failed to load');
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function add() {
    setErr(''); setMsg('');
    if (!name.trim()) return setErr('Enter a name');
    const r = await fetch(`${API}/payment-types`, { method:'POST', headers, body: JSON.stringify({ name }) });
    if (!r.ok) {
      const t = await r.text(); setErr(`Add failed: ${r.status} ${t}`); return;
    }
    setName(''); setMsg('Added');
    load();
  }

  async function toggleActive(id, active) {
    setErr(''); setMsg('');
    const r = await fetch(`${API}/payment-types/${id}`, { method:'PUT', headers, body: JSON.stringify({ active }) });
    if (!r.ok) { setErr('Update failed'); return; }
    load();
  }

  return (
    <div>
      <h2>Payment Types</h2>
      {err && <div style={{ color:'crimson' }}>{err}</div>}
      {msg && <div style={{ color:'green' }}>{msg}</div>}

      <div style={{ display:'flex', gap:8, margin:'8px 0' }}>
        <input placeholder="New type (e.g., Cash)" value={name} onChange={e => setName(e.target.value)} />
        <button onClick={add}>Add</button>
      </div>

      <table cellPadding={6} style={{ borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid #ccc' }}>
            <th align="left">ID</th>
            <th align="left">Name</th>
            <th align="left">Active</th>
          </tr>
        </thead>
        <tbody>
          {list.map(pt => (
            <tr key={pt.id} style={{ borderBottom:'1px solid #eee' }}>
              <td>{pt.id}</td>
              <td>{pt.name}</td>
              <td>
                <label>
                  <input
                    type="checkbox"
                    checked={pt.active !== false}
                    onChange={e => toggleActive(pt.id, e.target.checked)}
                  />{' '}
                  {pt.active !== false ? 'Yes' : 'No'}
                </label>
              </td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={3} style={{ padding:12, opacity:0.6 }}>No types</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
