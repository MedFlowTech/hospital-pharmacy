// frontend/src/components/Settings.js
import React, { useEffect, useState } from 'react';
const API = 'http://localhost:3001';

export default function Settings({ token }) {
  const auth = { Authorization: `Bearer ${token || localStorage.getItem('pharmacyToken') || ''}` };
  const [company, setCompany] = useState(null);
  const [settings, setSettings] = useState({ currency:'USD', default_tax_rate:'0' });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          fetch(`${API}/settings/company-profile`, { headers: auth }),
          fetch(`${API}/settings/public`, { headers: auth }),
        ]);
        const c = cRes.ok ? await cRes.json() : null;
        const s = sRes.ok ? await sRes.json() : { currency:'USD', default_tax_rate:'0' };
        setCompany(c || { name:'', address:'', phone:'', email:'', tax_id:'', receipt_footer:'' });
        setSettings({ currency: s.currency || 'USD', default_tax_rate: s.default_tax_rate || '0' });
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line
  }, [token]);

  const saveCompany = async () => {
    setErr(null); setMsg(null);
    try {
      const res = await fetch(`${API}/settings/company-profile`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type':'application/json' },
        body: JSON.stringify(company),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setCompany(data);
      setMsg('Company profile saved.');
    } catch (e) {
      setErr(e.message || 'Failed to save profile');
    }
  };

  const saveGlobals = async () => {
    setErr(null); setMsg(null);
    try {
      const res = await fetch(`${API}/settings`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type':'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setMsg('Settings saved.');
    } catch (e) {
      setErr(e.message || 'Failed to save settings');
    }
  };

  if (!company) return <div>Loading…</div>;

  return (
    <div>
      <h2>Settings</h2>
      {msg && <div style={{ color:'green' }}>{msg}</div>}
      {err && <div style={{ color:'crimson' }}>{err}</div>}

      <section style={{ marginTop:12, padding:12, border:'1px solid #eee', borderRadius:8 }}>
        <h3>Company Profile</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, maxWidth:800 }}>
          <label>Name<br/>
            <input value={company.name} onChange={e=>setCompany({...company, name:e.target.value})} />
          </label>
          <label>Phone<br/>
            <input value={company.phone||''} onChange={e=>setCompany({...company, phone:e.target.value})} />
          </label>
          <label>Email<br/>
            <input value={company.email||''} onChange={e=>setCompany({...company, email:e.target.value})} />
          </label>
          <label>Tax ID<br/>
            <input value={company.tax_id||''} onChange={e=>setCompany({...company, tax_id:e.target.value})} />
          </label>
          <label style={{ gridColumn:'1 / 3' }}>Address<br/>
            <textarea rows={2} value={company.address||''} onChange={e=>setCompany({...company, address:e.target.value})} />
          </label>
          <label style={{ gridColumn:'1 / 3' }}>Receipt Footer<br/>
            <textarea rows={2} value={company.receipt_footer||''} onChange={e=>setCompany({...company, receipt_footer:e.target.value})} />
          </label>
        </div>
        <div style={{ marginTop:10 }}>
          <button onClick={saveCompany}>Save Company</button>
        </div>
      </section>

      <section style={{ marginTop:16, padding:12, border:'1px solid #eee', borderRadius:8, maxWidth:500 }}>
        <h3>Global</h3>
        <label>Currency<br/>
          <select value={settings.currency} onChange={e=>setSettings({...settings, currency:e.target.value})}>
            <option>USD</option>
            <option>NGN</option>
            <option>EUR</option>
            <option>GBP</option>
            <option>GHS</option>
            <option>ZAR</option>
          </select>
        </label>
        <div style={{ height:10 }} />
        <label>Default Tax Rate (%)<br/>
          <input value={settings.default_tax_rate} onChange={e=>setSettings({...settings, default_tax_rate:e.target.value})} />
        </label>
        <div style={{ marginTop:10 }}>
          <button onClick={saveGlobals}>Save Settings</button>
        </div>
      </section>
    </div>
  );
}
