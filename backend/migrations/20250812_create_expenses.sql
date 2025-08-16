-- backend/migrations/20250812_create_expenses.sql

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id           SERIAL PRIMARY KEY,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id  INTEGER NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  description  TEXT,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_type VARCHAR(50),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date    ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
