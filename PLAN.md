# Local Career Assistant — Project Plan

Status: **Phases 0–4 implemented on `origin/main`. Phase 5 (polish + hardening) in progress on `feat/phase-5-workflow-e2e`.**

## 1. Repository status
- `/home/avrbt/Downloads/local-career-assistant` is a git repo on branch `feat/phase-5-workflow-e2e`
- `origin/main` is ahead of local `main`; Phases 0–4 are merged on `origin/main` (PRs #3, #4, #6). PR #8 (backup/restore connection-safety fix) is merged on `origin/main` only; it is not in the current working tree.
- Phase 0 commit `41359cb` done; all verification (lint, typecheck, test, e2e, build) passes exit 0
- Phase 1 persistence hardening applied (db lifecycle guard + idempotent close, error dialog sanitization, migration copy cleanup, build command integration)
- Phase 2 AI layer implemented (providers, consent gating, secrets management, audit log, settings UI)
- Phase 3 core flow UI implemented (CV import/paste, profile editor, JD editor, fit evaluation, tailored CV/cover letter generator, preview + export)
- Phase 4 application tracking implemented (applications table UI, status pipeline, dates, notes, JD linking)
- PR #8 (backup/restore connection-safety fix) merged on `origin/main` only (read-only backup sources, safe restore with connection lifecycle management, regression tests); not present in the current working tree.

## 2. Goals and non-goals

---

## 2. Goals and non-goals

### Essential (MVP)
- Import and manage a CV / candidate profile, stored locally.
- Manually add job descriptions (paste text).
- Evaluate job fit against the CV with cited evidence, using a local AI provider.
- Generate a tailored CV and cover letter; export them.
- Track applications (status, dates, notes).
- Single local SQLite database; migrations; backup/restore; tests; security docs.
- Cloud AI optional, behind explicit per-action consent; no network unless the user opts in.

### Later enhancements (explicitly out of MVP)
- URL fetching / scraping of job postings (treat as untrusted input; add later with sandboxing).
- Cloud sync / accounts / paid services.
- End-to-end encrypted at-rest database (SQLCipher) — Phase 2 candidate.
- Interview preparation module, calendar integration, email templates, Chrome extension.
- Auto-updater, code signing, multi-user, real-time collaboration.

---

## 3. Recommended architecture (local desktop app)

A layered, single-developer-friendly architecture. All personal data stays in one SQLite file under the user's data directory. The UI talks to a thin desktop backend; AI is behind an interchangeable provider interface.

```
┌─────────────────────────────────────┐
│  UI layer (React + Vite + TypeScript)│
│  - components, forms, pages          │
└──────────────┬──────────────────────┘
               │ IPC / Tauri commands
┌──────────────▼──────────────────────┐
│  Desktop backend (Tauri / Electron) │
│  - service layer (profile, JD, eval)│
│  - SQLite + migrations              │
│  - LLM provider abstraction         │
└──────────────┬──────────────────────┘
               │ SQL / file I/O
┌──────────────▼──────────────────────┐
│  Local data: app.db (SQLite, WAL)   │
│  attachments/ (exports, PDFs)       │
│  backups/ (user-selected db copies)    │
└─────────────────────────────────────┘
                 ▲ optional HTTP
           ┌─────┴─────┐
           │ Ollama    │ local AI (default)
           │ OpenAI    │ cloud AI (consent-gated)
           └───────────┘
```

Key design rules:
- **One database file.** Backing up = copying one file. Restoring = replacing one file.
- **Untrusted input boundary.** Job descriptions and pasted content are never rendered raw; sanitized before display (DOMPurify), never `innerHTML`, strict CSP.
- **Provider abstraction.** `LLMProvider` interface (`generateText`, `generateJSON`). Local Ollama is default; OpenAI-compatible cloud is a second implementation gated by consent.
- **Consent logging.** Every cloud transfer recorded in an `audit_log` table (what, when, provider, user-initiated). A global "allow cloud AI" toggle plus per-action modals.
- **No secrets in code.** API keys stored in the OS keychain (or prompted per session), never committed.

---

## 4. Technology comparison and trade-offs

| Choice | Options | Trade-offs | Recommendation |
|--------|---------|------------|----------------|
| **Desktop runtime** | **Tauri v2** vs Electron | Tauri: tiny binary (~few MB), system webview, Rust backend, smaller attack surface; but Rust learning curve and smaller AI-tool codegen support. Electron: all TypeScript, huge ecosystem, AI tools generate TS fluently; ~100–200 MB binary, Chromium bundled, more memory. | **Electron** for an AI-assisted single dev (all-TS, fastest iteration). Tauri noted as a lighter alternative if bundle size matters later. |
| **UI framework** | React + Vite vs Vue vs Svelte | React: most AI-tool support, plentiful components. Vue/Svelte: fine but less codegen help. | **React + TypeScript + Vite** |
| **Database** | **SQLite** vs embedded Postgres vs JSON files | SQLite: single file, zero server, trivial migrations/backups, ACID, WAL mode; battle-tested. JSON files: simpler initially but no querying, weak consistency, harder migrations. | **SQLite** (`better-sqlite3` in Electron main/preload) |
| **Migrations** | Folder of numbered `.sql` files applied in a transaction on startup vs ORM migrations | SQL files: explicit, auditable, simple. ORM: more magic, harder to inspect. | **Numbered SQL migration files** |
| **AI provider** | Ollama (local, llama.cpp) vs OpenAI API vs local transformers.js | Ollama: runs locally, private, free, easy HTTP API; requires user to install Ollama. OpenAI: capable but sends data to cloud, costs money, needs consent. transformers.js: fully in-browser but weak models, large bundle. | **Ollama default**; OpenAI-compatible optional later |
| **Language** | All TypeScript vs TS + Rust vs TS + Python | All TS: one language, AI tools excel, simplest for one dev. Rust/Python: better native AI libs but two-language tax. | **TypeScript throughout** |
| **Packaging** | electron-builder / electron-forge | Standard, auto-updates later, code signing optional. | **electron-builder** |
| **Testing** | Vitest + Playwright | Vitest: fast unit/integration. Playwright: E2E through real UI. | **Vitest + Playwright** |
| **Styling** | CSS modules / Tailwind | Tailwind: fast, AI-friendly. | **Tailwind CSS** |

### Why not Python backend?
Python has the best AI ecosystem, but a Python + TypeScript split means two languages, two test suites, and IPC complexity for a single developer. Keep it to TypeScript; call Ollama via plain `fetch`.

---

## 5. Recommended stack (summary)

- Runtime: **Electron** (main + preload + renderer)
- UI: **React 18 + TypeScript + Vite + Tailwind**
- Database: **SQLite** via `better-sqlite3`, default rollback journal mode (`journal_mode = DELETE`, no WAL in Phase 1), migration folder
- AI: **Ollama** (default, local) via HTTP; optional OpenAI-compatible provider
- Packaging: **electron-builder**
- Testing: **Vitest** (unit/integration) + **Playwright** (E2E)
- Lint/format: **ESLint + Prettier**, TypeScript `strict`
- Secrets: **keytar** (OS keychain) or prompt-per-session
- Sanitization: **DOMPurify**
- PDF export: **pdfkit** or **@react-pdf/renderer**

Data directory (platform-default, e.g. `~/.local-career-assistant` on Linux):
```
data/
  app.db          # SQLite database (single source of truth)
  attachments/    # exported CVs, cover letters, PDFs
  backups/        # user-selected backup copies of app.db
```

---

## 6. Data model (MVP)

| Table | Purpose |
|-------|---------|
| `profiles` | Candidate profile (name, email, phone, summary, skills, locations, links) |
| `cv_versions` | Imported CVs: raw text, parsed JSON, source (file/paste), created_at |
| `job_descriptions` | JD text, title, company, URL (untrusted, sanitized on read), created_at |
| `fit_evaluations` | score, verdict, evidence (quote + source field), suggestions, model used, provider |
| `tailored_documents` | type (cv/cover_letter), generated markdown/html, source cv/jd/evaluation IDs |
| `applications` | job_id, status (applied/interviewing/offered/rejected), applied_at, notes, contact |
| `audit_log` | action, provider, data_categories, user_consented, timestamp |
| `settings` | key/value (provider, ollama_model, allow_cloud, last_backup_at) |
| `schema_migrations` | version, applied_at (tracks applied migrations) |

Relationships: `fit_evaluations` references `cv_versions` + `job_descriptions`; `tailored_documents` references evaluation; `applications` references `job_description`.

---

## 7. MVP scope and acceptance criteria

### In MVP
1. Scaffold repo: Electron + React + TS + Vite, lint/format/CI, docs folders.
2. SQLite layer: schema, migrations runner (transactional), default rollback journal mode (`journal_mode = DELETE`, no WAL in Phase 1), backup/restore (copy file).
3. CV import: paste text or drop a `.txt`/`.md` file → stored as `cv_versions`; simple profile extraction (manual edit allowed).
4. Job descriptions: create/edit/paste text; stored sanitized.
5. Fit evaluation: select CV + JD → local Ollama call → score, shortlist verdict, evidence quotes from CV, suggestions. Displayed with citations.
6. Tailored documents: generate tailored CV + cover letter from evaluation; preview; export to Markdown/text.
7. Application tracking: create application from a JD, status pipeline, dates, notes.
8. Settings: Ollama endpoint/model, cloud provider toggle (off by default), per-action consent modal, "restore from backup" button.
9. Tests: unit + integration for DB, migrations, prompt builders, sanitization; E2E happy path (import → JD → evaluate → generate → export → backup → restore). No real LLM in tests (fixtures/mocks).
10. Docs: `SECURITY.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, README with setup (install Ollama, run dev).

### Acceptance criteria (definition of done for MVP)
- [ ] Zero outbound network calls when cloud AI is disabled (verify by blocking network in dev).
- [ ] All user data in a single `app.db` file; backup/restore round-trips without data loss.
- [ ] Migrations apply cleanly on a fresh DB and are idempotent on repeat runs.
- [ ] CV import → profile visible and editable.
- [ ] JD paste → fit evaluation returns score + at least one evidence quote verbatim from the CV.
- [ ] Tailored CV/cover letter grounded only in evidence from the candidate's CV; no invented qualifications, roles, dates, or work experience.
- [ ] Generate tailored CV and cover letter; export opens/saves a file.
- [ ] Application record created with status pipeline; list view filters by status.
- [ ] Cloud AI requires explicit per-action consent before any personal information is sent; consent recorded in `audit_log`; no sensitive content or secrets in logs; network off unless explicitly opted in.
- [ ] `npm run lint`, `npm run typecheck`, `npm test` all pass in CI.
- [ ] E2E core flow passes headless.

### Out of MVP (do not build yet)
- PDF import/parsing (start with `.txt`/`.md` paste; PDF parsing is a later enhancement).
- URL fetching/scraping.
- Real-time sync, accounts, cloud storage.
- Encrypted-at-rest DB (note in SECURITY.md as future work).
- Interview prep module.

---

## 8. Phased implementation plan with dependencies

| Phase | Work | Depends on | Status | Deliverable |
|-------|------|------------|--------|-------------|
| **0** | Repo scaffold: Electron + Vite + React + TS, eslint/prettier/tsconfig, electron-builder config, CI workflow, docs folder structure, `AGENTS.md` conventions | — | **Complete** | Buildable dev app, `npm run dev` works |
| **1** | Data layer: SQLite connection (better-sqlite3 in main process only), default rollback journal mode (no WAL in Phase 1), transactional numbered SQL migrations applied internally at startup, `schema_migrations` tracking table, `PRAGMA integrity_check` on startup, narrowly scoped read-only IPC (`db:ping`, `db:version`), isolated tests using temp DB paths, better-sqlite3 ABI verification with Electron runtime | Phase 0 | **Complete** | Working local DB persistence infrastructure with safe migrations and version tracking |
| **2** | AI layer: `LLMProvider` interface, Ollama provider (HTTP), OpenAI-compatible provider stub, consent gate + audit logging, settings UI (provider/model/cloud toggle), keychain secret storage | Phase 1 | **Complete** | Local AI callable from app; cloud disabled by default |
| **3** | Core flow UI: CV import/paste, profile editor, JD editor, fit evaluation view (score, verdict, evidence, suggestions), tailored CV/cover letter generator, preview + export (Markdown/text) | Phases 1–2 | **Complete** | End-to-end local CV→JD→evaluation→document flow |
| **4** | Application tracking: applications table UI, status pipeline, dates, notes, link to JD; "restore from backup" in settings | Phases 1–3 | **Complete** | Full MVP feature set complete |
| **5** | Polish + hardening: CSP, DOMPurify on all rendered untrusted content, E2E Playwright suite, PDF export option, `SECURITY.md` threat model, performance check, release build | Phases 1–4 | **In progress** | Hardened MVP ready for release candidate |

### Phase 0 security and scaffolding constraints (adjusted)

- Electron security defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` where compatible; preload exposes a narrowly scoped API via `contextBridge`; no unrestricted IPC or renderer filesystem access.
- SQLite and native Node.js modules stay out of the renderer entirely. They live in the main process and are reached only through the preload IPC boundary (Phase 1 database-service boundary).
- Secrets (API keys) live behind a trusted service boundary (main process + keytar OS keychain). Document keytar's native build requirements; never log or commit credentials.
- Commit the package-manager lockfile; CI uses `npm ci`; dependency auditing (`npm audit`) added to CI.
- All verification scripts (lint, typecheck, unit tests, E2E) must fail non-zero on failure; CI gates on them.
- Playwright E2E configured to run on pull requests and pushes to `main`.
- DOMPurify prevents XSS; it does NOT independently prevent prompt injection. Prompt-injection defense lives in the system prompt + strict output schema + output validation (see risk table).

### Phase 0 build and dependency-audit adjustments (post-review)

#### Electron Builder configuration changes
The `electron-builder.json` was adjusted after the first production build attempt:

- Removed `directories.app: "dist/electron"`: electron-builder expects a `package.json` in the app directory when using the two-package structure. The `tsc -p tsconfig.node.json` compile step only emits JavaScript to `dist/electron/` with no `package.json`, so the build failed with "Cannot find package.json in the dist/electron". Removing `directories.app` causes electron-builder to use the root `package.json` as the application metadata, which is correct for a single-package structure.
- Removed `extraMetadata.main`: no longer needed once `directories.app` is removed; the `main` field in the root `package.json` (`dist/electron/main/index.js`) is used directly.
- Added `author.email` to `package.json`: required by electron-builder for Linux `.deb` target packaging (maintainer field). Set to `Local Career Assistant <maintainer@localcareerassistant.local>`.

#### npm audit findings (Phase 0)
`npm audit` reports 33 vulnerabilities across the development toolchain:

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 21 |
| Moderate | 8 |
| Low | 0 |
| Info | 0 |

**Direct vulnerabilities (8):** `@typescript-eslint/eslint-plugin` (high), `@typescript-eslint/parser` (high), `@vitest/ui` (critical), `electron` (high), `electron-builder` (high), `tailwindcss` (high), `vite` (high), `vitest` (critical).

**Transitive vulnerabilities (25):** includes `tar` (critical), `tinypool` (critical), `app-builder-lib` (high), `extract-zip` (high), `builder-util-runtime` (high), and others.

**Classification:** All reported findings are in development/tooling dependencies only. The production runtime dependencies (`better-sqlite3`, `keytar`, and their transitive runtime deps) are not flagged.

**Security note:** Although the findings are in devDependencies, build tools can still affect the integrity and security of shipped releases (e.g., a compromised bundler or packager could inject code into the packaged application). These findings must not be ignored silently.

**Remediation plan:** Do not run `npm audit fix --force` blindly, as all available fixes require semver-major breaking upgrades to the development toolchain (Electron, Vite, Vitest, Tailwind, TypeScript ESLint). A deliberate dependency-upgrade task is tracked as a follow-up:
- Test each major-version upgrade in isolation on a feature branch.
- Run lint, typecheck, unit tests, E2E, and production build after each upgrade.
- Commit only when all verification passes.

CI audit configuration: `npm audit --audit-level=critical` runs without `|| true`, so critical findings fail the CI build visibly. Moderate and high findings are reported but do not block CI at this stage; they are reviewed as part of the dependency-upgrade follow-up task.

### Phase 1 persistence infrastructure documentation

#### Database location
The SQLite database is stored at `app.getPath('userData')/app.db`:
- Linux: `~/.local-career-assistant/app.db`
- macOS: `~/Library/Application Support/Local Career Assistant/app.db`
- Windows: `%APPDATA%\Local Career Assistant\app.db`

The path can be overridden for testing by passing a `dbPath` argument to `openDatabase(dbPath)` in `src/main/db.ts`. Tests always inject temp paths and never open the real user database.

#### Journal mode decision (Phase 1)
SQLite's default rollback journal mode (`journal_mode = DELETE`) is used in Phase 1. WAL mode is intentionally not enabled.

Rationale:
- Single-user desktop app with one writer (the main process only). No concurrent writer contention to solve.
- WAL creates sidecar files (`app.db-wal`, `app.db-shm`) that complicate backup/restore (must checkpoint or copy all three files).
- Default journal mode gives a single-file database, simpler for backup/restore.

WAL can be revisited in a later phase if read/write concurrency becomes a requirement. If enabled later, backup/restore must run `PRAGMA wal_checkpoint(TRUNCATE)` before copying the database file.

#### Migration mechanism
Migration files are numbered `.sql` files in `src/main/migrations/` (e.g., `001_init.sql`). A build step (`scripts/copy-migrations.js`) copies them to `dist/electron/migrations/` before packaging. `electron-builder.json` includes `dist/electron/migrations/**/*` in the packaged app.

At startup, the main process:
1. Opens the SQLite database with `PRAGMA foreign_keys = ON` and `PRAGMA synchronous = NORMAL`.
2. Runs `PRAGMA integrity_check` and reports failures without deleting data.
3. Applies pending migrations in numeric order, each inside its own `BEGIN IMMEDIATE ... COMMIT` transaction.
4. Records each applied version in `schema_migrations`.

A failed migration rolls back entirely, preserves all existing data, and leaves the recorded schema version unchanged. Migration failure is distinct from database corruption.

#### Main-process ownership
SQLite and filesystem access live exclusively in `src/main/`. The renderer has no direct database access. IPC is narrowly scoped and read-only (`db:ping`, `db:version`). Migration execution is internal to the main process and is not exposed to the renderer.


| Phase | Definition of done | Status |
|-------|--------------------|--------|
| 0 | `npm run dev` launches Electron + Vite + React; `npm run lint`, `npm run typecheck`, `npm test` pass; CI workflow runs on push; `AGENTS.md` and docs folders exist | **Complete** |
| 1 | SQLite connects at `app.getPath('userData')/app.db`; default rollback journal mode (no WAL); foreign keys enabled; all numbered migrations apply transactionally and are idempotent; failed migrations roll back with version unchanged; `PRAGMA integrity_check` runs on startup and failures are reported without deleting data; read-only IPC (`db:ping`, `db:version`) only; tests use injected temp DB paths, never the real user database; better-sqlite3 verified compatible with Electron 28 runtime; migration files bundled in packaged app; openDatabase guard prevents double-open; closeDatabase is idempotent; error dialogs sanitize file paths; migration copy removes stale output before copying; build commands invoke migration copy | **Complete** |
| 2 | `LLMProvider` interface implemented; Ollama provider calls local model and returns structured output; OpenAI-compatible provider stub exists; cloud disabled by default; per-action consent modal + `audit_log` recording; no secrets or PII in logs; AI IPC handlers (12 channels) registered in main process with narrow allow-list in preload; settings UI with provider list, cloud toggle consent-gated, read-only Ollama settings | **Complete** |
| 3 | CV import/paste → editable profile; JD paste → fit evaluation returns score + verbatim CV evidence quotes; tailored CV + cover letter generated only from CV evidence (no invented qualifications); preview + Markdown/text export | **Complete** |
| 4 | Applications table with status pipeline, dates, notes, JD linking; restore-from-backup in settings; full MVP feature set complete end-to-end | **Complete** |
| 5 | CSP + DOMPurify on all untrusted content; E2E Playwright suite passes with mocked AI providers; PDF export option; `SECURITY.md` threat model complete; release build via electron-builder | **In progress** |

---

## 9. Privacy, security, and data-loss risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cloud AI sends CV/JD to third party | High | Cloud provider off by default; explicit per-action consent modal; `audit_log` records every transfer; global network kill-switch in settings |
| Local AI (Ollama) still processes data locally | Low | Data never leaves machine; document that Ollama must be user-installed and trusted |
| Rendering untrusted JD content (XSS) | High | DOMPurify sanitization, no `innerHTML`, strict CSP, text-only rendering where possible |
| Secrets/API keys committed or logged | High | keytar / OS keychain; never log keys; `.env` in `.gitignore`; `npm audit` in CI |
| SQLite corruption / failed migration | Medium | Default rollback journal mode (`journal_mode = DELETE`, no WAL in Phase 1), migrations in transactions, `PRAGMA integrity_check` on startup, backups before migrations |
| Data loss (device failure) | High | Backup/restore feature (user-selected backup file, read-only integrity check, safety snapshot, rollback on failure), store DB in user data dir (not temp) |
| Prompt injection from untrusted JDs | High | System prompt instructs model to treat JD as data only, never execute JD instructions; JD sanitized on read; strict output schema; model output validated before use |
| Offline support for local records | Medium | All CRUD, evaluation, export, and backup/restore work offline with Ollama; README documents Ollama installation and required model (e.g. `ollama pull <model>`) |
| Sensitive data in logs | High | No PII, CV content, or secrets in console/app logs; redaction before any logging |
| Dependency supply chain | Medium | `npm audit` / `npm ci` in CI, lockfile committed, minimal dependencies |
| Physical access to DB file | Medium | Document OS disk encryption recommendation; optional SQLCipher encryption listed as Phase 2 |

Security documentation: `SECURITY.md` will cover threat model, data flow, consent model, encryption stance, dependency auditing, and the "no cloud by default" guarantee.

---

## 10. Testing strategy and project conventions

### Testing pyramid
1. **Unit (Vitest)** — pure functions: prompt builders, sanitization helpers, score/verdict logic, migration SQL parsing, export formatting. Fast, no Electron needed where possible.
2. **Integration (Vitest + temp SQLite)** — DB services, migrations apply/idempotency, backup/restore round-trip, provider interface with mocked `fetch`.
3. **E2E (Playwright)** — real Electron window: full happy path (import CV → add JD → evaluate → generate → export → backup → restore). Tests use recorded LLM fixtures / mocked AI providers, never real model calls.
4. **CI** — `npm run lint`, `npm run typecheck`, `npm test` (unit+integration) on every push; E2E on `main` and PRs.

### Conventions
- TypeScript `strict`; no `any` without justification.
- Layers: `src/services` (business logic), `src/db` (SQL + migrations), `src/ai` (providers), `src/components` (React UI), `src/main` / `src/preload` (Electron).
- Tests co-located: `*.test.ts` next to source, or `__tests__/` for services.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Branches: `main` protected; feature branches; PRs required before merge.
- One language (TypeScript) everywhere; no Python/Rust unless a later phase justifies it.

---

## 11. Concepts to learn per phase

| Phase | Concepts to learn before/during |
|-------|---------------------------------|
| 0 | Electron main/renderer/preload split and IPC, Vite + React + TypeScript setup, `package.json` scripts, `.gitignore` for node/env |
| 1 | SQLite (journal modes, transactions, PRAGMAs), SQL migration best practices, Node file-system paths per OS, `better-sqlite3` API |
| 2 | LLM prompting (system/user messages, few-shot, temperature), structured JSON output from models, Ollama HTTP API (`/api/chat`), token limits, consent UX patterns |
| 3 | DOM sanitization (DOMPurify), CSP headers, Markdown rendering, file save dialogs in Electron, PDF generation options |
| 4 | OS keychain/keytar, audit-log design, status-pipeline state machines, export/import data formats |
| 5 | Playwright E2E for desktop apps, threat modeling, code signing & app packaging basics, accessibility basics |

---

## 12. Next step

Phases 0–4 are implemented and verified (lint, typecheck, test, build all pass). E2E tests cannot run in this environment (no display server).

The MVP feature set is complete. Remaining work is Phase 5 (polish + hardening):

- **DOMPurify integration:** Sanitize all rendered untrusted content (CV text, job descriptions, document previews) in `src/renderer/Workflow.tsx` and `src/renderer/Tracking.tsx`. No `innerHTML` usage.
- **CSP hardening:** Remove `'unsafe-inline'` from `src/renderer/index.html` Content-Security-Policy where possible.
- **Comprehensive E2E coverage:** Expand `tests/e2e/` beyond the two smoke tests to a full happy-path suite (import CV → add JD → evaluate → generate document → export → backup → restore) with mocked AI providers.
- **PDF export option:** Add PDF generation (e.g., `pdfkit`) as an export format alongside Markdown/text.
- **Dependency remediation:** Address `npm audit` critical/high findings in development toolchain one at a time on feature branches, running full verification after each upgrade.
- **Release build:** Verify `npm run build` completes via electron-builder and artifacts exist.

Nothing is committed. Run `git status` and `git diff` to review all changes before committing.
