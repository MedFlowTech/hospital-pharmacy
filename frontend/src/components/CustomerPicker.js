// frontend/src/components/CustomerPicker.js
import React, { useEffect, useMemo, useRef, useState } from 'react';

const API = 'http://localhost:3001';

export default function CustomerPicker({ token, value, onChange }) {
  // value: { id, name } or null
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  function authHeaders() {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }

  // click-outside to close
  useEffect(() => {
    const h = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // debounce search
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(async () => {
      try {
        setLoading(true);
        const url = q.trim()
          ? `${API}/customers?q=${encodeURIComponent(q.trim())}`
          : `${API}/customers`;
        const res = await fetch(url, { headers: authHeaders() });
        const data = await res.json().catch(() => []);
        setList(Array.isArray(data) ? data.slice(0, 20) : []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [q, open]);

  const selectedLabel = useMemo(() => value ? `${value.name} #${value.id}` : '— none —', [value]);

  async function quickAdd() {
    const name = q.trim();
    if (!name) return;
    const res = await fetch(`${API}/customers`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.id) {
      onChange({ id: data.id, name: data.name });
      setQ('');
      setOpen(false);
    } else {
      alert(data?.error || 'Failed to add customer');
    }
  }

  return (
    <div ref={boxRef} style={{ position:'relative', maxWidth: 420 }}>
      <div style={{ marginBottom: 4, color:'#444' }}>
        <b>Customer</b> <span style={{ color:'#777' }}>(optional)</span>
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          placeholder="Search or type new name…"
          onFocus={() => setOpen(true)}
          style={{ flex:1 }}
        />
        <button type="button" onClick={() => onChange(null)}>Clear</button>
        <button type="button" onClick={quickAdd} disabled={!q.trim()}>Add</button>
      </div>

      <div style={{ marginTop: 6, fontSize: 13, color:'#333' }}>
        Selected: <b>{selectedLabel}</b>
      </div>

      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:10,
          background:'#fff', border:'1px solid #ddd', borderRadius:6,
          marginTop:6, maxHeight:240, overflow:'auto', boxShadow:'0 6px 24px rgba(0,0,0,0.08)'
        }}>
          {loading ? (
            <div style={{ padding:10 }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ padding:10, color:'#666' }}>No results</div>
          ) : (
            list.map(c => (
              <div
                key={c.id}
                onClick={() => { onChange({ id: c.id, name: c.name }); setOpen(false); }}
                style={{ padding:'8px 10px', cursor:'pointer' }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div><b>{c.name}</b></div>
                <div style={{ fontSize:12, color:'#666' }}>{c.phone || c.email || '—'}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
