-- backend/migrations/20250812_create_customers.sql
CREATE TABLE IF NOT EXISTS public.customers (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  phone      VARCHAR(50),
  email      VARCHAR(150),
  address    TEXT,
  notes      TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- unique constraints (Postgres allows multiple NULLs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_phone_unique'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_phone_unique UNIQUE (phone);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_email_unique'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_email_unique UNIQUE (email);
  END IF;
END$$;
