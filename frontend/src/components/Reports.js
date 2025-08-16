// frontend/src/components/Reports.js
import React, { useEffect, useMemo, useState } from 'react';

const API = 'http://localhost:3001';

function authHeaders(token) {
  const t = token || localStorage.getItem('pharmacyToken') || '';
  return { Authorization: `Bearer ${t}` };
}

function money(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(num);
}

function toCSV(rows) {
  if (!rows || !rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = v => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ];
  return lines.join('\n');
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports({ token }) {
  // ---- reference data for item/category/brand names
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // ---- STOCK REPORT
  const [items, setItems] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockErr, setStockErr] = useState(null);
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  // ---- EXPIRED BATCHES
  const [expired, setExpired] = useState([]);
  const [expiredLoading, setExpiredLoading] = useState(false);
  const [expiredErr, setExpiredErr] = useState(null);

  // ---- PROFIT & LOSS
  const [pnlFrom, setPnlFrom] = useState('');
  const [pnlTo, setPnlTo] = useState('');
  const [pnl, setPnl] = useState(null);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [pnlErr, setPnlErr] = useState(null);

  // Load reference data once
  useEffect(() => {
    (async () => {
      try {
        const [cRes, bRes] = await Promise.all([
          fetch(`${API}/categories`, { headers: authHeaders(token) }),
          fetch(`${API}/brands`,     { headers: authHeaders(token) }),
        ]);
        const c = await cRes.json().catch(() => []);
        const b = await bRes.json().catch(() => []);
        setCategories(Array.isArray(c) ? c : []);
        setBrands(Array.isArray(b) ? b : []);
      } catch {
        // non-blocking
      }
    })();
    // eslint-disable-next-line
  }, [token]);

  // STOCK REPORT load
  async function loadStock() {
    try {
      setStockLoading(true);
      setStockErr(null);
      // fetch all items then filter locally (keeps backend simple)
      const res = await fetch(`${API}/items?`, { headers: authHeaders(token) });
      const data = await res.json().catch(() => []);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setStockErr('Failed to load items');
    } finally {
      setStockLoading(false);
    }
  }

  useEffect(() => { loadStock(); /* eslint-disable-next-line */ }, [token]);

  const catMap = useMemo(() => {
    const m = new Map();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const brandMap = useMemo(() => {
    const m = new Map();
    for (const b of brands) m.set(b.id, b.name);
    return m;
  }, [brands]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(it =>
        (it.sku || '').toLowerCase().includes(s) ||
        (it.name || '').toLowerCase().includes(s)
      );
    }
    if (lowOnly) {
      list = list.filter(it => Number(it.stock_qty || 0) <= Number(it.min_stock || 0));
    }
    return list;
  }, [items, q, lowOnly]);

  // EXPIRED BATCHES load (on demand)
  async function loadExpired() {
    try {
      setExpiredLoading(true);
      setExpiredErr(null);
      const today = new Date(); today.setHours(0,0,0,0);

      // ensure we have items
      if (items.length === 0) await loadStock();

      const out = [];
      for (const it of items) {
        const res = await fetch(`${API}/items/${it.id}/batches`, { headers: authHeaders(token) });
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          data.forEach(b => {
            if (b.expiry_date) {
              const d = new Date(b.expiry_date);
              d.setHours(0,0,0,0);
              if (d < today) {
                out.push({
                  item_id: it.id,
                  sku: it.sku,
                  name: it.name,
                  category: catMap.get(it.category_id) || '-',
                  brand: brandMap.get(it.brand_id) || '-',
                  batch_no: b.batch_no,
                  expiry_date: b.expiry_date,
                  qty: b.qty
                });
              }
            }
          });
        }
      }
      setExpired(out);
    } catch (e) {
      setExpiredErr('Failed to load expired batches');
    } finally {
      setExpiredLoading(false);
    }
  }

  // P&L load
  async function loadPnL() {
    try {
      setPnlLoading(true);
      setPnlErr(null);
      const qs = new URLSearchParams();
      if (pnlFrom) qs.set('from', pnlFrom);
      if (pnlTo)   qs.set('to', pnlTo);
      const res = await fetch(`${API}/reports/pnl?${qs.toString()}`, { headers: authHeaders(token) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setPnl(data);
    } catch (e) {
      setPnlErr(e.message || 'Failed to load P&L');
    } finally {
      setPnlLoading(false);
    }
  }

  return (
    <div>
      <h2>Reports</h2>

      {/* P&L */}
      <section style={{ marginTop: 10, border:'1px solid #eee', padding:10, borderRadius:8 }}>
        <h3 style={{ marginTop:0 }}>Profit &amp; Loss</h3>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <label>From <input type="date" value={pnlFrom} onChange={e => setPnlFrom(e.target.value)} /></label>
          <label>To <input type="date" value={pnlTo} onChange={e => setPnlTo(e.target.value)} /></label>
          <button onClick={loadPnL} disabled={pnlLoading}>{pnlLoading ? 'Loading…' : 'Run'}</button>
          {pnlErr && <span style={{ color:'crimson' }}>{pnlErr}</span>}
        </div>

        {pnl && (
          <div style={{ marginTop:10, display:'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap:12, maxWidth:900 }}>
            <div style={{ border:'1px solid #ddd', borderRadius:8, padding:10 }}>
              <div><b>Sales</b></div>
              <div>Sub-total: {money(pnl.sales.sub_total)}</div>
              <div>Tax: {money(pnl.sales.tax_total)}</div>
              <div>Discount: {money(pnl.sales.discount_total)}</div>
              <div><b>Total: {money(pnl.sales.sales_total)}</b></div>
            </div>

            <div style={{ border:'1px solid #ddd', borderRadius:8, padding:10 }}>
              <div><b>COGS</b></div>
              <div>{money(pnl.cogs)}</div>
              <div style={{ marginTop:8 }}><b>Gross Profit</b></div>
              <div><b>{money(pnl.gross_profit)}</b></div>
            </div>

            <div style={{ border:'1px solid #ddd', borderRadius:8, padding:10 }}>
              <div><b>Expenses</b></div>
              <div>{money(pnl.expenses)}</div>
              <div style={{ marginTop:8 }}><b>Net Profit</b></div>
              <div><b>{money(pnl.net_profit)}</b></div>
            </div>
          </div>
        )}
      </section>

      {/* Stock Report */}
      <section style={{ marginTop: 16, border:'1px solid #eee', padding:10, borderRadius:8 }}>
        <h3 style={{ marginTop:0 }}>Stock Report</h3>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <input
            placeholder="Search SKU/Name"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <label style={{ display:'flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />
            Low Stock Only
          </label>
          <button onClick={loadStock} disabled={stockLoading}>{stockLoading ? 'Loading…' : 'Refresh'}</button>
          <button
            onClick={() => {
              const rows = filteredItems.map(it => ({
                id: it.id,
                sku: it.sku,
                name: it.name,
                category: catMap.get(it.category_id) || '',
                brand: brandMap.get(it.brand_id) || '',
                stock_qty: it.stock_qty,
                min_stock: it.min_stock,
                max_stock: it.max_stock,
                unit_price: it.unit_price,
                cost_price: it.cost_price,
                created_at: it.created_at
              }));
              download('stock_report.csv', toCSV(rows));
            }}
            disabled={!filteredItems.length}
          >
            Export CSV
          </button>
          {stockErr && <span style={{ color:'crimson' }}>{stockErr}</span>}
        </div>

        {stockLoading ? (
          <div style={{ marginTop:8 }}>Loading…</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ marginTop:8 }}>No items.</div>
        ) : (
          <div style={{ overflowX:'auto', marginTop:8 }}>
            <table cellPadding="6" style={{ borderCollapse:'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
                  <th>ID</th><th>SKU</th><th>Name</th><th>Category</th><th>Brand</th>
                  <th>Stock</th><th>Min</th><th>Max</th><th>Price</th><th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(it => (
                  <tr key={it.id} style={{ borderBottom:'1px solid #f5f5f5' }}>
                    <td>{it.id}</td>
                    <td>{it.sku}</td>
                    <td>{it.name}</td>
                    <td>{catMap.get(it.category_id) || '-'}</td>
                    <td>{brandMap.get(it.brand_id) || '-'}</td>
                    <td>{it.stock_qty}</td>
                    <td>{it.min_stock}</td>
                    <td>{it.max_stock ?? '-'}</td>
                    <td>{money(it.unit_price)}</td>
                    <td>{new Date(it.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Expired Batches */}
      <section style={{ marginTop: 16, border:'1px solid #eee', padding:10, borderRadius:8 }}>
        <h3 style={{ marginTop:0 }}>Expired Batches</h3>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <button onClick={loadExpired} disabled={expiredLoading}>{expiredLoading ? 'Scanning…' : 'Run'}</button>
          <button
            onClick={() => download('expired_batches.csv', toCSV(expired))}
            disabled={!expired.length}
          >
            Export CSV
          </button>
          {expiredErr && <span style={{ color:'crimson' }}>{expiredErr}</span>}
        </div>

        {expiredLoading ? (
          <div style={{ marginTop:8 }}>Scanning item batches…</div>
        ) : expired.length === 0 ? (
          <div style={{ marginTop:8 }}>No expired batches.</div>
        ) : (
          <div style={{ overflowX:'auto', marginTop:8 }}>
            <table cellPadding="6" style={{ borderCollapse:'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
                  <th>Item ID</th><th>SKU</th><th>Name</th><th>Category</th><th>Brand</th>
                  <th>Batch</th><th>Expiry</th><th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {expired.map((b, i) => (
                  <tr key={`${b.item_id}-${b.batch_no}-${i}`} style={{ borderBottom:'1px solid #f5f5f5' }}>
                    <td>{b.item_id}</td>
                    <td>{b.sku}</td>
                    <td>{b.name}</td>
                    <td>{b.category}</td>
                    <td>{b.brand}</td>
                    <td>{b.batch_no}</td>
                    <td>{new Date(b.expiry_date).toLocaleDateString()}</td>
                    <td>{b.qty}</td>
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
