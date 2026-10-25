import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

mkdirSync('dist/electron/preload', { recursive: true });

await build({
  entryPoints: ['src/preload/index.ts'],
  outfile: 'dist/electron/preload/index.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  target: 'node18',
});
