// frontend/src/components/Dashboard.js
import React, { useEffect, useState } from 'react';

const API = 'http://localhost:3001';

export default function Dashboard({ token }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [stock, setStock] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [expired, setExpired] = useState([]);
  const [salesSummary, setSalesSummary] = useState([]);
  const [pnl, setPnl] = useState(null);

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    const fromDate = new Date(today.getTime() - 6 * 24 * 3600 * 1000); // last 7 days
    const from = fromDate.toISOString().slice(0, 10);

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const [
          stockRes,
          lowRes,
          expRes,
          salesRes,
          pnlRes,
        ] = await Promise.all([
          fetch(`${API}/reports/stock`, { headers }),
          fetch(`${API}/reports/low-stock`, { headers }),
          fetch(`${API}/reports/expired?as_of=${to}`, { headers }),
          fetch(`${API}/reports/sales-summary?from=${from}&to=${to}`, { headers }),
          fetch(`${API}/reports/pnl?from=${from}&to=${to}`, { headers }),
        ]);

        if (stockRes.status === 401 || lowRes.status === 401 || expRes.status === 401 || salesRes.status === 401 || pnlRes.status === 401) {
          throw new Error('401');
        }

        const [
          stockJson,
          lowJson,
          expJson,
          salesJson,
          pnlJson,
        ] = await Promise.all([
          stockRes.json(),
          lowRes.json(),
          expRes.json(),
          salesRes.json(),
          pnlRes.json(),
        ]);

        setStock(stockJson || []);
        setLowStock(lowJson || []);
        setExpired(expJson || []);
        setSalesSummary(salesJson || []);
        setPnl(pnlJson || null);
      } catch (e) {
        if (e.message === '401') {
          setErr('Session expired. Please logout and login again.');
        } else {
          setErr('Failed to load dashboard data.');
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  if (loading) return <div>Loading dashboard…</div>;
  if (err) return <div style={{ color: 'crimson' }}>{err}</div>;

  const totalItems = stock.length;
  const lowCount = lowStock.length;
  const expiredCount = expired.length;
  const revenue = pnl?.revenue ?? 0;
  const cogs = pnl?.cogs ?? 0;
  const profit = pnl?.profit ?? 0;
  const grossMargin = pnl?.gross_margin ?? 0;

  return (
    <div>
      <h2>Dashboard</h2>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: '12px' }}>
        <KpiCard title="Items" value={totalItems} />
        <KpiCard title="Low Stock" value={lowCount} />
        <KpiCard title="Expired Batches" value={expiredCount} />
        <KpiCard title="Profit (7d)" value={formatMoney(profit)} sub={`GM: ${(grossMargin*100).toFixed(1)}%`} />
      </div>

      {/* Sales Summary (7 days) */}
      <section style={{ marginTop: '24px' }}>
        <h3>Sales (Last 7 days)</h3>
        {salesSummary.length === 0 ? (
          <div>No sales yet.</div>
        ) : (
          <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>Date</th>
                <th>Count</th>
                <th>Sub Total</th>
                <th>Tax</th>
                <th>Discount</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {salesSummary.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td>{formatDay(r.day)}</td>
                  <td>{r.sales_count}</td>
                  <td>{formatMoney(r.sub_total || 0)}</td>
                  <td>{formatMoney(r.tax_amount || 0)}</td>
                  <td>{formatMoney(r.discount_amount || 0)}</td>
                  <td><b>{formatMoney(r.total_amount || 0)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Low Stock Table */}
      <section style={{ marginTop: '24px' }}>
        <h3>Low Stock</h3>
        {lowStock.length === 0 ? (
          <div>All good — nothing below minimum.</div>
        ) : (
          <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>SKU</th>
                <th>Name</th>
                <th>Stock</th>
                <th>Min</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.slice(0, 10).map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td>{row.stock_qty}</td>
                  <td>{row.min_stock}</td>
                  <td>{row.max_stock ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Top Items snapshot */}
      <section style={{ marginTop: '24px' }}>
        <h3>Top Items by Stock</h3>
        {stock.length === 0 ? (
          <div>No items yet.</div>
        ) : (
          <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {[...stock]
                .sort((a, b) => (b.stock_qty ?? 0) - (a.stock_qty ?? 0))
                .slice(0, 10)
                .map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td>{row.sku}</td>
                    <td>{row.name}</td>
                    <td>{row.category_name ?? '-'}</td>
                    <td>{row.brand_name ?? '-'}</td>
                    <td>{row.stock_qty}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function KpiCard({ title, value, sub }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 12, color: '#666' }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: '#999' }}>{sub}</div> : null}
    </div>
  );
}

function formatMoney(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(num);
}

function formatDay(d) {
  // d may be like "2025-08-09T00:00:00.000Z" from PG date_trunc
  try {
    const dt = new Date(d);
    return dt.toISOString().slice(0, 10);
  } catch {
    return String(d);
  }
}
