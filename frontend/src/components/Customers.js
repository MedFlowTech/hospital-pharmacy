// frontend/src/components/Customers.js
import React, { useEffect, useState } from 'react';

const API = 'http://localhost:3001';

export default function Customers({ token }) {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // import
  const [csv, setCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  function authHeaders() {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const url = q.trim() ? `${API}/customers?q=${encodeURIComponent(q.trim())}` : `${API}/customers`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setList(await res.json());
    } catch (e) {
      setErr('Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function addCustomer() {
    setMsg(null); setErr(null);
    if (!name.trim()) { setErr('Name is required'); return; }
    try {
      setSaving(true);
      const res = await fetch(`${API}/customers`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, address, notes })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setMsg(`Added ${data.name}`);
      setName(''); setPhone(''); setEmail(''); setAddress(''); setNotes('');
      load();
    } catch (e) {
      setErr(e.message || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) return [];
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const idx = (k) => header.indexOf(k);
    const iName = idx('name'), iPhone = idx('phone'), iEmail = idx('email'), iAddress = idx('address'), iNotes = idx('notes');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      const r = {
        name: cols[iName] || '',
        phone: iPhone >= 0 ? cols[iPhone] || '' : '',
        email: iEmail >= 0 ? cols[iEmail] || '' : '',
        address: iAddress >= 0 ? cols[iAddress] || '' : '',
        notes: iNotes >= 0 ? cols[iNotes] || '' : ''
      };
      if (r.name) rows.push(r);
    }
    return rows;
  }

  async function importCsv() {
    setImportMsg(null); setErr(null);
    const rows = parseCsv(csv);
    if (!rows.length) { setErr('Paste CSV with header: name,phone,email,address,notes'); return; }
    try {
      setImporting(true);
      const res = await fetch(`${API}/customers/import`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setImportMsg(`Imported: ${data.imported}, Duplicates: ${data.duplicates}, Invalid: ${data.invalid}`);
      setCsv('');
      load();
    } catch (e) {
      setErr(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h2>Customers</h2>
      {err && <div style={{ color:'crimson' }}>{err}</div>}
      {msg && <div style={{ color:'green' }}>{msg}</div>}

      {/* Add */}
      <div style={{ border:'1px solid #eee', padding:10, borderRadius:8, marginBottom:12 }}>
        <h3 style={{ marginTop:0 }}>Add Customer</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, maxWidth:900 }}>
          <label>Name<br/><input value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Phone<br/><input value={phone} onChange={e => setPhone(e.target.value)} /></label>
          <label>Email<br/><input value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label style={{ gridColumn:'1 / span 2' }}>Address<br/><input value={address} onChange={e => setAddress(e.target.value)} /></label>
          <label>Notes<br/><input value={notes} onChange={e => setNotes(e.target.value)} /></label>
        </div>
        <div style={{ marginTop:8 }}>
          <button onClick={addCustomer} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
        </div>
      </div>

      {/* Import */}
      <div className="no-print" style={{ border:'1px solid #eee', padding:10, borderRadius:8, marginBottom:12 }}>
        <h3 style={{ marginTop:0 }}>Import CSV</h3>
        <div style={{ marginBottom:6, color:'#555' }}>Header must include at least <code>name</code>. Optional: <code>phone,email,address,notes</code>.</div>
        <textarea
          rows={6}
          placeholder={`name,phone,email,address,notes
John Doe,08012345678,john@example.com,12 High St,VIP
Jane,0805550000,,,""`}
          value={csv}
          onChange={e => setCsv(e.target.value)}
          style={{ width:'100%', maxWidth:900 }}
        />
        <div style={{ marginTop:6 }}>
          <button onClick={importCsv} disabled={importing}>{importing ? 'Importing…' : 'Import'}</button>
          {importMsg && <span style={{ marginLeft:10, color:'green' }}>{importMsg}</span>}
        </div>
      </div>

      {/* List / search */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
        <input placeholder="Search name/phone/email" value={q} onChange={e => setQ(e.target.value)} />
        <button onClick={load}>Search</button>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : list.length === 0 ? (
        <div>No customers.</div>
      ) : (
        <table width="100%" cellPadding="6" style={{ borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
              <th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Notes</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id} style={{ borderBottom:'1px solid #f7f7f7' }}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>{c.phone || '-'}</td>
                <td>{c.email || '-'}</td>
                <td>{c.address || '-'}</td>
                <td>{c.notes || '-'}</td>
                <td>{new Date(c.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
