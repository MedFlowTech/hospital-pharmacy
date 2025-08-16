-- backend/migrations/20250812_create_reorders.sql
CREATE TABLE IF NOT EXISTS public.reorders (
  id            SERIAL PRIMARY KEY,
  item_id       INTEGER NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  requested_qty INTEGER,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | ordered | cancelled
  supplier_id   INTEGER REFERENCES public.suppliers(id),
  notes         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  ordered_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reorders_status   ON public.reorders(status);
CREATE INDEX IF NOT EXISTS idx_reorders_created  ON public.reorders(created_at DESC);
