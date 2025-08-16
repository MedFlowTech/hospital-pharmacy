import React, { useState } from 'react';

export default function AddUser({ token, onUserAdded }) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleId, setRoleId]     = useState('');
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          full_name: fullName,
          role_id: Number(roleId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onUserAdded(data);
      setUsername('');
      setFullName('');
      setRoleId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Add New User</h3>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <div>
        <label>Username:</label><br/>
        <input value={username} onChange={e => setUsername(e.target.value)} required />
      </div>
      <div>
        <label>Full Name:</label><br/>
        <input value={fullName} onChange={e => setFullName(e.target.value)} required />
      </div>
      <div>
        <label>Role ID:</label><br/>
        <input
          type="number"
          value={roleId}
          onChange={e => setRoleId(e.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Adding…' : 'Add User'}
      </button>
    </form>
  );
}
