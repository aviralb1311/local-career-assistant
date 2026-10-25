import { existsSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const preloadDir = join(process.cwd(), 'dist', 'electron', 'preload');
const indexJs = join(preloadDir, 'index.js');
const channelsJs = join(preloadDir, 'channels.js');
const indexCjs = join(preloadDir, 'index.cjs');
const channelsCjs = join(preloadDir, 'channels.cjs');

if (existsSync(channelsJs)) {
  renameSync(channelsJs, channelsCjs);
} else if (existsSync(join(preloadDir, 'channels.cjs')) && !existsSync(channelsCjs)) {
  // already moved
}

if (existsSync(indexJs)) {
  renameSync(indexJs, indexCjs);
} else if (!existsSync(indexCjs) && existsSync(join(preloadDir, 'index.cjs'))) {
  // ok
}

if (existsSync(indexCjs)) {
  let content = readFileSync(indexCjs, 'utf8');
  content = content.replace(/require\(['"]\.\/channels\.js['"]\)/g, "require('./channels.cjs')");
  content = content.replace(/require\(['"]\.\/channels['"]\)/g, "require('./channels.cjs')");
  writeFileSync(indexCjs, content);
}
