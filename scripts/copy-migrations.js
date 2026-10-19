import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, '..', 'src', 'main', 'migrations');
const OUTPUT_DIR = join(__dirname, '..', 'dist', 'electron', 'migrations');

/**
 * Copies migration .sql files from sourceDir to outputDir, removing any
 * stale generated .sql files from outputDir first.
 *
 * Source migration files and the user's database are never touched.
 *
 * @returns {number} The number of migration files copied.
 */
export function copyMigrations(sourceDir = SOURCE_DIR, outputDir = OUTPUT_DIR) {
  if (!existsSync(sourceDir)) {
    throw new Error(
      `Source migrations directory not found: ${sourceDir}. Migrations are required for packaged builds.`
    );
  }

  // Remove stale generated migration files from the output directory before
  // copying current source migrations. This prevents orphaned migration files
  // from persisting after source migrations are deleted or renamed.
  if (existsSync(outputDir)) {
    const existing = readdirSync(outputDir).filter((f) => f.endsWith('.sql'));
    for (const file of existing) {
      rmSync(join(outputDir, file), { force: true });
    }
  }

  mkdirSync(outputDir, { recursive: true });

  const files = readdirSync(sourceDir).filter((f) => f.endsWith('.sql'));

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
  const count = copyMigrations();
  console.log(`Copied ${count} migration file(s) to ${OUTPUT_DIR}`);
}
