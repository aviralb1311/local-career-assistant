import { execSync } from 'node:child_process';

export default function globalSetup() {
  execSync('npm run build:main && npm run build:renderer', { stdio: 'inherit' });
}
