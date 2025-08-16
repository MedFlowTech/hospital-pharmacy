-- backend/migrations/20250816_settings.sql
CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_profile (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  address        TEXT,
  phone          VARCHAR(50),
  email          VARCHAR(150),
  tax_id         VARCHAR(100),
  receipt_footer TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- seed a profile row if empty
INSERT INTO public.company_profile (name)
SELECT 'My Pharmacy'
WHERE NOT EXISTS (SELECT 1 FROM public.company_profile);

-- sensible defaults if not present
INSERT INTO public.settings (key, value) VALUES
  ('currency','USD'),
  ('default_tax_rate','0')
ON CONFLICT (key) DO NOTHING;
