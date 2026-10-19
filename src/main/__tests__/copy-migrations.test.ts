import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { copyMigrations } from '../../../scripts/copy-migrations';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('copy-migrations', () => {
  let tempDir: string;
  let sourceDir: string;
  let outputDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lca-copy-test-'));
    sourceDir = join(tempDir, 'source');
    outputDir = join(tempDir, 'output');
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('copies migration files from source to output', () => {
    writeFileSync(
      join(sourceDir, '001_init.sql'),
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY);'
    );
    writeFileSync(
      join(sourceDir, '002_add_extra.sql'),
      'CREATE TABLE extra (id INTEGER PRIMARY KEY);'
    );

    const count = copyMigrations(sourceDir, outputDir);

    expect(count).toBe(2);
    expect(readFileSync(join(outputDir, '001_init.sql'), 'utf8')).toBe(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY);'
    );
    expect(readFileSync(join(outputDir, '002_add_extra.sql'), 'utf8')).toBe(
      'CREATE TABLE extra (id INTEGER PRIMARY KEY);'
    );
  });

  it('removes stale generated files from output before copying', () => {
    // Create a stale file in the output directory that no longer exists in source
    writeFileSync(
      join(outputDir, '999_stale.sql'),
      'DROP TABLE everything;'
    );
    writeFileSync(
      join(sourceDir, '001_init.sql'),
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY);'
    );

    const count = copyMigrations(sourceDir, outputDir);

    expect(count).toBe(1);
    // Stale file must be gone
    expect(existsSync(join(outputDir, '999_stale.sql'))).toBe(false);
    // Current file must be present
    expect(existsSync(join(outputDir, '001_init.sql'))).toBe(true);
  });

  it('does not touch source migration files', () => {
    const sourceContent = 'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY);';
    writeFileSync(join(sourceDir, '001_init.sql'), sourceContent);

    copyMigrations(sourceDir, outputDir);

    expect(readFileSync(join(sourceDir, '001_init.sql'), 'utf8')).toBe(
      sourceContent
    );
  });

  it('throws a clear error when the source migrations directory is missing', () => {
    const missingDir = join(tempDir, 'does-not-exist');
    expect(() => copyMigrations(missingDir, outputDir)).toThrow(
      /Source migrations directory not found/
    );
  });
});
