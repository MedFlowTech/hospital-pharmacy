// frontend/src/components/Sales.js
import React, { useEffect, useState } from 'react';

const API = 'http://localhost:3001';

// (Optional) tweak these for your print header
const COMPANY = {
  name: 'Your Pharmacy Name',
  address: '123 Main St, City',
  phone: '+000 000 0000'
};

export default function Sales({ token }) {
  const [sales, setSales] = useState([]);
  const [selected, setSelected] = useState(null); // {header, lines}
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  function authHeaders() {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }

  async function loadSales() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(`${API}/sales?limit=50`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSales(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr('Failed to load sales list.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSaleDetail(id) {
    try {
      setErr(null);
      const res = await fetch(`${API}/sales/${id}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSelected(data);
    } catch (e) {
      setErr(`Failed to load sale #${id}.`);
    }
  }

  useEffect(() => { loadSales(); /* eslint-disable-next-line */ }, [token]);

  function fmtMoney(n) {
    const num = Number(n || 0);
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(num);
  }

  function printReceipt(detail) {
    if (!detail || !detail.header) return;
    const h = detail.header;
    const lines = Array.isArray(detail.lines) ? detail.lines : [];
    const win = window.open('', 'printwin', 'width=400,height=600');
    const style = `
      <style>
        * { font-family: Arial, sans-serif; }
        .r { text-align:right; }
        .c { text-align:center; }
        .sm { font-size:12px; color:#444; }
        table { width:100%; border-collapse:collapse; }
        th,td { padding:4px 0; }
        hr { border:none; border-top:1px dashed #999; margin:8px 0; }
      </style>
    `;
    const itemsHtml = lines.map(ln => {
      const name = (ln.item_name || '').toString();
      const qty  = Number(ln.qty || 0);
      const up   = Number(ln.unit_price || 0);
      const lt   = Number(ln.line_total || qty * up);
      return `
        <tr>
          <td>${name}<br/><span class="sm">${ln.sku || ''}</span></td>
          <td class="c">${qty}</td>
          <td class="r">${fmtMoney(up)}</td>
          <td class="r">${fmtMoney(lt)}</td>
        </tr>`;
    }).join('');

    const html = `
      <html>
        <head><title>Receipt #${h.id}</title>${style}</head>
        <body onload="window.print(); window.close();">
          <div class="c"><b>${COMPANY.name}</b></div>
          <div class="c sm">${COMPANY.address}</div>
          <div class="c sm">${COMPANY.phone}</div>
          <hr/>
          <div class="sm">Receipt #: <b>${h.id}</b></div>
          <div class="sm">Date: ${new Date(h.sale_date).toLocaleString()}</div>
          <div class="sm">Customer: ${h.customer_name || h.customer_id || 'Walk-in'}</div>
          <hr/>
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Item</th>
                <th class="c">Qty</th>
                <th class="r">Price</th>
                <th class="r">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <hr/>
          <table>
            <tr><td class="r" colspan="3">Sub Total</td><td class="r">${fmtMoney(h.sub_total)}</td></tr>
            <tr><td class="r" colspan="3">Tax</td><td class="r">${fmtMoney(h.tax_amount)}</td></tr>
            <tr><td class="r" colspan="3">Discount</td><td class="r">-${fmtMoney(h.discount_amount)}</td></tr>
            <tr><td class="r" colspan="3"><b>Total</b></td><td class="r"><b>${fmtMoney(h.total_amount)}</b></td></tr>
          </table>
          <hr/>
          <div class="c">Thank you!</div>
        </body>
      </html>
    `;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  return (
    <div>
      <h2>Sales</h2>
      {err && <div style={{ color:'crimson' }}>{err}</div>}
      {loading ? (
        <div>Loading…</div>
      ) : sales.length === 0 ? (
        <div>No sales yet.</div>
      ) : (
        <table width="100%" cellPadding="6" style={{ borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
              <th>ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th className="r">Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id} style={{ borderBottom:'1px solid #f0f0f0' }}>
                <td>{s.id}</td>
                <td>{new Date(s.sale_date).toLocaleString()}</td>
                <td>{s.customer_name || s.customer_id || 'Walk-in'}</td>
                <td style={{ textAlign:'right' }}>{fmtMoney(s.total_amount)}</td>
                <td>
                  <button onClick={() => loadSaleDetail(s.id)}>View</button>{' '}
                  <button onClick={async () => {
                    const res = await fetch(`${API}/sales/${s.id}`, { headers: authHeaders() });
                    const detail = await res.json().catch(() => ({}));
                    if (res.ok) printReceipt(detail);
                    else alert('Failed to load sale for printing');
                  }}>Print</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Detail panel */}
      {selected && selected.header && (
        <div style={{ marginTop:16, padding:12, border:'1px solid #eee', borderRadius:8 }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <h3 style={{ margin:0 }}>Sale #{selected.header.id}</h3>
            <button onClick={() => printReceipt(selected)}>Print Receipt</button>
            <div style={{ flex:1 }} />
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
          <div style={{ marginTop:6 }}>
            <div>Date: {new Date(selected.header.sale_date).toLocaleString()}</div>
            <div>Customer: {selected.header.customer_name || selected.header.customer_id || 'Walk-in'}</div>
            <div>Notes: {selected.header.notes || '-'}</div>
          </div>
          <table width="100%" cellPadding="6" style={{ borderCollapse:'collapse', marginTop:10 }}>
            <thead>
              <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
                <th>SKU</th>
                <th>Name</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {(selected.lines || []).map(ln => (
                <tr key={ln.id} style={{ borderBottom:'1px solid #f7f7f7' }}>
                  <td>{ln.sku}</td>
                  <td>{ln.item_name}</td>
                  <td>{ln.qty}</td>
                  <td>{fmtMoney(ln.unit_price)}</td>
                  <td><b>{fmtMoney(ln.line_total)}</b></td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} style={{ textAlign:'right' }}>Sub Total</td>
                <td>{fmtMoney(selected.header.sub_total)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign:'right' }}>Tax</td>
                <td>{fmtMoney(selected.header.tax_amount)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign:'right' }}>Discount</td>
                <td>-{fmtMoney(selected.header.discount_amount)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign:'right' }}><b>Total</b></td>
                <td><b>{fmtMoney(selected.header.total_amount)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
