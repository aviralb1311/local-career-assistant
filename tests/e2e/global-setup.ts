import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export default function globalSetup() {
  // Rebuild native dependencies for the bundled Electron runtime.
  // better-sqlite3 and keytar ship prebuilt binaries for system Node, but
  // Electron uses a different NODE_MODULE_VERSION, so the preload/main
  // process fails to dlopen them. Rebuilding here ensures E2E tests run
  // against a compatible binary. Unit/integration tests use system Node and
  // are unaffected; they should be run without this step.
  execSync('npx electron-rebuild -f', { stdio: 'inherit' });
  execSync('npm run build:main && npm run build:renderer', { stdio: 'inherit' });
  const entry = 'dist/electron/main/index.js';
  if (!existsSync(entry)) throw new Error(`Missing built entry point: ${entry}`);
  execSync(`node --check ${entry}`, { stdio: 'inherit' });
}
