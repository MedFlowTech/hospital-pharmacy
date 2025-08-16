// backend/db.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'pharmacy_db',
  // Optional: increase if you see timeouts
  // max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('PG pool error:', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(), // <-- now available to routes needing transactions
};
