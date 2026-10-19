# Local Career Assistant — Agent Conventions

This file guides AI coding agents and humans working on this repository.

## Stack
- Electron (main + preload + renderer), React 18, TypeScript, Vite, Tailwind CSS
- SQLite (main process only, via better-sqlite3) — Phase 1
- Ollama (local AI, default) — Phase 2
- Vitest + Playwright for testing
- electron-builder for packaging

## Directory layout
```
src/main/        Electron main process (Node.js, SQLite, keytar live here)
src/preload/     Narrowly scoped contextBridge API (no renderer filesystem access)
src/renderer/    React UI (no Node.js, no direct DB access)
tests/           Vitest unit/integration + Playwright E2E
```

## Rules
1. **No Node.js in renderer.** SQLite, keytar, and filesystem access live only in `src/main/`. The renderer reaches them through `window.electronAPI` (preload) only.
2. **Preload API is narrowly scoped.** Add IPC channels only by explicit review. No generic `invoke` passthrough without a channel allow-list.
3. **TypeScript `strict`.** No `any` without a comment justifying it.
4. **Conventional Commits.** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
5. **Branches.** `main` is protected. Work on feature branches; open PRs; CI must pass before merge.
6. **Tests co-located.** `*.test.ts` next to source, or under `tests/`.
7. **No secrets in code.** API keys go in the OS keychain (keytar, main process only). `.env` is gitignored. Never log credentials or PII.
8. **DOMPurify prevents XSS, not prompt injection.** Prompt-injection defense is in the system prompt + strict output schema + output validation.
9. **Verification must fail hard.** `lint`, `typecheck`, `test`, and `test:e2e` all exit non-zero on failure. CI gates on all of them.

## Scripts
- `npm run dev` — start Vite dev server (Electron loads localhost:5173)
- `npm run build` — compile main/preload, build renderer, package with electron-builder
- `npm run lint` — ESLint
- `npm run typecheck` — tsc --noEmit for web and node configs
- `npm test` — Vitest run
- `npm run test:e2e` — Playwright
- `npm run audit` — npm audit
