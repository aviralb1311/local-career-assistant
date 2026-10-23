import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export default function globalSetup() {
  execSync('npm run build:main && npm run build:renderer', { stdio: 'inherit' });
  const entry = 'dist/electron/main/index.js';
  if (!existsSync(entry)) throw new Error(`Missing built entry point: ${entry}`);
  execSync(`node --check ${entry}`, { stdio: 'inherit' });
}
