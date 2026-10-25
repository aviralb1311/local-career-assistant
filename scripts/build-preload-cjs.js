import { existsSync, renameSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const preloadDir = join(process.cwd(), 'dist', 'electron', 'preload');
const indexJs = join(preloadDir, 'index.js');
const channelsJs = join(preloadDir, 'channels.js');
const indexCjs = join(preloadDir, 'index.cjs');
const channelsCjs = join(preloadDir, 'channels.cjs');

if (existsSync(indexJs)) {
  renameSync(indexJs, indexCjs);
}
if (existsSync(channelsJs)) {
  renameSync(channelsJs, channelsCjs);
}

// Fix require paths in index.cjs
if (existsSync(indexCjs)) {
  const fs = await import('node:fs');
  let content = fs.readFileSync(indexCjs, 'utf8');
  content = content.replace(/require\(['"]\.\/channels\.js['"]\)/g, "require('./channels.cjs')");
  fs.writeFileSync(indexCjs, content);
}
