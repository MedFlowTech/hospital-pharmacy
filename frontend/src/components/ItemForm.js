// frontend/src/components/ItemForm.js

import React, { useState, useEffect } from 'react';

export default function ItemForm({ token, onItemAdded }) {
  const [sku, setSku]             = useState('');
  const [name, setName]           = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId]       = useState('');
  const [costPrice, setCostPrice]   = useState('');
  const [unitPrice, setUnitPrice]   = useState('');
  const [stockQty, setStockQty]     = useState('');
  const [minStock, setMinStock]     = useState('');
  const [maxStock, setMaxStock]     = useState('');
  const [defaultUnit, setDefaultUnit] = useState('');
  const [categories, setCategories] = useState([]);
  const [brands, setBrands]         = useState([]);
  const [units, setUnits]           = useState([]);
  const [error, setError]           = useState(null);
  const [loading, setLoading]       = useState(false);

  // Fetch dropdown data
  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch('http://localhost:3001/categories', { headers }).then(r => r.json()),
      fetch('http://localhost:3001/brands',     { headers }).then(r => r.json()),
      fetch('http://localhost:3001/units',      { headers }).then(r => r.json()),
    ])
      .then(([cats, brs, uts]) => {
        setCategories(cats);
        setBrands(brs);
        setUnits(uts);
      })
      .catch(err => setError(err.message));
  }, [token]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sku, name,
          category_id: parseInt(categoryId, 10),
          brand_id:    parseInt(brandId, 10),
          cost_price:  parseFloat(costPrice),
          unit_price:  parseFloat(unitPrice),
          stock_qty:   parseInt(stockQty, 10),
          min_stock:   parseInt(minStock, 10),
          max_stock:   maxStock ? parseInt(maxStock, 10) : null,
          default_unit_id: defaultUnit ? parseInt(defaultUnit, 10) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onItemAdded(data);
      // reset form
      setSku(''); setName(''); setCategoryId('');
      setBrandId(''); setCostPrice(''); setUnitPrice('');
      setStockQty(''); setMinStock(''); setMaxStock('');
      setDefaultUnit('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
      <h3>Add New Item</h3>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <div>
        <label>SKU:</label><br/>
        <input value={sku} onChange={e => setSku(e.target.value)} required />
      </div>
      <div>
        <label>Name:</label><br/>
        <input value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div>
        <label>Category:</label><br/>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
          <option value="">– Select –</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Brand:</label><br/>
        <select value={brandId} onChange={e => setBrandId(e.target.value)} required>
          <option value="">– Select –</option>
          {brands.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Cost Price:</label><br/>
        <input
          type="number" step="0.01"
          value={costPrice}
          onChange={e => setCostPrice(e.target.value)}
        />
      </div>
      <div>
        <label>Unit Price:</label><br/>
        <input
          type="number" step="0.01"
          value={unitPrice}
          onChange={e => setUnitPrice(e.target.value)}
          required
        />
      </div>
      <div>
        <label>Stock Qty:</label><br/>
        <input
          type="number"
          value={stockQty}
          onChange={e => setStockQty(e.target.value)}
        />
      </div>
      <div>
        <label>Min Stock:</label><br/>
        <input
          type="number"
          value={minStock}
          onChange={e => setMinStock(e.target.value)}
        />
      </div>
      <div>
        <label>Max Stock:</label><br/>
        <input
          type="number"
          value={maxStock}
          onChange={e => setMaxStock(e.target.value)}
        />
      </div>
      <div>
        <label>Default Unit:</label><br/>
        <select
          value={defaultUnit}
          onChange={e => setDefaultUnit(e.target.value)}
        >
          <option value="">– None –</option>
          {units.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Add Item'}
      </button>
    </form>
  );
}
