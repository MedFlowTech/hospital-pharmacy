// frontend/src/components/ReturnsList.js
import React, { useEffect, useMemo, useState } from 'react';
const API = 'http://localhost:3001';

export default function ReturnsList({ token }) {
  const [df, setDf] = useState(() => new Date().toISOString().slice(0,10));
  const [dt, setDt] = useState(() => new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState('');

  const headers = useMemo(() => {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }, [token]);

  async function load() {
    setErr(''); setSel(null);
    try {
      const qs = new URLSearchParams({ date_from: df, date_to: dt }).toString();
      const [r1, r2] = await Promise.all([
        fetch(`${API}/sales-returns/advanced?${qs}`, { headers }),
        fetch(`${API}/sales-returns/summary?${qs}`, { headers })
      ]);
      if (!r1.ok || !r2.ok) throw new Error('HTTP ' + (r1.ok ? r2.status : r1.status));
      const data = await r1.json();
      const sum  = await r2.json();
      setRows(Array.isArray(data) ? data : []);
      setSummary(sum);
    } catch (e) {
      console.error(e);
      setErr('Failed to load returns');
    }
  }

  async function viewDetail(id) {
    setErr('');
    try {
      const r = await fetch(`${API}/sales-returns/${id}/detail`, { headers });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setSel(data);
    } catch (e) {
      console.error(e);
      setErr('Failed to load return detail');
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div>
      <h2>Sales Returns — List</h2>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'end', margin:'8px 0 12px' }}>
        <label>From<br/><input type="date" value={df} onChange={e => setDf(e.target.value)} /></label>
        <label>To<br/><input type="date" value={dt} onChange={e => setDt(e.target.value)} /></label>
        <button onClick={load}>Apply</button>
        {err && <span style={{ color:'crimson' }}>{err}</span>}
      </div>

      {summary && (
        <div style={{ padding:10, border:'1px solid #eee', borderRadius:6, marginBottom:12 }}>
          <b>Summary {summary.range?.from} → {summary.range?.to}</b>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:6 }}>
            <span>Count: <b>{summary.totals?.return_count ?? 0}</b></span>
            <span>Sub: <b>{fmt(summary.totals?.sub_total)}</b></span>
            <span>Tax: <b>{fmt(summary.totals?.tax_amount)}</b></span>
            <span>Disc: <b>-{fmt(summary.totals?.discount_amount)}</b></span>
            <span>Total Refund: <b>{fmt(summary.totals?.total_amount)}</b></span>
          </div>
        </div>
      )}

      <div style={{ overflowX:'auto' }}>
        <table cellPadding={6} style={{ borderCollapse:'collapse', width:'100%' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #ccc' }}>
              <th align="left">ID</th>
              <th align="left">Date</th>
              <th align="left">Reason</th>
              <th align="right">Sub</th>
              <th align="right">Tax</th>
              <th align="right">Disc</th>
              <th align="right">Total Refund</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom:'1px solid #eee' }}>
                <td>{r.id}</td>
                <td>{new Date(r.return_date).toLocaleString()}</td>
                <td>{r.reason || '—'}</td>
                <td align="right">{fmt(r.sub_total)}</td>
                <td align="right">{fmt(r.tax_amount)}</td>
                <td align="right">{fmt(r.discount_amount)}</td>
                <td align="right"><b>{fmt(r.total_amount)}</b></td>
                <td><button onClick={() => viewDetail(r.id)}>View</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} style={{ padding:12, opacity:.6 }}>No returns</td></tr>}
          </tbody>
        </table>
      </div>

      {sel && (
        <div style={{ marginTop:16, padding:12, border:'1px solid #eee', borderRadius:6 }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <b>Return #{sel.header?.id}</b>
            <button onClick={() => setSel(null)}>Close</button>
          </div>
          <div style={{ fontSize:13, color:'#555' }}>
            Date: {new Date(sel.header?.return_date).toLocaleString()}
            {sel.header?.reason ? <> • Reason: {sel.header.reason}</> : null}
          </div>
          <table cellPadding={6} style={{ borderCollapse:'collapse', width:'100%', marginTop:8 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #ddd' }}>
                <th align="left">Item</th>
                <th align="left">SKU</th>
                <th align="right">Qty</th>
                <th align="right">Price</th>
                <th align="right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {(sel.lines || []).map(ln => (
                <tr key={ln.id} style={{ borderBottom:'1px solid #f3f3f3' }}>
                  <td>{ln.item_name}</td>
                  <td>{ln.sku}</td>
                  <td align="right">{ln.qty}</td>
                  <td align="right">{fmt(ln.unit_price)}</td>
                  <td align="right">{fmt(ln.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign:'right', marginTop:8 }}>
            <div>Sub: <b>{fmt(sel.header?.sub_total)}</b></div>
            <div>Tax: <b>{fmt(sel.header?.tax_amount)}</b></div>
            <div>Disc: <b>-{fmt(sel.header?.discount_amount)}</b></div>
            <div>Total Refund: <b>{fmt(sel.header?.total_amount)}</b></div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(n) {
  return new Intl.NumberFormat(undefined, { style:'currency', currency:'USD' }).format(Number(n || 0));
}
