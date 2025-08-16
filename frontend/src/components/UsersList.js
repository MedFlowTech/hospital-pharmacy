// frontend/src/components/UsersList.js

import React, { useEffect, useState } from 'react';

export default function UsersList({ token, refreshSignal }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    fetch('http://localhost:3001/users', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setUsers)
      .catch(err => setError(err.message));
  }, [token, refreshSignal]);

  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <table border="1" cellPadding="5" style={{ marginTop: '1rem' }}>
      <thead>
        <tr>
          <th>ID</th><th>Username</th><th>Full Name</th><th>Role ID</th><th>Created At</th>
        </tr>
      </thead>
      <tbody>
        {users.map(u => (
          <tr key={u.id}>
            <td>{u.id}</td>
            <td>{u.username}</td>
            <td>{u.full_name}</td>
            <td>{u.role_id}</td>
            <td>{new Date(u.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
