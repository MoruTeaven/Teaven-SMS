-- 0004_add_public_templates.sql

CREATE TABLE IF NOT EXISTS public_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables_schema TEXT,
  sms_type TEXT NOT NULL DEFAULT 'verification' CHECK(sms_type IN ('verification', 'notification', 'marketing', 'transactional')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_templates_status ON public_templates(status);
CREATE INDEX IF NOT EXISTS idx_public_templates_sms_type ON public_templates(sms_type);
