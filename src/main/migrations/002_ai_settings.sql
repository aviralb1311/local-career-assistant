-- Phase 2: AI provider settings and audit log.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  provider TEXT,
  data_categories TEXT NOT NULL,
  user_consented INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL
);
