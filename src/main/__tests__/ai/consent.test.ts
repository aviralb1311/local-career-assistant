import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  openDatabase,
  closeDatabase,
} from '../../db.js';
import {
  applyMigrations,
} from '../../migrate.js';
import {
  createConsentService,
  createAuditService,
} from '../../ai/consent.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Consent service', () => {
  let tempDir: string;
  let dbPath: string;
  let migrationsDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lca-consent-test-'));
    dbPath = join(tempDir, 'test.db');
    migrationsDir = join(tempDir, 'migrations');
    const { mkdirSync, writeFileSync } = require('node:fs');
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(
      join(migrationsDir, '001_init.sql'),
      `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`
    );
    writeFileSync(
      join(migrationsDir, '002_ai_settings.sql'),
      `CREATE TABLE IF NOT EXISTS settings (
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
);`
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('cloud is not allowed by default', async () => {
    const db = openDatabase(dbPath);
    try {
      applyMigrations(db, migrationsDir);
      const consent = createConsentService(db);
      expect(await consent.isCloudAllowed()).toBe(false);
    } finally {
      closeDatabase(db);
    }
  });

  it('requireConsent returns false when cloud is disabled', async () => {
    const db = openDatabase(dbPath);
    try {
      applyMigrations(db, migrationsDir);
      const consent = createConsentService(db);
      const result = await consent.requireConsent('ai:eval', ['cv']);
      expect(result).toBe(false);
    } finally {
      closeDatabase(db);
    }
  });

  it('grantConsent then requireConsent returns true', async () => {
    const db = openDatabase(dbPath);
    try {
      applyMigrations(db, migrationsDir);
      // Enable cloud globally first.
      db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run('allow_cloud', 'true');
      const consent = createConsentService(db);
      await consent.grantConsent('ai:eval', ['cv', 'job-description']);
      const result = await consent.requireConsent('ai:eval', ['cv', 'job-description']);
      expect(result).toBe(true);
    } finally {
      closeDatabase(db);
    }
  });

  it('consent is action-specific', async () => {
    const db = openDatabase(dbPath);
    try {
      applyMigrations(db, migrationsDir);
      const consent = createConsentService(db);
      await consent.grantConsent('ai:eval', ['cv']);
      // Different action should not be consented.
      expect(await consent.requireConsent('ai:generate-cover-letter', ['cv'])).toBe(false);
      // Same action, different data categories should not be consented.
      expect(await consent.requireConsent('ai:eval', ['job-description'])).toBe(false);
    } finally {
      closeDatabase(db);
    }
  });

  it('audit log records consent grants and denials', async () => {
    const db = openDatabase(dbPath);
    try {
      applyMigrations(db, migrationsDir);
      const audit = createAuditService(db);
      const consent = createConsentService(db);

      await consent.grantConsent('ai:eval', ['cv']);
      await consent.denyConsent('ai:generate-cover-letter', ['cv']);

      const log = await audit.list();
      expect(log.length).toBe(2);
      const actions = log.map((e) => e.action);
      expect(actions).toContain('ai:generate-cover-letter');
      expect(actions).toContain('ai:eval');
      const denied = log.find((e) => e.action === 'ai:generate-cover-letter');
      expect(denied?.userConsented).toBe(false);
      const granted = log.find((e) => e.action === 'ai:eval');
      expect(granted?.userConsented).toBe(true);
    } finally {
      closeDatabase(db);
    }
  });
});
