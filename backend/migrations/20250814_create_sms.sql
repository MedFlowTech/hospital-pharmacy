-- backend/migrations/20250814_create_sms.sql

CREATE TABLE IF NOT EXISTS public.sms_templates (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  body        TEXT NOT NULL,         -- e.g. "Hi {{name}}, your order {{order_no}} is ready."
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_outbox (
  id                 SERIAL PRIMARY KEY,
  to_number          VARCHAR(50) NOT NULL,
  template_id        INTEGER NULL REFERENCES public.sms_templates(id) ON DELETE SET NULL,
  body_resolved      TEXT NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'QUEUED', -- QUEUED | SENT | FAILED
  provider           VARCHAR(40) NOT NULL DEFAULT 'console',
  provider_response  TEXT,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at            TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_sms_outbox_status ON public.sms_outbox(status);
CREATE INDEX IF NOT EXISTS idx_sms_outbox_created ON public.sms_outbox(created_at DESC);
