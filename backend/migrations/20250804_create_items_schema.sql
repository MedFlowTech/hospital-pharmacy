CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE units (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  symbol VARCHAR(20)
);

CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category_id INT REFERENCES categories(id),
  brand_id INT REFERENCES brands(id),
  cost_price NUMERIC(12,2),
  unit_price NUMERIC(12,2) NOT NULL,
  stock_qty INT DEFAULT 0,
  min_stock INT DEFAULT 0,
  max_stock INT,
  default_unit_id INT REFERENCES units(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE item_batches (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES items(id) ON DELETE CASCADE,
  batch_no VARCHAR(100) NOT NULL,
  expiry_date DATE,
  qty INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(item_id, batch_no)
);

CREATE TABLE item_units (
  item_id INT REFERENCES items(id) ON DELETE CASCADE,
  unit_id INT REFERENCES units(id),
  to_base_qty NUMERIC(12,4) NOT NULL,
  PRIMARY KEY(item_id, unit_id)
);
