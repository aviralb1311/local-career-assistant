import { existsSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const preloadDir = join(process.cwd(), 'dist', 'electron', 'preload');
const indexJs = join(preloadDir, 'index.js');
const channelsJs = join(preloadDir, 'channels.js');
const indexCjs = join(preloadDir, 'index.cjs');
const channelsCjs = join(preloadDir, 'channels.cjs');

if (existsSync(channelsJs)) {
  renameSync(channelsJs, channelsCjs);
}
if (existsSync(indexJs)) {
  renameSync(indexJs, indexCjs);
}

if (existsSync(indexCjs)) {
  let content = readFileSync(indexCjs, 'utf8');
  content = content.replace(/require\(['"]\.\/channels\.js['"]\)/g, "require('./channels.cjs')");
  content = content.replace(/require\(['"]\.\/channels['"]\)/g, "require('./channels.cjs')");
  writeFileSync(indexCjs, content);
}

// Ensure channels.cjs exists and index.cjs can resolve it
const hasChannelsCjs = existsSync(channelsCjs);
if (!hasChannelsCjs) {
  throw new Error('channels.cjs not found after build');
}
