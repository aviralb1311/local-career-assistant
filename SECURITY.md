# Security — Local Career Assistant

## Status
THIS DOCUMENT IS A STUB. It will be completed in Phase 5 (polish + hardening).

## Core guarantees (by design)
- No cloud AI by default. Ollama (local) is the default provider.
- Cloud AI requires explicit per-action consent before any personal information leaves the machine.
- All transfers to a cloud provider are recorded in an `audit_log` table.
- All user data lives in a single SQLite file under the user's data directory.
- Backup/restore operates on that single file.

## Threat model (to be completed)
- Untrusted job descriptions treated as untrusted input (XSS + prompt injection).
- Secrets never logged or committed.
- SQLite migrations transactional with pre-migration backups.

## Dependencies
- `npm audit` runs in CI. Lockfile committed; `npm ci` used for reproducible installs.
- keytar is a native module; see build notes in `docs/`.

## Future work
- Encrypted-at-rest database (SQLCipher) — candidate for Phase 2.
- OS disk encryption recommendation for users.
