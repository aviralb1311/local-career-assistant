# Security — Local Career Assistant

## Status

**Implemented.** Security controls for Phases 0–2 are in place, including a
Phase 2 security-hardening pass. Phase 5 (polish + hardening) will add CSP,
DOMPurify on all rendered untrusted content, and a complete threat model.

## Core guarantees (by design)

- **No cloud AI by default.** Ollama (local) is the default provider. `allowCloud` defaults to `false`.
- **Cloud AI requires explicit per-action consent** before any personal information leaves the machine. Consent is action- and data-category-specific.
- **All transfers to a cloud provider are recorded** in an `audit_log` table (action, provider, data_categories, user_consented, timestamp).
- **All user data lives in a single SQLite file** under the user's data directory (`app.getPath('userData')/app.db`).
- **The SQLite database uses default rollback journal mode** (no WAL in Phase 1), producing a single file for simpler backup/restore.
- **No Node.js in the renderer.** SQLite, keytar, and filesystem access live only in `src/main/`. The renderer reaches them through `window.electronAPI` (preload) only.
- **Preload API is narrowly scoped.** IPC channels are on an explicit allow-list; no generic `invoke` passthrough.
- **TypeScript `strict`.** No `any` without a comment justifying it.
- **Errors sanitized before reaching the renderer.** Raw error messages (which may contain file paths) are stripped in `src/main/index.ts:initializeDatabase` via `sanitizeErrorMessage`. Provider errors are mapped to an allow-list of codes and generic messages in `src/main/ai/service.ts:sanitizeError` — no arbitrary provider messages, credentials, prompt content, or sensitive URLs are forwarded.
- **Database path override for tests.** `openDatabase(dbPath)` accepts an optional `dbPath`. Tests inject temp paths under `os.tmpdir()` and never open the real user database.

## Consent model

- Global toggle: `allow_cloud` setting (default `false`).
- Per-action consent: `requireConsent(action, dataCategories)` checks both the global toggle and a prior grant for the exact action + data categories.
- `grantConsent`/`denyConsent` record to `audit_log` via `SqliteAuditService`.
- Cloud provider (`openai-compatible`) calls are blocked by `AIService.generateText`/`generateJSON` when consent is not granted, throwing `consent-required` **before** any provider is instantiated. Enforcement occurs entirely in the main process (`src/main/ai/service.ts`).
- The `openai-compatible` provider is a stub that never makes network calls (`isAvailable()` always returns `false`; `generateText`/`generateJSON` always throw `not-configured`).

## Secrets management

- API keys stored in the OS keychain via `keytar` (main process only).
- `KeytarSecretsService` implements `set`/`delete` keyed by provider ID. There is **no `get` operation exposed over IPC** — the renderer cannot retrieve plaintext secrets. The `ai:getSecret` IPC channel and preload helper have been removed.
- `ai:setSecret` and `ai:deleteSecret` are write-only operations over IPC; both validate provider ID and secret value at the IPC boundary.
- Secrets are never logged or committed. `.env` is gitignored.
- keytar failures (e.g., keychain locked) are surfaced as errors without leaking the secret value.

## IPC validation

All AI IPC handlers validate their inputs at the main-process boundary before delegating to the service layer (`src/main/ai/validation.ts`):

- Provider IDs must be `'ollama'` or `'openai-compatible'`.
- Endpoints must be valid `http://` or `https://` URLs.
- Model names must be non-empty strings, max 256 characters.
- Prompts must be non-empty strings, max 100,000 characters.
- `maxTokens` must be a positive integer, max 4,096.
- `temperature` must be a number between 0 and 2.
- `allowCloud` must be a boolean.
- Unknown settings fields are rejected.
- `setSecret`/`deleteSecret` validate provider ID and secret (non-empty, max 4,096 chars).
- `timeout` values are capped at 120,000 ms in the Ollama provider.

## Error sanitization

Provider errors are mapped through `sanitizeError` (`src/main/ai/service.ts`) to an allow-list of codes:
`connection-refused`, `http-error`, `malformed-response`, `timeout`, `cancelled`, `not-configured`, `consent-required`, `unknown`. Arbitrary provider messages, credentials, prompt content, and sensitive URLs are replaced with generic safe messages. `ValidationError` from IPC input validation maps to code `validation-error` with a sanitized message.

## Threat model

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cloud AI sends CV/JD to third party | High | Cloud provider off by default; explicit per-action consent modal; `audit_log` records every transfer; consent enforced in main process before provider invocation |
| Rendering untrusted JD content (XSS) | High | DOMPurify (Phase 5), no `innerHTML`, strict CSP (Phase 5), text-only rendering |
| Secrets/API keys committed or logged | High | keytar / OS keychain; never log keys; `.env` in `.gitignore`; `npm audit` in CI; no `getSecret` over IPC |
| Plaintext secret retrieval over IPC | High | `ai:getSecret` channel removed; only write-only `setSecret`/`deleteSecret` exposed |
| SQLite corruption / failed migration | Medium | Migrations in transactions, `PRAGMA integrity_check` on startup, backups before migrations |
| Data loss (device failure) | High | Backup/restore feature, dated backups folder, "export all data" (JSON) |
| Prompt injection from untrusted JDs | High | System prompt instructs model to treat JD as data only; JD sanitized on read; strict output schema; model output validated before use |
| Sensitive data in logs | High | No PII, CV content, or secrets in console/app logs; redaction before any logging |
| Dependency supply chain | Medium | `npm audit` / `npm ci` in CI, lockfile committed, minimal dependencies |
| Physical access to DB file | Medium | Document OS disk encryption recommendation; optional SQLCipher encryption listed as Phase 2 candidate |
| Unbounded request timeouts | Medium | Ollama timeout capped at 120,000 ms; `maxTokens` capped at 4,096 |
| Malformed IPC payloads | Medium | Runtime validation at all AI IPC handler boundaries; unknown fields rejected |

## Dependencies

- `npm audit` runs in CI (`--audit-level=critical`, no `|| true`). Lockfile committed; `npm ci` used for reproducible installs.
- keytar is a native module; rebuilt for Electron's ABI by electron-builder at package time.
- better-sqlite3 is a native module; rebuilt for Electron's ABI by electron-builder at package time.

## Future work

- CSP headers and DOMPurify on all rendered untrusted content (Phase 5).
- Encrypted-at-rest database (SQLCipher) — candidate for Phase 2.
- OS disk encryption recommendation for users.
- E2E Playwright suite with mocked AI providers (Phase 5).
