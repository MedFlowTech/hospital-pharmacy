// frontend/src/components/SalesList.js
import React, { useEffect, useMemo, useState } from 'react';
const API = 'http://localhost:3001';

export default function SalesList({ token, refreshSignal }) {
  const [df, setDf] = useState(() => new Date().toISOString().slice(0,10));
  const [dt, setDt] = useState(() => new Date().toISOString().slice(0,10));
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [paymentTypeId, setPaymentTypeId] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState('');

  const headers = useMemo(() => {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }, [token]);

  // load payment types once
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/payment-types`, { headers });
        const list = await r.json().catch(() => []);
        setPaymentTypes(Array.isArray(list) ? list : []);
      } catch { /* ignore */ }
    })();
  }, [headers]);

  async function load() {
    setErr('');
    try {
      const params = new URLSearchParams();
      if (df) params.set('date_from', df);
      if (dt) params.set('date_to', dt);
      if (paymentTypeId) params.set('payment_type_id', paymentTypeId);

      const [r1, r2] = await Promise.all([
        fetch(`${API}/sales/advanced?` + params.toString(), { headers }),
        fetch(`${API}/sales/summary?date_from=${df}&date_to=${dt}`, { headers })
      ]);
      if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
      if (!r2.ok) throw new Error(`HTTP ${r2.status}`);

      const data = await r1.json();
      const sum  = await r2.json();
      setRows(Array.isArray(data) ? data : []);
      setSummary(sum);
    } catch (e) {
      console.error(e);
      setErr('Failed to load sales');
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [refreshSignal]);

  return (
    <div>
      <h2>Sales</h2>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'end', margin:'8px 0 12px' }}>
        <label>From<br/><input type="date" value={df} onChange={e => setDf(e.target.value)} /></label>
        <label>To<br/><input type="date" value={dt} onChange={e => setDt(e.target.value)} /></label>
        <label>Payment<br/>
          <select value={paymentTypeId} onChange={e => setPaymentTypeId(e.target.value)}>
            <option value="">All</option>
            {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
          </select>
        </label>
        <button onClick={load}>Apply</button>
        {err && <span style={{ color:'crimson' }}>{err}</span>}
      </div>

      {/* Summary */}
      {summary && (
        <div style={{ padding:10, border:'1px solid #eee', borderRadius:6, marginBottom:12 }}>
          <b>Summary {summary.range?.from} → {summary.range?.to}</b>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:6 }}>
            <span>Count: <b>{summary.totals?.sale_count ?? 0}</b></span>
            <span>Sub: <b>{fmt(summary.totals?.sub_total)}</b></span>
            <span>Tax: <b>{fmt(summary.totals?.tax_amount)}</b></span>
            <span>Disc: <b>-{fmt(summary.totals?.discount_amount)}</b></span>
            <span>Total: <b>{fmt(summary.totals?.total_amount)}</b></span>
            <span>| Payments:</span>
            {(summary.payments || []).map(p => (
              <span key={p.id}>{p.name}: <b>{fmt(p.amount)}</b></span>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX:'auto' }}>
        <table cellPadding={6} style={{ borderCollapse:'collapse', width:'100%' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #ccc' }}>
              <th align="left">ID</th>
              <th align="left">Date</th>
              <th align="right">Sub</th>
              <th align="right">Tax</th>
              <th align="right">Disc</th>
              <th align="right">Total</th>
              <th align="right">Paid</th>
              <th align="right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => {
              const paid = Number(s.paid_amount ?? 0);
              const bal = Number(s.total_amount ?? 0) - paid;
              return (
                <tr key={s.id} style={{ borderBottom:'1px solid #eee' }}>
                  <td>{s.id}</td>
                  <td>{new Date(s.sale_date).toLocaleString()}</td>
                  <td align="right">{fmt(s.sub_total)}</td>
                  <td align="right">{fmt(s.tax_amount)}</td>
                  <td align="right">{fmt(s.discount_amount)}</td>
                  <td align="right">{fmt(s.total_amount)}</td>
                  <td align="right">{fmt(paid)}</td>
                  <td align="right" style={{ color: bal > 0 ? 'crimson' : 'inherit' }}>{fmt(bal)}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={8} style={{ padding:12, opacity:0.6 }}>No sales</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(n) {
  return new Intl.NumberFormat(undefined, { style:'currency', currency:'USD' }).format(Number(n || 0));
}
