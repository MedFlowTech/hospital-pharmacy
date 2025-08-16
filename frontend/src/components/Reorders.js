// frontend/src/components/Reorders.js
import React, { useEffect, useState } from 'react';
const API = 'http://localhost:3001';

export default function Reorders({ token }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('pending'); // pending | ordered | all
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  function authHeaders() {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }

  async function load() {
    try {
      setLoading(true); setErr(null);
      const res = await fetch(`${API}/reorders?status=${status}`, { headers: authHeaders() });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, token]);

  async function saveRow(r) {
    setMsg(null); setErr(null);
    const res = await fetch(`${API}/reorders/${r.id}`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requested_qty: Number(r.requested_qty),
        supplier_id: r.supplier_id || null,
        notes: r.notes || null
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data?.error || 'Save failed'); return; }
    setMsg('Saved'); load();
  }

  async function markOrdered(id) {
    setMsg(null); setErr(null);
    const res = await fetch(`${API}/reorders/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ordered' })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data?.error || 'Failed'); return; }
    setMsg('Marked ordered'); load();
  }

  async function removeRow(id) {
    if (!window.confirm('Remove this reorder?')) return;
    const res = await fetch(`${API}/reorders/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) { setErr('Delete failed'); return; }
    setMsg('Removed'); load();
  }

  function onEdit(id, field, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  return (
    <div>
      <h2>Reorders</h2>
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="ordered">Ordered</option>
          <option value="all">All</option>
        </select>
        <button onClick={load}>Refresh</button>
        {msg && <span style={{ color:'green' }}>{msg}</span>}
        {err && <span style={{ color:'crimson' }}>{err}</span>}
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div>No rows.</div>
      ) : (
        <table width="100%" cellPadding="6" style={{ borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
              <th>When</th>
              <th>SKU</th>
              <th>Name</th>
              <th>Stock</th>
              <th>Min</th>
              <th>Req Qty</th>
              <th>Supplier</th>
              <th>Notes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom:'1px solid #f7f7f7' }}>
                <td title={r.created_at}>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.sku}</td>
                <td>{r.name}</td>
                <td>{r.stock_qty}</td>
                <td>{r.min_stock ?? 0}</td>
                <td><input
                      type="number"
                      min="1"
                      value={r.requested_qty || 1}
                      onChange={e => onEdit(r.id, 'requested_qty', Math.max(1, Number(e.target.value)))}
                      style={{ width:90 }}
                    /></td>
                <td>
                  <input
                    placeholder="Supplier ID (optional)"
                    value={r.supplier_id || ''}
                    onChange={e => onEdit(r.id, 'supplier_id', e.target.value)}
                    style={{ width:130 }}
                  />
                  {r.supplier_name ? <div style={{ fontSize:12, color:'#666' }}>{r.supplier_name}</div> : null}
                </td>
                <td><input
                      value={r.notes || ''}
                      onChange={e => onEdit(r.id, 'notes', e.target.value)}
                      style={{ width:180 }}
                    /></td>
                <td>{r.status}</td>
                <td style={{ display:'flex', gap:6 }}>
                  <button onClick={() => saveRow(r)}>Save</button>
                  {r.status === 'pending' && <button onClick={() => markOrdered(r.id)}>Mark Ordered</button>}
                  <button onClick={() => removeRow(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
