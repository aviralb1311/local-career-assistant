import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, '..', 'src', 'main', 'fonts');
const OUTPUT_DIR = join(__dirname, '..', 'dist', 'electron', 'main', 'fonts');

/**
 * Copies font files from sourceDir to outputDir, removing any stale
 * generated font files from outputDir first.
 *
 * Font files are bundled with the packaged Electron app so PDF export
 * can render Unicode and CJK text without relying on system fonts.
 *
 * @returns {number} The number of font files copied.
 */
export function copyAssets(sourceDir = SOURCE_DIR, outputDir = OUTPUT_DIR) {
  if (!existsSync(sourceDir)) {
    throw new Error(
      `Source assets directory not found: ${sourceDir}. Fonts are required for packaged builds.`
    );
  }

  if (existsSync(outputDir)) {
    const existing = readdirSync(outputDir).filter((f) => f.endsWith('.ttf'));
    for (const file of existing) {
      rmSync(join(outputDir, file), { force: true });
    }
  }

  mkdirSync(outputDir, { recursive: true });

  const files = readdirSync(sourceDir).filter((f) => f.endsWith('.ttf'));

  let count = 0;
  for (const file of files) {
    const src = join(sourceDir, file);
    const dest = join(outputDir, file);
    if (statSync(src).isFile()) {
      copyFileSync(src, dest);
      count++;
    }
  }

  return count;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = copyAssets();
  console.log(`Copied ${count} font file(s) to ${OUTPUT_DIR}`);
}
