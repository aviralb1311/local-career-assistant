# Security — Local Career Assistant

## Status
THIS DOCUMENT IS A STUB. It will be completed in Phase 5 (polish + hardening).

## Core guarantees (by design)
- No cloud AI by default. Ollama (local) is the default provider.
- Cloud AI requires explicit per-action consent before any personal information leaves the machine.
- All transfers to a cloud provider are recorded in an `audit_log` table.
- All user data lives in a single SQLite file under the user's data directory.
- The SQLite database uses default rollback journal mode (no WAL in Phase 1), producing a single file for simpler backup/restore.

## Threat model (to be completed)
- Untrusted job descriptions treated as untrusted input (XSS + prompt injection).
- Secrets never logged or committed.
- SQLite migrations transactional with pre-migration backups.
- Database file contains PII; file system permissions protect it at rest. OS disk encryption is recommended. Encrypted-at-rest database (SQLCipher) is a Phase 2 candidate.

## Dependencies
- `npm audit` runs in CI. Lockfile committed; `npm ci` used for reproducible installs.
- keytar is a native module; see build notes in `docs/`.
- better-sqlite3 is a native module; rebuilt for Electron's ABI by electron-builder at package time.

## Future work
- Encrypted-at-rest database (SQLCipher) — candidate for Phase 2.
- OS disk encryption recommendation for users.
