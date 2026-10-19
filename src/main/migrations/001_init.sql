-- Phase 1 initial schema.
-- Only the schema_migrations tracking table exists at this stage.
-- Product tables (profiles, cv_versions, etc.) are added in later phases.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
