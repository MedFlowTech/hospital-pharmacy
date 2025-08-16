// backend/index.js — DB-backed auth + Users + Categories/Brands/Units (mounted)
// SINGLE SOURCE OF TRUTH — paste this whole file

console.log('🧭 Booting DB-backed API (stable bundle)');
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('./db'); // pg Pool using .env

// Routers (we'll create these files below)
const categoriesRouter = require('./routes/categories');
const brandsRouter     = require('./routes/brands');
const unitsRouter      = require('./routes/units');
const itemsRouter      = require('./routes/items');
const batchesRouter    = require('./routes/batches');
const suppliersRouter  = require('./routes/suppliers');
const purchasesRouter  = require('./routes/purchases');
const customersRouter  = require('./routes/customers');
const salesRouter      = require('./routes/sales');
const saleReturnsRouter = require('./routes/saleReturns');
const reportsRouter    = require('./routes/reports');
const reordersRouter   = require('./routes/reorders');
const expenseCategoriesRouter = require('./routes/expenseCategories');
const expensesRouter         = require('./routes/expenses');
const smsTemplatesRouter = require('./routes/smsTemplates');
const smsRouter         = require('./routes/sms');
const settingsRouter     = require('./routes/settings');
const taxesRouter        = require('./routes/taxes');
const paymentTypesRouter = require('./routes/paymentTypes');
const currenciesRouter   = require('./routes/currencies');
const itemLookupRouter = require('./routes/itemLookup');
const salesAdvancedRouter = require('./routes/salesAdvanced');
const salesReturnsAdvancedRouter = require('./routes/salesReturnsAdvanced');

const app = express();
app.use(cors());
app.use(express.json());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    // Body parser JSON error
    return res.status(400).json({ error: 'Invalid JSON', detail: err.message });
  }
  next();
});

// ── Public health/debug (no token) ───────────────────────────────
app.get('/ping', (req, res) => res.send('pong'));
app.get('/',     (req, res) => res.send('OK'));

app.get('/__debug/db', async (_req, res) => {
  try {
    const r = await db.query('SELECT NOW() AS now', []);
    res.json(r.rows[0]);
  } catch (e) {
    console.error('debug/db', e);
    res.status(500).json({ error: 'db ping failed', code: e.code });
  }
});

app.get('/__debug/roles', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name FROM roles ORDER BY id', []);
    res.json(rows);
  } catch (e) {
    console.error('debug/roles', e);
    res.status(500).json({ error: 'read roles failed', code: e.code });
  }
});

app.get('/__debug/seed/roles', async (_req, res) => {
  try {
    await db.query(`INSERT INTO roles (id,name) VALUES (1,'Admin') ON CONFLICT (id) DO NOTHING`);
    await db.query(`INSERT INTO roles (id,name) VALUES (2,'Pharmacist') ON CONFLICT (id) DO NOTHING`);
    const { rows } = await db.query('SELECT id, name FROM roles ORDER BY id', []);
    res.json({ seeded: true, roles: rows });
  } catch (e) {
    console.error('debug/seed/roles', e);
    res.status(500).json({ error: 'seed failed', code: e.code });
  }
});

app.get('/__debug/doctor', async (req, res) => {
  const out = {};
  async function has(sql){ try { await db.query(sql); return true; } catch { return false; } }
  out.sms_templates = await has('SELECT 1 FROM sms_templates LIMIT 1');
  out.sms_outbox    = await has('SELECT 1 FROM sms_outbox LIMIT 1');
  // add other tables you care about:
  // out.items = await has('SELECT 1 FROM items LIMIT 1');
  res.json(out);
});

// ── Auth (public) ────────────────────────────────────────────────
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });

  try {
    const { rows } = await db.query(
      'SELECT id, password_hash, role_id FROM users WHERE username=$1',
      [username]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: rows[0].id, roleId: rows[0].role_id },
      process.env.JWT_SECRET || 'devsecret',
      { expiresIn: '8h' }
    );
    res.json({ token });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Login failed', code: e.code });
  }
});

// ── Auth middleware — everything below this line needs Bearer token ─
app.use((req, res, next) => {
  if (['/','/ping','/auth/login','/__debug/db','/__debug/roles','/__debug/seed/roles'].includes(req.path)) return next();
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'devsecret');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// POST /auth/change-password
// body: { current_password, new_password }
app.post('/auth/change-password', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
    const token = auth.slice(7);
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Invalid token' }); }

    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' });
    }

    // fetch user
    const u = await db.query('SELECT id, password_hash FROM users WHERE id=$1', [payload.userId]);
    if (!u.rows.length) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(current_password, u.rows[0].password_hash || '');
    if (!ok) return res.status(400).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, payload.userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('auth:change-password error', e);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ── Token self-test (protected) ──────────────────────────────────
app.get('/auth/me', (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ── Users (protected) ────────────────────────────────────────────
app.get('/users', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, username, full_name, role_id, created_at FROM users ORDER BY id',
      []
    );
    res.json(rows);
  } catch (e) {
    console.error('get users error', e);
    res.status(500).json({ error: 'Failed to fetch users', code: e.code });
  }
});

app.post('/users', async (req, res) => {
  let { username, full_name, role_id } = req.body || {};
  if (!username || !full_name) return res.status(400).json({ error: 'username & full_name required' });

  try {
    // default role to Admin(1) if missing/invalid to keep you unblocked
    role_id = Number(role_id);
    if (!Number.isInteger(role_id)) role_id = 1;
    const rc = await db.query('SELECT id FROM roles WHERE id=$1', [role_id]);
    if (!rc.rows.length) role_id = 1;

    const hash = await bcrypt.hash('changeme', 10);
    const { rows } = await db.query(
      `INSERT INTO users (username, full_name, role_id, password_hash)
       VALUES ($1,$2,$3,$4)
       RETURNING id, username, full_name, role_id, created_at`,
      [username, full_name, role_id, hash]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('create user error', e);
    if (e.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Failed to create user', code: e.code });
  }
});

// --- compatibility shim: accept { items: [...] } or { lines: [...] } for POST /sales
app.use('/sales', (req, res, next) => {
  try {
    if (req.method === 'POST' && req.is('application/json')) {
      const body = req.body || {};
      if (!Array.isArray(body.lines) && Array.isArray(body.items)) {
        // map old payload key to the new one
        body.lines = body.items;
        req.body = body;
      }
    }
  } catch (_) {
    // ignore
  }
  next();
});

// ── Mount resource routers (protected) ───────────────────────────
app.use('/categories', categoriesRouter);
app.use('/brands',     brandsRouter);
app.use('/units',      unitsRouter);
app.use('/items',      itemsRouter);
app.use('/items/:itemId/batches', batchesRouter);
app.use('/suppliers',  suppliersRouter);
app.use('/purchases',  purchasesRouter);
app.use('/customers',  customersRouter);
app.use('/sales',      salesRouter);
app.use('/sales/:saleId/returns', saleReturnsRouter);
app.use('/reports',    reportsRouter);
app.use('/reorders',   reordersRouter);
app.use('/expense-categories', expenseCategoriesRouter);
app.use('/expenses',           expensesRouter);
app.use('/sms/templates', smsTemplatesRouter);
app.use('/sms',           smsRouter);
app.use('/settings',      settingsRouter);
app.use('/taxes',         taxesRouter);
app.use('/payment-types', paymentTypesRouter);
app.use('/currencies',    currenciesRouter);
app.use('/items/lookup', itemLookupRouter);
app.use('/sales', salesAdvancedRouter); // adds /sales/advanced and /sales/summary
app.use('/sales-returns', salesReturnsAdvancedRouter);

// ── Catch-all ────────────────────────────────────────────────────
app.use((req, res) => res.status(404).send(`No route for ${req.path}`));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Listening on ${PORT}`));
