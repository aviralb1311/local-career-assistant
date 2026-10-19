# Architecture — Local Career Assistant

## Status
THIS DOCUMENT IS A STUB. Full architecture defined in `PLAN.md`.

## Layered architecture
```
UI (React + Vite + Tailwind)
   | IPC via contextBridge (narrowly scoped)
Desktop backend (Electron main)
   | SQLite (WAL, migrations)
   | LLM provider (Ollama default; cloud optional, consent-gated)
Local data: app.db (single file), attachments/, backups/
```

## Security boundaries
- Renderer: no Node.js, no direct DB access
- Preload: typed, allow-listed IPC only
- Main process: SQLite, keytar, file system, LLM provider

See `PLAN.md` for the complete architecture, technology trade-offs, and phased plan.
