// frontend/src/components/ItemsList.js
import React, { useEffect, useMemo, useState } from 'react';
const API = 'http://localhost:3001';

export default function ItemsList({ token, refreshSignal }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [br, setBr] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  function authHeaders() {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }

  async function load() {
    setErr(null); setMsg(null);
    const [iRes, cRes, bRes] = await Promise.all([
      fetch(`${API}/items`, { headers: authHeaders() }),
      fetch(`${API}/categories`, { headers: authHeaders() }),
      fetch(`${API}/brands`, { headers: authHeaders() }),
    ]);
    if (!iRes.ok || !cRes.ok || !bRes.ok) { setErr('Failed to load'); return; }
    const [i, c, b] = await Promise.all([iRes.json(), cRes.json(), bRes.json()]);
    setItems(Array.isArray(i) ? i : []);
    setCategories(Array.isArray(c) ? c : []);
    setBrands(Array.isArray(b) ? b : []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, refreshSignal]);

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [String(c.id), c.name])), [categories]);
  const brMap  = useMemo(() => Object.fromEntries(brands.map(b => [String(b.id), b.name])), [brands]);

  const filtered = useMemo(() => {
    let rows = items;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      rows = rows.filter(r =>
        String(r.sku).toLowerCase().includes(s) ||
        String(r.name).toLowerCase().includes(s)
      );
    }
    if (cat) rows = rows.filter(r => String(r.category_id) === String(cat));
    if (br)  rows = rows.filter(r => String(r.brand_id) === String(br));
    if (lowOnly) rows = rows.filter(r => Number(r.stock_qty || 0) <= Number(r.min_stock || 0));
    return rows;
  }, [items, q, cat, br, lowOnly]);

  async function addToReorder(it) {
    setErr(null); setMsg(null);
    const res = await fetch(`${API}/reorders`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: it.id }) // qty auto-computed on backend
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data?.error || `HTTP ${res.status}`); return; }
    setMsg(`Added to reorder: ${it.sku} — ${it.name}`);
  }

  return (
    <div>
      <div style={{ display:'flex', gap:8, alignItems:'center', margin:'8px 0' }}>
        <input placeholder="Search SKU/Name" value={q} onChange={e => setQ(e.target.value)} />
        <select value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={br} onChange={e => setBr(e.target.value)}>
          <option value="">All Brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /> Low stock only</label>
        <button onClick={load}>Refresh</button>
        {msg && <span style={{ color:'green' }}>{msg}</span>}
        {err && <span style={{ color:'crimson' }}>{err}</span>}
      </div>

      <table width="100%" cellPadding="6" style={{ borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
            <th>SKU</th><th>Name</th><th>Category</th><th>Brand</th>
            <th>Stock</th><th>Min</th><th>Max</th><th>Price</th><th>Reorder</th><th>Created</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => {
            const low = Number(r.stock_qty || 0) <= Number(r.min_stock || 0);
            return (
              <tr key={r.id} style={{ borderBottom:'1px solid #f7f7f7', background: low ? '#fff6f6' : undefined }}>
                <td>{r.sku}</td>
                <td>{r.name}</td>
                <td>{catMap[String(r.category_id)] || '-'}</td>
                <td>{brMap[String(r.brand_id)] || '-'}</td>
                <td style={{ color: low ? 'crimson' : undefined }}>{r.stock_qty ?? 0}</td>
                <td>{r.min_stock ?? 0}</td>
                <td>{r.max_stock ?? '-'}</td>
                <td>{money(r.unit_price)}</td>
                <td>
                  <button onClick={() => addToReorder(r)}>Order</button>
                </td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr><td colSpan="10" style={{ color:'#666' }}>No items.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function money(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(num);
}
