// frontend/src/components/Suppliers.js
import React, { useEffect, useState } from 'react';

const API = 'http://localhost:3001';

export default function Suppliers({ token }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function loadSuppliers() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(`${API}/suppliers`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSuppliers(); /* eslint-disable-next-line */ }, [token]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    try {
      setSaving(true);
      setErr(null);
      const body = { name: name.trim(), phone: phone || null, email: email || null, address: address || null };
      const res = await fetch(`${API}/suppliers`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Clear the form and reload list
      setName(''); setPhone(''); setEmail(''); setAddress('');
      await loadSuppliers();
    } catch (e) {
      setErr('Failed to create supplier');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>Suppliers</h2>

      <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 700 }}>
        <div style={{ gridColumn: '1 / span 2' }}><b>Add New Supplier</b></div>
        <label>
          Name:<br />
          <input value={name} onChange={e => setName(e.target.value)} required />
        </label>
        <label>
          Phone:<br />
          <input value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <label>
          Email:<br />
          <input value={email} type="email" onChange={e => setEmail(e.target.value)} />
        </label>
        <label style={{ gridColumn: '1 / span 2' }}>
          Address:<br />
          <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} style={{ width: '100%' }} />
        </label>
        <div style={{ gridColumn: '1 / span 2' }}>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Supplier'}</button>
          {err && <span style={{ color: 'crimson', marginLeft: 10 }}>{err}</span>}
        </div>
      </form>

      <div style={{ marginTop: 20 }}>
        <b>Suppliers List</b>
        {loading ? (
          <div>Loading…</div>
        ) : suppliers.length === 0 ? (
          <div>No suppliers yet.</div>
        ) : (
          <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse', marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.phone || '-'}</td>
                  <td>{s.email || '-'}</td>
                  <td>{s.address || '-'}</td>
                  <td>{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
