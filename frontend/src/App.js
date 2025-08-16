// frontend/src/App.js
import React, { useEffect, useState } from 'react';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Purchases from './components/Purchases';
import SalesReturns from './components/SalesReturns';
import Sales from './components/Sales';
import Labels from './components/Labels';
import Reports from './components/Reports';

import ItemForm from './components/ItemForm';
import ItemsList from './components/ItemsList';
import Suppliers from './components/Suppliers';

import AddUser from './components/AddUser';
import UsersList from './components/UsersList';

import Customers from './components/Customers';
import Expenses from './components/Expenses'; // ← ensure this file exists

import SMS from './components/SMS';

import Settings from './components/Settings';

import PaymentTypes from './components/PaymentTypes';
import ReturnsList from './components/ReturnsList';

function App() {
  const [token, setToken] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState('dashboard'); // dashboard | pos | purchases | returns | sales | labels | reports | items | suppliers | users | customers | expenses

  useEffect(() => {
    const saved = localStorage.getItem('pharmacyToken');
    if (saved) setToken(saved);
  }, []);

  const handleLogin = (jwt) => {
    setToken(jwt);
    localStorage.setItem('pharmacyToken', jwt);
  };

  const logout = () => {
    localStorage.removeItem('pharmacyToken');
    setToken(null);
  };

  const handleRefresh = () => setRefreshKey(k => k + 1);

  if (!token) {
    return (
      <div style={{ padding: '2rem', maxWidth: 420, margin: 'auto' }}>
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div style={{ padding: '1.25rem', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Pharmacy Admin</h1>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')}>Dashboard</TabButton>
          <TabButton active={tab === 'pos'}        onClick={() => setTab('pos')}>POS</TabButton>
          <TabButton active={tab === 'purchases'}  onClick={() => setTab('purchases')}>Purchases</TabButton>
          <TabButton active={tab === 'returns'}    onClick={() => setTab('returns')}>Returns</TabButton>
          <TabButton active={tab === 'sales'}      onClick={() => setTab('sales')}>Sales</TabButton>
          <TabButton active={tab === 'labels'}     onClick={() => setTab('labels')}>Labels</TabButton>
          <TabButton active={tab === 'reports'}    onClick={() => setTab('reports')}>Reports</TabButton>
          <TabButton active={tab === 'expenses'}   onClick={() => setTab('expenses')}>Expenses</TabButton>
          <TabButton active={tab === 'items'}      onClick={() => setTab('items')}>Items</TabButton>
          <TabButton active={tab === 'suppliers'}  onClick={() => setTab('suppliers')}>Suppliers</TabButton>
          <TabButton active={tab === 'customers'}  onClick={() => setTab('customers')}>Customers</TabButton>
          <TabButton active={tab === 'users'}      onClick={() => setTab('users')}>Users</TabButton>
          <TabButton active={tab === 'sms'}        onClick={() => setTab('sms')}>SMS</TabButton>
          <TabButton active={tab === 'settings'}   onClick={() => setTab('settings')}>Settings</TabButton>
        </nav>
        <div style={{ flex: 1 }} />
        <button onClick={logout}>Logout</button>
        <button onClick={() => setTab('pos')}>POS</button>
        <button onClick={() => setTab('paymentTypes')}>Payment Types</button>
        <button onClick={() => setTab('returns')}>Returns</button>
        <button onClick={() => setTab('returnsList')}>Returns</button>
        <button onClick={() => setTab('returnNew')}>Return (New)</button>
        <button onClick={() => setTab('settings')}>Settings</button>
      </header>

      {tab === 'dashboard' && (
        <section><Dashboard token={token} /></section>
      )}

      {tab === 'pos' && (
        <section>
          <POS token={token} />
        </section>
      )}

      {tab === 'purchases' && (
        <section><Purchases token={token} /></section>
      )}

      {tab === 'returns' && (
        <section><SalesReturns token={token} /></section>
      )}

      {tab === 'sales' && (
        <section><Sales token={token} /></section>
      )}

      {tab === 'labels' && (
        <section><Labels token={token} /></section>
      )}

      {tab === 'reports' && (
        <section><Reports token={token} /></section>
      )}

      {tab === 'expenses' && (
        <section>
          <Expenses token={token} />
        </section>
      )}

      {tab === 'items' && (
        <section>
          <h2>Item Management</h2>
          <ItemForm token={token} onItemAdded={handleRefresh} />
          <ItemsList token={token} refreshSignal={refreshKey} />
        </section>
      )}

      {tab === 'suppliers' && (
        <section><Suppliers token={token} /></section>
      )}

      {tab === 'customers' && (
        <section><Customers token={token} /></section>
      )}

      {tab === 'sms' && (
        <section><SMS token={token} /></section>
      )}

      {tab === 'settings' && (
        <section><Settings token={token} /></section>
      )}

      {tab === 'users' && (
        <section>
          <h2>User Management</h2>
          <AddUser onUserAdded={handleRefresh} token={token} />
          <UsersList token={token} refreshSignal={refreshKey} />
        </section>
      )}

      {tab === 'paymentTypes' && (
        <section>
          <PaymentTypes token={token} />
        </section>
      )}

      {tab === 'returns' && (
        <section>
          <SalesReturns token={token} />
        </section>
      )}
      {tab === 'returnsList' && (
        <section>
          <ReturnsList token={token} />
        </section>
      )}
      {tab === 'returnNew' && (
        <section>
          <SalesReturns token={token} />
        </section>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 10px',
        borderRadius: 6,
        border: active ? '2px solid #333' : '1px solid #ccc',
        background: active ? '#f5f5f5' : '#fff',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  );
}

export default App;
