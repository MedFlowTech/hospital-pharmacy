// backend/test.js

const express = require('express');
const cors    = require('cors');
const app     = express();

// In-memory data
let users = [{ test: true }];

// 1) Enable CORS & JSON parsing
app.use(cors());
app.use(express.json());

// 2) Log requests
app.use((req, res, next) => {
  console.log(`🔍 [test.js] ${req.method} ${req.path}`, req.body || '');
  next();
});

// 3) Routes
app.get('/', (req, res) => res.send('Test server root'));

app.get('/users', (req, res) => res.json(users));

app.post('/users', (req, res) => {
  const { username, full_name, role_id } = req.body;
  if (!username || !full_name || typeof role_id !== 'number') {
    return res
      .status(400)
      .json({ error: 'username, full_name (strings) & role_id (number) are required' });
  }
  const newUser = {
    id: users.length + 1,
    username,
    full_name,
    role_id,
    created_at: new Date().toISOString()
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// 4) Start server
const PORT = 3002;
app.listen(PORT, () => console.log(`🚀 [test.js] Listening on port ${PORT}`));
