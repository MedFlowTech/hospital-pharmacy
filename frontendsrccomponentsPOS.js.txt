// frontend/src/components/POS.js
import React, { useEffect, useMemo, useState } from 'react';
import CustomerPicker from './CustomerPicker';

const API = 'http://localhost:3001';

export default function POS({ token }) {
  // Customer
  const [customer, setCustomer] = useState(null); // { id, name } or null

  // Items & search
  const [allItems, setAllItems] = useState([]);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(true);

  // Cart
  // each line: { item_id, sku, name, qty, unit_price, item_stock, batch_id, batch_no, batches:[] }
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');

  // Totals
  const [tax, setTax] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [lastSale, setLastSale] = useState(null); // { header, lines }

  function authHeaders() {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }

  // Load all items once (simple client-side search)
  useEffect(() => {
    (async () => {
      try {
        setItemsLoading(true);
        const res = await fetch(`${API}/items`, { headers: authHeaders() });
        const data = await res.json().catch(() => []);
        setAllItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      } finally {
        setItemsLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [token]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return allItems.slice(0, 20);
    return allItems.filter(i =>
      String(i.sku).toLowerCase().includes(s) ||
      String(i.name).toLowerCase().includes(s)
    ).slice(0, 20);
  }, [allItems, q]);

  function addItem(it) {
    setErr(null); setMsg(null);
    setSearchOpen(false);
    setQ('');
    setCart(prev => {
      // Merge only for same item when NO batch selected
      const idx = prev.findIndex(l => l.item_id === it.id && !l.batch_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Number(next[idx].qty) + 1 };
        return next;
      }
      return [
        ...prev,
        {
          item_id: it.id,
          sku: it.sku,
          name: it.name,
          qty: 1,
          unit_price: Number(it.unit_price || 0),
          item_stock: Number(it.stock_qty ?? 0), // overall available when no batch
          batch_id: null,
          batch_no: null,
          batches: []
        }
      ];
    });
  }

  function updateQty(i, v) {
    setCart(prev => prev.map((l, idx) => idx === i ? { ...l, qty: clampInt(v, 1, 999999) } : l));
  }
  function updatePrice(i, v) {
    setCart(prev => prev.map((l, idx) => idx === i ? { ...l, unit_price: toNumber(v, 0) } : l));
  }
  function removeLine(i) {
    setCart(prev => prev.filter((_, idx) => idx !== i));
  }

  async function loadBatchesFor(i) {
    const line = cart[i];
    if (!line) return;
    try {
      const res = await fetch(`${API}/items/${line.item_id}/batches`, { headers: authHeaders() });
      const data = await res.json().catch(() => []);
      setCart(prev => prev.map((l, idx) => idx === i ? { ...l, batches: Array.isArray(data) ? data : [] } : l));
    } catch {
      // ignore
    }
  }
  function setBatch(i, batchId) {
    const line = cart[i];
    if (!line) return;
    const b = line.batches.find(x => String(x.id) === String(batchId));
    setCart(prev => prev.map((l, idx) => idx === i ? {
      ...l,
      batch_id: b ? b.id : null,
      batch_no: b ? b.batch_no : null
    } : l));
  }

  // Compute available for a line: batch qty if selected, else overall stock
  function availableForLine(l) {
    if (l.batch_id) {
      const b = (l.batches || []).find(x => Number(x.id) === Number(l.batch_id));
      return Number(b?.qty ?? 0);
    }
    return Number(l.item_stock ?? 0);
  }

  // Totals
  const subTotal = useMemo(() => cart.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0), [cart]);
  const total = useMemo(() => Math.max(0,
    Number(subTotal) + Number(toNumber(tax, 0)) - Number(toNumber(discount, 0))
  ), [subTotal, tax, discount]);

  async function saveSale() {
    setErr(null); setMsg(null); setLastSale(null);

    if (cart.length === 0) {
      setErr('Add at least one item.');
      return;
    }
    // Validate quantities and stock
    for (const l of cart) {
      const qty = Number(l.qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        setErr(`Invalid qty for ${l.sku}`);
        return;
      }
      const avail = availableForLine(l);
      if (qty > avail) {
        setErr(`Insufficient stock for ${l.sku}. Need ${qty}, available ${avail}${l.batch_no ? ` (batch ${l.batch_no})` : ''}.`);
        return;
      }
      const price = Number(l.unit_price);
      if (!Number.isFinite(price) || price < 0) {
        setErr(`Invalid price for ${l.sku}`);
        return;
      }
    }

    const payload = {
      sale_date: new Date().toISOString(),
      customer_id: customer?.id || null,
      notes: notes || null,
      sub_total: round2(subTotal),
      tax_amount: round2(toNumber(tax, 0)),
      discount_amount: round2(toNumber(discount, 0)),
      total_amount: round2(total),
      items: cart.map(l => ({
        item_id: l.item_id,
        batch_id: l.batch_id || null,
        qty: Number(l.qty),
        unit_price: round2(l.unit_price),
        line_total: round2(Number(l.qty) * Number(l.unit_price))
      }))
    };

    try {
      setSaving(true);
      const res = await fetch(`${API}/sales`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data?.header?.id) {
        setMsg(`Sale #${data.header.id} created`);
        setLastSale(data);
      } else if (data?.id) {
        setMsg(`Sale #${data.id} created`);
        // fetch detail for printing
        const dres = await fetch(`${API}/sales/${data.id}`, { headers: authHeaders() });
        const det = await dres.json().catch(() => null);
        if (dres.ok && det) setLastSale(det);
      } else {
        setMsg('Sale created');
      }
      // clear cart
      setCart([]);
      setNotes('');
      setTax('0'); setDiscount('0');
    } catch (e) {
      console.error('saveSale error', e);
      setErr(e.message || 'Failed to create sale');
    } finally {
      setSaving(false);
    }
  }

  function printLastReceipt() {
    if (!lastSale || !lastSale.header) return;
    const h = lastSale.header;
    const lines = Array.isArray(lastSale.lines) ? lastSale.lines : [];
    const win = window.open('', 'receipt', 'width=420,height=640');
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
    const itemsHtml = lines.map(ln => `
      <tr>
        <td>${esc(ln.item_name)}<br/><span class="sm">${esc(ln.sku || '')}</span></td>
        <td class="c">${Number(ln.qty || 0)}</td>
        <td class="r">${money(ln.unit_price)}</td>
        <td class="r">${money(ln.line_total)}</td>
      </tr>
    `).join('');
    const html = `
      <html>
        <head><title>Receipt #${h.id}</title>${style}</head>
        <body onload="window.print(); window.close();">
          <div class="c"><b>Pharmacy</b></div>
          <div class="c sm">Receipt #${h.id}</div>
          <div class="sm">Date: ${new Date(h.sale_date).toLocaleString()}</div>
          <div class="sm">Customer: ${esc(h.customer_name || h.customer_id || 'Walk-in')}</div>
          <hr/>
          <table>
            <thead>
              <tr><th style="text-align:left">Item</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Total</th></tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <hr/>
          <table>
            <tr><td class="r" colspan="3">Sub Total</td><td class="r">${money(h.sub_total)}</td></tr>
            <tr><td class="r" colspan="3">Tax</td><td class="r">${money(h.tax_amount)}</td></tr>
            <tr><td class="r" colspan="3">Discount</td><td class="r">-${money(h.discount_amount)}</td></tr>
            <tr><td class="r" colspan="3"><b>Total</b></td><td class="r"><b>${money(h.total_amount)}</b></td></tr>
          </table>
          <hr/>
          <div class="c">Thank you!</div>
        </body>
      </html>
    `;
    win.document.open(); win.document.write(html); win.document.close();
  }

  return (
    <div>
      <h2>POS</h2>
      {err && <div style={{ color:'crimson', marginBottom:8 }}>{err}</div>}
      {msg && (
        <div style={{ color:'green', marginBottom:8 }}>
          {msg}{' '}
          {lastSale?.header?.id && <button onClick={printLastReceipt}>Print Receipt</button>}
        </div>
      )}

      {/* Customer */}
      <div style={{ margin:'8px 0 12px 0' }}>
        <CustomerPicker token={token} value={customer} onChange={setCustomer} />
      </div>

      {/* Search box */}
      <div style={{ position:'relative', maxWidth: 600, marginBottom: 10 }}>
        <input
          placeholder="Search by SKU or name…"
          value={q}
          onChange={e => { setQ(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          style={{ width:'100%' }}
        />
        {searchOpen && (
          <div style={{
            position:'absolute', zIndex:10, background:'#fff', border:'1px solid #ddd',
            borderRadius:6, marginTop:4, width:'100%', maxHeight:300, overflow:'auto',
            boxShadow:'0 8px 24px rgba(0,0,0,0.08)'
          }}>
            {itemsLoading ? (
              <div style={{ padding:10 }}>Loading items…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:10, color:'#666' }}>No matches</div>
            ) : (
              filtered.map(it => (
                <div
                  key={it.id}
                  style={{ padding:'8px 10px', cursor:'pointer' }}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => addItem(it)}
                >
                  <b>{it.sku}</b> — {it.name} <span style={{ color:'#777' }}>(${Number(it.unit_price).toFixed(2)})</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Cart */}
      <table width="100%" cellPadding="6" style={{ borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
            <th>SKU</th><th>Name</th><th>Batch</th><th>Qty</th><th>Price</th><th>Line Total</th><th></th>
          </tr>
        </thead>
        <tbody>
          {cart.length === 0 ? (
            <tr><td colSpan="7" style={{ color:'#666' }}>No items in cart</td></tr>
          ) : cart.map((l, i) => {
            const avail = availableForLine(l);
            const over = Number(l.qty) > avail;
            const selectedBatch = (l.batches || []).find(b => Number(b.id) === Number(l.batch_id));
            return (
              <tr key={`${l.item_id}-${i}`} style={{ borderBottom:'1px solid #f7f7f7' }}>
                <td>{l.sku}</td>
                <td>{l.name}</td>
                <td>
                  {/* Batch selector */}
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <select
                      value={l.batch_id || ''}
                      onChange={e => setBatch(i, e.target.value)}
                      onFocus={() => loadBatchesFor(i)}
                      style={{ minWidth: 180 }}
                    >
                      <option value="">– none –</option>
                      {(l.batches || []).map(b => (
                        <option key={b.id} value={b.id}>
                          {b.batch_no}{b.expiry_date ? ` • exp ${String(b.expiry_date).slice(0,10)}` : ''} • qty {b.qty}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => loadBatchesFor(i)}>↻</button>
                  </div>
                  <div style={{ fontSize:12, color: over ? 'crimson' : '#555' }}>
                    Avail: <b>{avail}</b>
                    {selectedBatch?.expiry_date && <> • Exp: {String(selectedBatch.expiry_date).slice(0,10)}</>}
                    {!l.batch_id && <span style={{ color:'#777' }}> (overall)</span>}
                  </div>
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={l.qty}
                    onChange={e => updateQty(i, e.target.value)}
                    style={{ width:80, borderColor: over ? 'crimson' : undefined }}
                  />
                </td>
                <td>
                  <input
                    value={l.unit_price}
                    onChange={e => updatePrice(i, e.target.value)}
                    style={{ width:100 }}
                  />
                </td>
                <td><b>{money(Number(l.qty) * Number(l.unit_price))}</b></td>
                <td><button onClick={() => removeLine(i)}>Remove</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Notes & totals */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
        <div>
          <div>Notes (optional)</div>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} style={{ width:'100%' }} />
        </div>
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <label>Sub Total<br/><input disabled value={money(subTotal)} /></label>
            <label>Tax<br/><input value={tax} onChange={e => setTax(e.target.value)} /></label>
            <label>Discount<br/><input value={discount} onChange={e => setDiscount(e.target.value)} /></label>
            <label>Total<br/><input disabled value={money(total)} /></label>
          </div>
          <div style={{ marginTop:10, textAlign:'right' }}>
            <button onClick={saveSale} disabled={saving}>{saving ? 'Saving…' : 'Complete Sale'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// helpers
function clampInt(v, min, max) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function toNumber(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}
function money(n) {
  return new Intl.NumberFormat(undefined, { style:'currency', currency:'USD' }).format(Number(n || 0));
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
