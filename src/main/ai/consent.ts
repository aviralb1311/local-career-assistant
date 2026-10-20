import type { DbConnection } from '../db.js';
import type {
  AuditLogEntry,
  AuditService,
  ConsentService,
  ProviderId,
} from './types.js';

const ALLOW_CLOUD_KEY = 'allow_cloud';

export class SqliteAuditService implements AuditService {
  constructor(private readonly db: DbConnection) {}

  async record(action: string, params: {
    provider: ProviderId | null;
    dataCategories: string[];
    userConsented: boolean;
  }): Promise<void> {
    const db = this.db;
    db.prepare(
      `INSERT INTO audit_log (action, provider, data_categories, user_consented, timestamp)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      action,
      params.provider ?? null,
      JSON.stringify(params.dataCategories),
      params.userConsented ? 1 : 0,
      new Date().toISOString()
    );
  }

  async list(): Promise<AuditLogEntry[]> {
    const rows = this.db
      .prepare(
        `SELECT id, action, provider, data_categories, user_consented, timestamp
         FROM audit_log ORDER BY timestamp DESC`
      )
      .all() as {
        id: number;
        action: string;
        provider: string | null;
        data_categories: string;
        user_consented: number;
        timestamp: string;
      }[];

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      provider: row.provider as ProviderId | null,
      dataCategories: JSON.parse(row.data_categories),
      userConsented: row.user_consented === 1,
      timestamp: row.timestamp,
    }));
  }
}

export class SqliteConsentService implements ConsentService {
  constructor(
    private readonly db: DbConnection,
    private readonly audit: AuditService
  ) {}

  async isCloudAllowed(): Promise<boolean> {
    const row = this.db
      .prepare(
        `SELECT value FROM settings WHERE key = ?`
      )
      .get(ALLOW_CLOUD_KEY) as { value: string } | undefined;

    return row?.value === 'true';
  }

  async requireConsent(action: string, dataCategories: string[]): Promise<boolean> {
    // Cloud AI must be globally enabled before any per-action consent is possible.
    if (!(await this.isCloudAllowed())) {
      return false;
    }

    // Check whether consent was already granted for this exact action + data categories.
    const existing = this.db
      .prepare(
        `SELECT user_consented FROM audit_log
         WHERE action = ? AND data_categories = ?
         ORDER BY timestamp DESC LIMIT 1`
      )
      .get(action, JSON.stringify(dataCategories)) as {
        user_consented: number;
      } | undefined;

    return existing?.user_consented === 1;
  }

  async grantConsent(action: string, dataCategories: string[]): Promise<void> {
    await this.audit.record(action, {
      provider: null,
      dataCategories,
      userConsented: true,
    });
  }

  async denyConsent(action: string, dataCategories: string[]): Promise<void> {
    await this.audit.record(action, {
      provider: null,
      dataCategories,
      userConsented: false,
    });
  }
}

export function createConsentService(db: DbConnection): ConsentService {
  const audit = new SqliteAuditService(db);
  return new SqliteConsentService(db, audit);
}

export function createAuditService(db: DbConnection): AuditService {
  return new SqliteAuditService(db);
}
