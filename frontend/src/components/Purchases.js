// frontend/src/components/Purchases.js
import React, { useEffect, useState } from 'react';

const API = 'http://localhost:3001';

export default function Purchases({ token }) {
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Header fields
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0,10));
  const [taxAmount, setTaxAmount] = useState('0');
  const [notes, setNotes] = useState('');

  // Line form
  const [itemId, setItemId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const [supRes, itemsRes, recRes] = await Promise.all([
          fetch(`${API}/suppliers`, { headers: authHeaders }),
          fetch(`${API}/items`, { headers: authHeaders }),
          fetch(`${API}/purchases?limit=10`, { headers: authHeaders }),
        ]);

        if (!supRes.ok || !itemsRes.ok || !recRes.ok) throw new Error('HTTP');

        const [suppliersJson, itemsJson, recentJson] = await Promise.all([
          supRes.json(), itemsRes.json(), recRes.json()
        ]);

        setSuppliers(Array.isArray(suppliersJson) ? suppliersJson : []);
        setItems(Array.isArray(itemsJson) ? itemsJson : []);
        setRecent(Array.isArray(recentJson) ? recentJson : []);
      } catch (e) {
        setErr('Failed to load data. Try logging in again.');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line
  }, [token, successMsg]); // reload after a successful save

  function addLine(e) {
    e.preventDefault();
    setErr(null);
    setSuccessMsg(null);

    if (!itemId || !batchNo || !qty || !unitCost) {
      setErr('Please fill item, batch, qty and unit cost.');
      return;
    }
    const q = Number(qty);
    const c = Number(unitCost);
    if (!Number.isInteger(q) || q < 0) {
      setErr('Qty must be a non-negative integer.');
      return;
    }
    if (Number.isNaN(c) || c < 0) {
      setErr('Unit cost must be a non-negative number.');
      return;
    }

    const item = items.find(i => String(i.id) === String(itemId));
    const line = {
      item_id: Number(itemId),
      item_name: item ? item.name : `Item ${itemId}`,
      batch_no: batchNo.trim(),
      expiry_date: expiryDate || null,
      qty: q,
      unit_cost: c
    };
    setLines(prev => [...prev, line]);

    // reset line form
    setItemId('');
    setBatchNo('');
    setExpiryDate('');
    setQty('');
    setUnitCost('');
  }

  function removeLine(idx) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  function calcSubTotal() {
    return lines.reduce((sum, ln) => sum + (Number(ln.qty) * Number(ln.unit_cost)), 0);
  }

  async function submitPurchase() {
    setErr(null);
    setSuccessMsg(null);

    if (!supplierId) {
      setErr('Supplier is required.');
      return;
    }
    if (lines.length === 0) {
      setErr('Add at least one line.');
      return;
    }

    const body = {
      supplier_id: Number(supplierId),
      invoice_no: invoiceNo || null,
      purchase_date: purchaseDate || null,
      tax_amount: Number(taxAmount || 0),
      notes: notes || null,
      lines: lines.map(ln => ({
        item_id: ln.item_id,
        batch_no: ln.batch_no,
        expiry_date: ln.expiry_date,
        qty: ln.qty,
        unit_cost: ln.unit_cost
      }))
    };

    try {
      setSaving(true);
      const res = await fetch(`${API}/purchases`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || `Failed to create purchase (HTTP ${res.status})`);
        return;
      }
      setSuccessMsg(`Purchase #${data.id} created (Total ${fmtMoney(data.total_amount)})`);
      // reset header + lines (keep supplier to speed workflow)
      setInvoiceNo('');
      setNotes('');
      setLines([]);
    } catch (e) {
      setErr('Failed to create purchase.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Loading Purchases…</div>;

  return (
    <div>
      <h2>Purchases</h2>

      {/* Header form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, maxWidth: 900 }}>
        <label>
          Supplier<br/>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">– Select –</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        <label>
          Invoice No<br/>
          <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="INV-001" />
        </label>

        <label>
          Purchase Date<br/>
          <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
        </label>

        <label>
          Tax Amount<br/>
          <input value={taxAmount} onChange={e => setTaxAmount(e.target.value)} />
        </label>

        <label style={{ gridColumn: '1 / span 3' }}>
          Notes<br/>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%' }} />
        </label>
      </div>

      {/* Line form */}
      <form onSubmit={addLine} style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10, maxWidth: 900 }}>
        <label style={{ gridColumn: '1 / span 5' }}><b>Add Line</b></label>

        <label>
          Item<br/>
          <select value={itemId} onChange={e => setItemId(e.target.value)}>
            <option value="">– Select –</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
          </select>
        </label>

        <label>
          Batch No<br/>
          <input value={batchNo} onChange={e => setBatchNo(e.target.value)} />
        </label>

        <label>
          Expiry<br/>
          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
        </label>

        <label>
          Qty<br/>
          <input value={qty} onChange={e => setQty(e.target.value)} />
        </label>

        <label>
          Unit Cost<br/>
          <input value={unitCost} onChange={e => setUnitCost(e.target.value)} />
        </label>

        <div style={{ gridColumn: '1 / span 5' }}>
          <button type="submit">Add Line</button>
        </div>
      </form>

      {/* Lines table */}
      <div style={{ marginTop: 12 }}>
        <b>Lines</b>
        {lines.length === 0 ? (
          <div>No lines yet.</div>
        ) : (
          <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse', maxWidth: 900 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>Item</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Line Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td>{ln.item_name}</td>
                  <td>{ln.batch_no}</td>
                  <td>{ln.expiry_date || '-'}</td>
                  <td>{ln.qty}</td>
                  <td>{fmtMoney(ln.unit_cost)}</td>
                  <td><b>{fmtMoney(ln.qty * ln.unit_cost)}</b></td>
                  <td><button onClick={() => removeLine(idx)}>Remove</button></td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}><b>Sub Total</b></td>
                <td colSpan={2}><b>{fmtMoney(calcSubTotal())}</b></td>
              </tr>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}>Tax</td>
                <td colSpan={2}>{fmtMoney(Number(taxAmount || 0))}</td>
              </tr>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}><b>Total</b></td>
                <td colSpan={2}><b>{fmtMoney(calcSubTotal() + Number(taxAmount || 0))}</b></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Actions / messages */}
      <div style={{ marginTop: 12 }}>
        <button onClick={submitPurchase} disabled={saving || !supplierId || lines.length === 0}>
          {saving ? 'Saving…' : 'Save Purchase'}
        </button>
        {err && <span style={{ color: 'crimson', marginLeft: 10 }}>{err}</span>}
        {successMsg && <span style={{ color: 'green', marginLeft: 10 }}>{successMsg}</span>}
      </div>

      {/* Recent purchases */}
      <div style={{ marginTop: 20 }}>
        <b>Recent Purchases</b>
        {recent.length === 0 ? (
          <div>No purchases yet.</div>
        ) : (
          <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse', maxWidth: 900, marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th>ID</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Sub Total</th>
                <th>Tax</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td>{p.id}</td>
                  <td>{p.supplier_name || p.supplier_id}</td>
                  <td>{p.purchase_date}</td>
                  <td>{fmtMoney(p.sub_total)}</td>
                  <td>{fmtMoney(p.tax_amount)}</td>
                  <td><b>{fmtMoney(p.total_amount)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function fmtMoney(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(num);
}
