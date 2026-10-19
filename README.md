# Local Career Assistant

Local-first AI Career Assistant. Import and manage your CV, discover job descriptions, evaluate job fit with evidence from your CV, generate tailored CVs and cover letters, and track applications — all running locally on your machine.

## Stack
- Electron + React + TypeScript + Vite + Tailwind CSS
- SQLite (single local database file)
- Ollama (default local AI provider); optional cloud provider behind explicit consent
- Vitest + Playwright (tests use mocked AI providers)
- electron-builder

## Prerequisites

### Node.js
Node.js 20+ and npm.

### Ollama (local AI)
Ollama is required for the local AI provider. Install it from https://ollama.com, then pull a model:

```bash
ollama pull llama3.1
```

The app defaults to Ollama and works entirely offline for local records. No cloud provider is contacted unless you explicitly opt in.

## Development

```bash
npm install
npm run dev        # start Vite dev server (Electron loads localhost:5173)
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm test           # Vitest
npm run test:e2e   # Playwright (E2E, mocked AI providers)
npm run audit      # npm audit
```

## Data location

All personal data is stored in a single SQLite file (`app.db`) under your platform's user data directory:
- Linux: `~/.local-career-assistant/app.db`
- macOS: `~/Library/Application Support/Local Career Assistant/app.db`
- Windows: `%APPDATA%\Local Career Assistant\app.db`

The database uses SQLite's default rollback journal mode (single file, no WAL sidecar files in Phase 1).

Backups are not yet implemented (planned for a later phase). Until then, manually copy the `app.db` file to back up your data.

## Security
- Cloud AI is off by default.
- Explicit consent is required before any personal information is sent to a cloud provider.
- All cloud transfers are recorded in an audit log.
- Job descriptions are treated as untrusted input.

See `SECURITY.md`, `ARCHITECTURE.md`, and `PLAN.md` for details.

## License
MIT
