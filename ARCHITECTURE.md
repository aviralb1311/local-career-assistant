# Architecture — Local Career Assistant

## Layered architecture
```
UI (React + Vite + Tailwind)
   | IPC via contextBridge (narrowly scoped, read-only DB channels)
Desktop backend (Electron main process)
   | SQLite (app.db, rollback journal mode, foreign keys ON)
   | schema_migrations tracking table
   | LLM provider (Ollama default; cloud optional, consent-gated — Phase 2+)
Local data: app.db (single file), attachments/, backups/
```

## Database location
`app.getPath('userData')/app.db` (platform-specific user data directory).

## Security boundaries
- **Renderer:** No Node.js, no direct DB access, no filesystem access.
- **Preload:** Typed, allow-listed IPC only. Read-only DB channels: `db:ping`, `db:version`.
- **Main process:** SQLite database, migrations, keytar, file system, LLM provider. Database connection is a singleton; the renderer never receives `better-sqlite3` objects.

See `PLAN.md` for the complete architecture, technology trade-offs, and phased plan.
