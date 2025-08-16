</canvas>

---

### 3. Core Database Schema

```sql
-- Users & Roles
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  role_id INT REFERENCES roles(id),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customers & Suppliers
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Items, Categories & Brands
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category_id INT REFERENCES categories(id),
  brand_id INT REFERENCES brands(id),
  unit_price NUMERIC(12,2) NOT NULL,
  cost_price NUMERIC(12,2),
  stock_qty INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Purchases & Purchase Returns
CREATE TABLE purchases (
  id SERIAL PRIMARY KEY,
  supplier_id INT REFERENCES suppliers(id),
  invoice_no VARCHAR(100),
  total_amount NUMERIC(12,2),
  purchase_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE purchase_items (
  purchase_id INT REFERENCES purchases(id),
  item_id INT REFERENCES items(id),
  batch_no VARCHAR(100),
  expiry_date DATE,
  qty INT,
  unit_cost NUMERIC(12,2),
  PRIMARY KEY(purchase_id, item_id, batch_no)
);

CREATE TABLE purchase_returns (
  id SERIAL PRIMARY KEY,
  purchase_id INT REFERENCES purchases(id),
  return_date DATE DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2)
);

-- Sales & Sales Returns
CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  total_amount NUMERIC(12,2),
  sale_date TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sale_items (
  sale_id INT REFERENCES sales(id),
  item_id INT REFERENCES items(id),
  qty INT,
  unit_price NUMERIC(12,2),
  discount NUMERIC(5,2),
  PRIMARY KEY(sale_id, item_id)
);

CREATE TABLE sales_returns (
  id SERIAL PRIMARY KEY,
  sale_id INT REFERENCES sales(id),
  return_date TIMESTAMP DEFAULT NOW(),
  total_amount NUMERIC(12,2)
);

-- Expenses
CREATE TABLE expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES expense_categories(id),
  amount NUMERIC(12,2),
  description TEXT,
  expense_date DATE DEFAULT CURRENT_DATE
);

-- SMS Templates & Logs
CREATE TABLE sms_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE sms_logs (
  id SERIAL PRIMARY KEY,
  template_id INT REFERENCES sms_templates(id),
  recipient VARCHAR(20),
  status VARCHAR(20),
  sent_at TIMESTAMP DEFAULT NOW()
);
