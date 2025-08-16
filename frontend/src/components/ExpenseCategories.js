// frontend/src/components/ExpenseCategories.js
import React, { useEffect, useState } from 'react';
const API = 'http://localhost:3001';

export default function ExpenseCategories({ token }) {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState(null);

  function authHeaders() {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }

  async function load() {
    const res = await fetch(`${API}/expense-categories`, { headers: authHeaders() });
    const data = await res.json().catch(() => []);
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function add() {
    setErr(null);
    if (!name.trim()) { setErr('name is required'); return; }
    const res = await fetch(`${API}/expense-categories`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data?.error || 'Failed'); return; }
    setName(''); setDescription(''); load();
  }

  return (
    <div>
      <h3>Expense Categories</h3>
      {err && <div style={{ color:'crimson' }}>{err}</div>}
      <div style={{ display:'flex', gap:8, alignItems:'end', marginBottom:8 }}>
        <label>Name<br/><input value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Description<br/><input value={description} onChange={e => setDescription(e.target.value)} /></label>
        <button onClick={add}>Add</button>
      </div>
      <ul>
        {rows.map(r => <li key={r.id}><b>{r.name}</b> — {r.description || '-'}</li>)}
      </ul>
    </div>
  );
}
