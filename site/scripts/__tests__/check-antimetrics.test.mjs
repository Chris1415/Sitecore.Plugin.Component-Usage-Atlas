// T075 — Script-level test for `scripts/check-antimetrics.mjs`. Uses a
// tmpdir fixture to assert the script exits non-zero when forbidden
// strings are present, and zero when they are not.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SITE_ROOT = resolve(__dirname, '..', '..');
const SCRIPT = join(SITE_ROOT, 'scripts', 'check-antimetrics.mjs');

let workdir;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'cua-antimetric-'));
});

afterEach(() => {
  if (workdir && existsSync(workdir)) {
    rmSync(workdir, { recursive: true, force: true });
  }
});

function setupFixture(rel, contents) {
  const file = join(workdir, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
  // Mirror the script alongside so its relative SITE_ROOT resolution works.
  const scriptDir = join(workdir, 'scripts');
  mkdirSync(scriptDir, { recursive: true });
  copyFileSync(SCRIPT, join(scriptDir, 'check-antimetrics.mjs'));
}

function runIn(workdir) {
  return execFileSync(
    process.execPath,
    [join(workdir, 'scripts', 'check-antimetrics.mjs')],
    { stdio: 'pipe', encoding: 'utf8' },
  );
}

describe('check-antimetrics.mjs', () => {
  it('exits 0 on a clean fixture', () => {
    setupFixture('core/clean.ts', 'export const foo = 1;\n');
    const out = runIn(workdir);
    expect(out).toContain('Anti-metric guard OK');
  });

  it('exits non-zero when a forbidden string is present', () => {
    setupFixture('core/dirty.ts', 'export const KPI = "scans_per_minute";\n');
    let stderr = '';
    let exited = 0;
    try {
      execFileSync(
        process.execPath,
        [join(workdir, 'scripts', 'check-antimetrics.mjs')],
        { stdio: 'pipe', encoding: 'utf8' },
      );
    } catch (err) {
      exited = err.status ?? -1;
      stderr = err.stderr?.toString() ?? '';
    }
    expect(exited).not.toBe(0);
    expect(stderr).toContain('scans?_per_minute');
    // On Windows the path separator is `\`, on POSIX it's `/`. Match
    // either by checking the basename.
    expect(stderr).toContain('dirty.ts');
  });

  it('exits non-zero on api_calls_served', () => {
    setupFixture('lib/dirty.ts', 'const API_CALLS_SERVED_TOTAL = 42;\n');
    let exited = 0;
    let stderr = '';
    try {
      execFileSync(
        process.execPath,
        [join(workdir, 'scripts', 'check-antimetrics.mjs')],
        { stdio: 'pipe', encoding: 'utf8' },
      );
    } catch (err) {
      exited = err.status ?? -1;
      stderr = err.stderr?.toString() ?? '';
    }
    expect(exited).not.toBe(0);
    expect(stderr).toContain('api_calls_served');
  });

  it('exits non-zero on session_count', () => {
    setupFixture('components/dirty.ts', 'const x = "session_count";\n');
    let exited = 0;
    try {
      execFileSync(
        process.execPath,
        [join(workdir, 'scripts', 'check-antimetrics.mjs')],
        { stdio: 'pipe', encoding: 'utf8' },
      );
    } catch (err) {
      exited = err.status ?? -1;
    }
    expect(exited).not.toBe(0);
  });

  it('does NOT scan __tests__ directories', () => {
    setupFixture('core/__tests__/dirty.ts', 'const x = "scans_per_minute";\n');
    const out = runIn(workdir);
    expect(out).toContain('Anti-metric guard OK');
  });

  it('does NOT scan *.test.ts files', () => {
    setupFixture('core/something.test.ts', 'const x = "session_count";\n');
    const out = runIn(workdir);
    expect(out).toContain('Anti-metric guard OK');
  });

  it('allows a forbidden token on a disclaimer line (anti-metric mention)', () => {
    setupFixture(
      'core/clean.ts',
      `// anti-metric guard: do not introduce session_count as a KPI.\nexport const ok = 1;\n`,
    );
    const out = runIn(workdir);
    expect(out).toContain('Anti-metric guard OK');
  });
});
