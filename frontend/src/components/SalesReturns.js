// frontend/src/components/SalesReturns.js
import React, { useEffect, useMemo, useState } from 'react';

const API = 'http://localhost:3001';

export default function SalesReturns({ token }) {
  const [saleIdInput, setSaleIdInput] = useState('');
  const [sale, setSale] = useState(null);        // header
  const [saleLines, setSaleLines] = useState([]); // [{item_id, sku, item_name, qty, unit_price, ...}]
  const [returns, setReturns] = useState([]);     // previous returns for this sale
  const [returnQtys, setReturnQtys] = useState({}); // { item_id: qty }
  const [reason, setReason] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [success, setSuccess] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  async function loadSale(id) {
    if (!id) return;
    setLoading(true);
    setErr(null);
    setSuccess(null);
    setReturnQtys({});
    try {
      const [headRes, retRes] = await Promise.all([
        fetch(`${API}/sales/${id}`, { headers }),
        fetch(`${API}/sales/${id}/returns`, { headers })
      ]);
      if (!headRes.ok) {
        const msg = headRes.status === 404 ? 'Sale not found' : `HTTP ${headRes.status}`;
        throw new Error(msg);
      }
      const headJson = await headRes.json();
      const retJson = retRes.ok ? await retRes.json() : [];
      setSale(headJson.header || null);
      setSaleLines(Array.isArray(headJson.lines) ? headJson.lines : []);
      setReturns(Array.isArray(retJson) ? retJson : []);
    } catch (e) {
      setSale(null);
      setSaleLines([]);
      setReturns([]);
      setErr(`Failed to load sale: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // helper: total already returned per item for this sale (sum of return batches)
  const alreadyReturnedByItem = useMemo(() => {
    // We only have headers here. We’ll also fetch details of each return to compute batch quantities.
    // To keep it simple, call detail endpoints in parallel and aggregate.
    return {};
  }, [returns]);

  // On returns change, fetch detail lines+batches to compute already returned per item
  useEffect(() => {
    let ignore = false;
    async function loadReturnDetails() {
      if (!sale || returns.length === 0) {
        if (!ignore) { /* reset? */ }
        return;
      }
      try {
        const resps = await Promise.all(
          returns.map(r => fetch(`${API}/sales/${sale.id}/returns/${r.id}`, { headers }))
        );
        const jsons = await Promise.all(resps.map(r => (r.ok ? r.json() : { batches: [] })));
        const map = new Map(); // item_id -> returned qty
        for (const ret of jsons) {
          const batches = Array.isArray(ret.batches) ? ret.batches : [];
          for (const b of batches) {
            const itemId = Number(b.item_id);
            const q = Number(b.qty || 0);
            map.set(itemId, (map.get(itemId) || 0) + q);
          }
        }
        if (!ignore) {
          // store in state by piggybacking on returnQtys (we won’t render it; compute below)
          setReturnQtys(qs => ({ ...qs })); // trigger render; values computed in memo below
          setAlreadyReturned(map);
        }
      } catch {
        // swallow; we’ll just show 0 previously returned if detail fetch fails
      }
    }
    loadReturnDetails();
    return () => { ignore = true; };
    // eslint-disable-next-line
  }, [returns, sale]);

  const [alreadyReturnedMap, setAlreadyReturned] = useState(new Map());

  // computed per line: remaining returnable
  const rows = useMemo(() => {
    return saleLines.map(ln => {
      const sold = Number(ln.qty || 0);
      const already = Number(alreadyReturnedMap.get(Number(ln.item_id)) || 0);
      const remaining = Math.max(0, sold - already);
      const reqQty = Number(returnQtys[ln.item_id] || 0);
      return {
        ...ln,
        soldQty: sold,
        alreadyReturned: already,
        remaining,
        requestQty: reqQty
      };
    });
  }, [saleLines, alreadyReturnedMap, returnQtys]);

  function setQty(itemId, value) {
    const q = Number(value);
    if (!Number.isInteger(q) || q < 0) return;
    setReturnQtys(prev => ({ ...prev, [itemId]: q }));
  }

  async function submitReturn() {
    setErr(null);
    setSuccess(null);
    if (!sale) { setErr('Load a sale first.'); return; }
    const lines = rows
      .filter(r => Number(r.requestQty) > 0)
      .map(r => ({ item_id: r.item_id, qty: Number(r.requestQty) }));
    if (lines.length === 0) {
      setErr('Enter a return quantity for at least one line.');
      return;
    }
    // validate against remaining
    for (const r of rows) {
      if (r.requestQty > r.remaining) {
        setErr(`Qty for ${r.sku} exceeds remaining returnable.`);
        return;
      }
    }

    const body = {
      reason: reason || null,
      tax_amount: Number(taxAmount || 0),
      lines
    };

    try {
      const res = await fetch(`${API}/sales/${sale.id}/returns`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || `Failed to create return (HTTP ${res.status})`);
        return;
      }
      setSuccess(`Return #${data.id} saved. Total ${money(data.total_amount)}.`);
      // reload sale + returns to reflect updated remaining
      await loadSale(sale.id);
      setReturnQtys({});
      setReason('');
      setTaxAmount('0');
    } catch {
      setErr('Failed to create sale return.');
    }
  }

  // Small helper to fetch a recent list to pick from
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/sales?limit=10`, { headers });
        if (r.ok) {
          const j = await r.json();
          setRecent(Array.isArray(j) ? j : []);
        }
      } catch {}
    })();
    // eslint-disable-next-line
  }, [token, success]);

  return (
    <div>
      <h2>Sales Returns</h2>

      {/* Pick sale */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <label>
          Sale ID<br/>
          <input value={saleIdInput} onChange={e => setSaleIdInput(e.target.value)} placeholder="e.g. 5" />
        </label>
        <button onClick={() => loadSale(Number(saleIdInput))} disabled={loading || !saleIdInput}>Load</button>
        {loading && <span> Loading…</span>}
        {err && <span style={{ color: 'crimson' }}>{err}</span>}
        {success && <span style={{ color: 'green' }}>{success}</span>}
      </div>

      {/* Quick recent picker */}
      <div style={{ marginTop: 8 }}>
        <small>Recent Sales: </small>
        {recent.map(s => (
          <button key={s.id} onClick={() => { setSaleIdInput(String(s.id)); loadSale(s.id); }} style={{ marginRight: 6 }}>
            #{s.id} • {new Date(s.sale_date).toLocaleDateString()} • {money(s.total_amount)}
          </button>
        ))}
      </div>

      {/* Sale summary */}
      {sale && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <div><b>Sale #{sale.id}</b> — {new Date(sale.sale_date).toLocaleString()}</div>
          <div>Total: <b>{money(sale.total_amount)}</b> (Sub {money(sale.sub_total)}, Tax {money(sale.tax_amount)}, Disc {money(sale.discount_amount)})</div>
        </div>
      )}

      {/* Lines with return inputs */}
      {sale && (
        <div style={{ marginTop: 12 }}>
          <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>SKU</th>
                <th>Name</th>
                <th>Sold</th>
                <th>Already Returned</th>
                <th>Remaining</th>
                <th>Return Qty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.item_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td>{r.sku}</td>
                  <td>{r.item_name}</td>
                  <td>{r.soldQty}</td>
                  <td>{r.alreadyReturned}</td>
                  <td>{r.remaining}</td>
                  <td>
                    <input
                      value={r.requestQty || ''}
                      onChange={e => setQty(r.item_id, e.target.value)}
                      style={{ width: 80 }}
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Reason + tax + submit */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginTop: 12, maxWidth: 800 }}>
            <label>
              Reason<br/>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Customer returned" />
            </label>
            <label>
              Tax Amount<br/>
              <input value={taxAmount} onChange={e => setTaxAmount(e.target.value)} />
            </label>
            <div style={{ alignSelf: 'end' }}>
              <button onClick={submitReturn}>Process Return</button>
            </div>
          </div>
        </div>
      )}

      {/* Previous returns list */}
      {sale && (
        <div style={{ marginTop: 20 }}>
          <b>Previous Returns for Sale #{sale.id}</b>
          {returns.length === 0 ? (
            <div>None yet.</div>
          ) : (
            <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Sub Total</th>
                  <th>Tax</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {returns.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td>{r.id}</td>
                    <td>{new Date(r.return_date).toLocaleString()}</td>
                    <td>{r.reason || '-'}</td>
                    <td>{money(r.sub_total)}</td>
                    <td>{money(r.tax_amount)}</td>
                    <td><b>{money(r.total_amount)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function money(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(num);
}
