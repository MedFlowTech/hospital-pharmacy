// frontend/src/components/Expenses.js
import React, { useEffect, useMemo, useState } from 'react';

const API = 'http://localhost:3001';

export default function Expenses({ token }) {
  const [cats, setCats] = useState([]);
  const [rows, setRows] = useState([]);
  const [sum, setSum] = useState({ overall: 0, by_category: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // filters
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cat, setCat] = useState('');

  // add form
  const [expenseDate, setExpenseDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('');

  function authHeaders() {
    const t = token || localStorage.getItem('pharmacyToken') || '';
    return { Authorization: `Bearer ${t}` };
  }

  async function loadCats() {
    const res = await fetch(`${API}/expense-categories`, { headers: authHeaders() });
    const data = await res.json().catch(() => []);
    setCats(Array.isArray(data) ? data : []);
  }

  async function loadRows() {
    try {
      setLoading(true);
      setErr(null);
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (cat) qs.set('category_id', cat);
      const [listRes, sumRes] = await Promise.all([
        fetch(`${API}/expenses?${qs.toString()}`, { headers: authHeaders() }),
        fetch(`${API}/expenses/summary?${qs.toString()}`, { headers: authHeaders() })
      ]);
      const list = await listRes.json().catch(() => []);
      const summary = await sumRes.json().catch(() => ({ overall: 0, by_category: [] }));
      setRows(Array.isArray(list) ? list : []);
      setSum(summary || { overall: 0, by_category: [] });
    } catch (e) {
      setErr('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCats(); loadRows(); /* eslint-disable-next-line */ }, [token]);

  async function addExpense() {
    setErr(null);
    if (!categoryId) { setErr('Select category'); return; }
    const body = {
      expense_date: expenseDate || undefined,
      category_id: Number(categoryId),
      description: description || undefined,
      amount: Number(amount),
      payment_type: paymentType || undefined
    };
    try {
      const res = await fetch(`${API}/expenses`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      // reset & refresh
      setExpenseDate(''); setCategoryId(''); setDescription(''); setAmount(''); setPaymentType('');
      loadRows();
    } catch (e) {
      setErr(e.message || 'Failed to add expense');
    }
  }

  function money(n) {
    const num = Number(n || 0);
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(num);
  }

  const totalShown = useMemo(() => rows.reduce((a, r) => a + Number(r.amount || 0), 0), [rows]);

  return (
    <div>
      <h2>Expenses</h2>
      {err && <div style={{ color:'crimson' }}>{err}</div>}

      {/* Add expense */}
      <div style={{ border:'1px solid #eee', padding:10, borderRadius:8, marginBottom:12 }}>
        <h3 style={{ marginTop:0 }}>Add Expense</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr 1fr 1fr', gap:8, maxWidth:1000 }}>
          <label>Date<br/>
            <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
          </label>
          <label>Category<br/>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">– Select –</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Description<br/>
            <input value={description} onChange={e => setDescription(e.target.value)} />
          </label>
          <label>Amount<br/>
            <input value={amount} onChange={e => setAmount(e.target.value)} />
          </label>
          <label>Payment Type<br/>
            <input value={paymentType} onChange={e => setPaymentType(e.target.value)} placeholder="CASH / CARD / BANK" />
          </label>
        </div>
        <div style={{ marginTop:8 }}>
          <button onClick={addExpense}>Add</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
        <label>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <select value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">All Categories</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={loadRows}>Apply</button>
        <div style={{ marginLeft:'auto' }}>
          <b>Total Shown:</b> {money(totalShown)} &nbsp; | &nbsp;
          <b>Overall (period):</b> {money(sum.overall)}
        </div>
      </div>

      {/* Summary by category */}
      <div style={{ margin:'8px 0' }}>
        <table cellPadding="6" style={{ borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
              <th>Category</th><th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(sum.by_category || []).map(s => (
              <tr key={s.category_id} style={{ borderBottom:'1px solid #f7f7f7' }}>
                <td>{s.category_name}</td>
                <td>{money(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* List */}
      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div>No expenses.</div>
      ) : (
        <table width="100%" cellPadding="6" style={{ borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ textAlign:'left', borderBottom:'1px solid #ddd' }}>
              <th>Date</th><th>Category</th><th>Description</th><th>Payment</th><th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom:'1px solid #f7f7f7' }}>
                <td>{new Date(r.expense_date).toLocaleDateString()}</td>
                <td>{r.category_name}</td>
                <td>{r.description || '-'}</td>
                <td>{r.payment_type || '-'}</td>
                <td>{money(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
