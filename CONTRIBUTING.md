# Contributing

## Process
1. Fork the repository, create a feature branch from `main`.
2. Implement changes following `AGENTS.md` conventions.
3. Run `npm run lint`, `npm run typecheck`, `npm test` locally.
4. Open a pull request against `main`.
5. CI must pass (lint, typecheck, unit tests, E2E) before merge.
6. Use Conventional Commits for commit messages.

## Conventional Commits
Examples: `feat: add cv import`, `fix: resolve lint warnings`, `docs: update README`.

## Testing
- Unit/integration: Vitest
- E2E: Playwright (mocked AI providers; no live model calls)
- All tests must pass in CI before merge.

## Security
- Never commit secrets or credentials.
- Report security issues privately (see `SECURITY.md`).
