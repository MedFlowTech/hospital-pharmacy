-- backend/migrations/20250814_create_settings.sql

-- company profile (single row)
CREATE TABLE IF NOT EXISTS public.company_profile (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  name            VARCHAR(200) NOT NULL DEFAULT 'My Pharmacy',
  address         TEXT,
  phone           VARCHAR(50),
  email           VARCHAR(150),
  tax_id          VARCHAR(100),
  receipt_footer  TEXT,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
INSERT INTO public.company_profile (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- generic key/value settings
CREATE TABLE IF NOT EXISTS public.settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT
);

-- currencies (lookup)
CREATE TABLE IF NOT EXISTS public.currencies (
  code   VARCHAR(3) PRIMARY KEY,  -- e.g., USD, NGN
  symbol VARCHAR(8) NOT NULL,
  name   VARCHAR(100) NOT NULL
);
INSERT INTO public.currencies (code, symbol, name) VALUES
  ('USD','$','US Dollar'),
  ('NGN','₦','Nigerian Naira'),
  ('EUR','€','Euro')
ON CONFLICT (code) DO NOTHING;

-- payment types (lookup)
CREATE TABLE IF NOT EXISTS public.payment_types (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);
INSERT INTO public.payment_types (name) VALUES
  ('CASH'),('CARD'),('BANK TRANSFER'),('POS')
ON CONFLICT (name) DO NOTHING;

-- taxes (list of named tax rates)
CREATE TABLE IF NOT EXISTS public.taxes (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  rate_percent  NUMERIC(6,2) NOT NULL CHECK (rate_percent >= 0)
);
