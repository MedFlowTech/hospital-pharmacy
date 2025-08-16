// frontend/src/components/Labels.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

const API = 'http://localhost:3001';

export default function Labels({ token }) {
  // Data
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Selection
  const [itemId, setItemId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [labelType, setLabelType] = useState('BARCODE'); // 'BARCODE' | 'QR'
  const [count, setCount] = useState('1');

  // Display options
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBatch, setShowBatch] = useState(true);
  const [showExpiry, setShowExpiry] = useState(true);
  const [codeBelow, setCodeBelow] = useState(false); // print code text below barcode

  // Sheet layout (mm)
  const [cols, setCols] = useState(3);
  const [labelW, setLabelW] = useState(64); // mm
  const [labelH, setLabelH] = useState(34); // mm
  const [gap, setGap] = useState(3);        // mm
  const [margin, setMargin] = useState(10); // mm page margin

  // Labels on sheet
  const [labels, setLabels] = useState([]); // array of LabelModel

  function authHeaders() {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }

  // Load items initially
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(`${API}/items`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr('Failed to load items.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [token]);

  // Load batches when item changes
  useEffect(() => {
    setBatchId('');
    if (!itemId) { setBatches([]); return; }
    (async () => {
      try {
        const res = await fetch(`${API}/items/${itemId}/batches`, { headers: authHeaders() });
        if (!res.ok) { setBatches([]); return; }
        const data = await res.json();
        setBatches(Array.isArray(data) ? data : []);
      } catch {
        setBatches([]);
      }
    })();
    // eslint-disable-next-line
  }, [itemId, token]);

  const itemMap = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(Number(it.id), it);
    return m;
  }, [items]);

  // Add the selected item/batch as N labels
  function addToSheet() {
    setErr(null);
    if (!itemId) { setErr('Select an item.'); return; }
    const it = itemMap.get(Number(itemId));
    if (!it) { setErr('Invalid item.'); return; }

    const n = Number(count || 1);
    if (!Number.isInteger(n) || n <= 0) { setErr('Count must be a positive integer.'); return; }

    // batch details
    const b = batches.find(x => String(x.id) === String(batchId));
    const label = {
      id: cryptoRandom(),           // client id
      type: labelType,              // 'BARCODE'|'QR'
      sku: it.sku,
      name: it.name,
      price: it.unit_price,
      batch_no: b ? b.batch_no : null,
      expiry_date: b && b.expiry_date ? String(b.expiry_date).slice(0,10) : null,
      opts: {
        showName, showPrice, showBatch, showExpiry, codeBelow
      }
    };

    setLabels(prev => [...prev, ...Array.from({ length: n }, () => ({ ...label, id: cryptoRandom() }))]);
  }

  function clearSheet() { setLabels([]); }

  function removeLabel(id) { setLabels(prev => prev.filter(l => l.id !== id)); }

  function printSheet() { window.print(); }

  if (loading) return <div>Loading Labels…</div>;

  return (
    <div>
      {/* Print styles & grid sizing */}
      <style>{printCSS({ cols, labelW, labelH, gap, margin })}</style>

      <h2>Barcode / Label Printing</h2>
      {err && <div style={{ color:'crimson', marginBottom: 8 }}>{err}</div>}

      {/* Controls */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1fr 1fr 1fr', gap:10, maxWidth:1100, alignItems:'end' }}>
        <label>
          Item<br/>
          <select value={itemId} onChange={e => setItemId(e.target.value)}>
            <option value="">– Select –</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
          </select>
        </label>

        <label>
          Batch (optional)<br/>
          <select value={batchId} onChange={e => setBatchId(e.target.value)} disabled={!batches.length}>
            <option value="">– None –</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>
                {b.batch_no} {b.expiry_date ? `• exp ${String(b.expiry_date).slice(0,10)}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label>
          Type<br/>
          <select value={labelType} onChange={e => setLabelType(e.target.value)}>
            <option value="BARCODE">Barcode (Code128)</option>
            <option value="QR">QR</option>
          </select>
        </label>

        <label>
          Count<br/>
          <input value={count} onChange={e => setCount(e.target.value)} />
        </label>

        <div>
          <button onClick={addToSheet}>Add to Sheet</button>
        </div>

        {/* Options row */}
        <div style={{ gridColumn:'1 / span 5', display:'flex', gap:12, flexWrap:'wrap' }}>
          <label><input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} /> Name</label>
          <label><input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} /> Price</label>
          <label><input type="checkbox" checked={showBatch} onChange={e => setShowBatch(e.target.checked)} /> Batch</label>
          <label><input type="checkbox" checked={showExpiry} onChange={e => setShowExpiry(e.target.checked)} /> Expiry</label>
          <label><input type="checkbox" checked={codeBelow} onChange={e => setCodeBelow(e.target.checked)} /> Code text under barcode</label>
        </div>

        {/* Layout row */}
        <div style={{ gridColumn:'1 / span 5', display:'flex', gap:12, flexWrap:'wrap', alignItems:'end' }}>
          <div><b>Layout (A4)</b></div>
          <label>Cols<br/><input value={cols} onChange={e => setCols(intOr(cols, e.target.value))} style={{ width:60 }} /></label>
          <label>Label W (mm)<br/><input value={labelW} onChange={e => setLabelW(intOr(labelW, e.target.value))} style={{ width:80 }} /></label>
          <label>Label H (mm)<br/><input value={labelH} onChange={e => setLabelH(intOr(labelH, e.target.value))} style={{ width:80 }} /></label>
          <label>Gap (mm)<br/><input value={gap} onChange={e => setGap(intOr(gap, e.target.value))} style={{ width:70 }} /></label>
          <label>Margin (mm)<br/><input value={margin} onChange={e => setMargin(intOr(margin, e.target.value))} style={{ width:80 }} /></label>
          <div style={{ marginLeft:'auto' }}>
            <button onClick={clearSheet} style={{ marginRight: 8 }}>Clear</button>
            <button onClick={printSheet}>Print</button>
          </div>
        </div>
      </div>

      {/* Sheet preview */}
      <div className="sheet">
        {labels.length === 0 ? (
          <div style={{ padding: 12, color:'#666' }}>No labels yet — add some above.</div>
        ) : (
          labels.map(l => (
            <LabelCard key={l.id} data={l} onRemove={() => removeLabel(l.id)} />
          ))
        )}
      </div>
    </div>
  );
}

// One label card
function LabelCard({ data, onRemove }) {
  const { type, sku, name, price, batch_no, expiry_date, opts } = data;
  const codeValue = type === 'QR'
    ? JSON.stringify({ sku, batch: batch_no || undefined, exp: expiry_date || undefined })
    : sku;

  return (
    <div className="label">
      <div className="label-body">
        {type === 'BARCODE'
          ? <Barcode value={codeValue} displayValue={opts.codeBelow} />
          : <QR value={codeValue} />
        }
        {opts.showName && <div className="line name">{name}</div>}
        <div className="meta">
          {opts.showPrice && <span className="chip">Price: {money(price)}</span>}
          {opts.showBatch && batch_no && <span className="chip">Batch: {batch_no}</span>}
          {opts.showExpiry && expiry_date && <span className="chip">EXP: {expiry_date}</span>}
        </div>
      </div>
      <button className="remove no-print" onClick={onRemove}>×</button>
    </div>
  );
}

// Barcode (Code128) using JsBarcode
function Barcode({ value, displayValue }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      try {
        JsBarcode(ref.current, value, {
          format: 'CODE128',
          width: 2,
          height: 40,
          displayValue: !!displayValue,
          fontSize: 12,
          margin: 0,
        });
      } catch { /* noop */ }
    }
  }, [value, displayValue]);
  return <svg ref={ref} />;
}

// QR using qrcode
function QR({ value }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = await QRCode.toDataURL(value, { width: 100, margin: 0 });
        if (alive) setSrc(url);
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, [value]);
  return src ? <img alt="qr" src={src} style={{ width: 100, height: 100 }} /> : <div style={{ width: 100, height: 100 }} />;
}

// Utils / styles
function money(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(num);
}
function intOr(prev, v) { const n = Number(v); return Number.isFinite(n) ? n : prev; }
function cryptoRandom() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function printCSS({ cols, labelW, labelH, gap, margin }) {
  return `
    :root {
      --cols:${cols};
      --w:${labelW}mm;
      --h:${labelH}mm;
      --gap:${gap}mm;
      --margin:${margin}mm;
    }
    .no-print { display: inline-block; }
    @media print { .no-print { display: none !important; } }

    body { font-family: Arial, sans-serif; }
    .sheet {
      margin: var(--margin);
      display: grid;
      grid-template-columns: repeat(var(--cols), var(--w));
      gap: var(--gap);
    }
    .label {
      position: relative;
      width: var(--w);
      height: var(--h);
      border: 1px dashed #ddd;
      padding: 4px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .label-body {
      width: 100%;
      text-align: center;
    }
    .label .name {
      font-size: 12px;
      font-weight: 600;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .label .meta {
      margin-top: 2px;
      display: flex;
      gap: 4px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .label .chip {
      font-size: 10px;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 3px;
      padding: 0 3px;
    }
    .label .remove {
      position: absolute;
      top: 2px;
      right: 2px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
      width: 18px;
      height: 18px;
      line-height: 14px;
      text-align: center;
      font-weight: 700;
      color: #666;
    }
    @page { size: A4; margin: var(--margin); }
  `;
}
