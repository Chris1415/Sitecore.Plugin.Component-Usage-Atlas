// T091 — Script-level test for `scripts/audit-network.mjs`. Verifies
// the sanity scan flags raw fetch / XHR / sendBeacon and ignores
// SDK-mediated traffic and prose comments.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SITE_ROOT = resolve(__dirname, '..', '..');
const SCRIPT = join(SITE_ROOT, 'scripts', 'audit-network.mjs');

let workdir;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'cua-audit-net-'));
});

afterEach(() => {
  if (workdir && existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
});

function setupFixture(rel, contents) {
  const file = join(workdir, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
  const scriptDir = join(workdir, 'scripts');
  mkdirSync(scriptDir, { recursive: true });
  copyFileSync(SCRIPT, join(scriptDir, 'audit-network.mjs'));
}

function run() {
  return execFileSync(
    process.execPath,
    [join(workdir, 'scripts', 'audit-network.mjs')],
    { stdio: 'pipe', encoding: 'utf8' },
  );
}

describe('audit-network.mjs', () => {
  it('exits 0 on a clean fixture (only client.query calls)', () => {
    setupFixture(
      'core/clean.ts',
      'export async function f(client) { return client.query("xmc.agent.sitesGetSitesList"); }\n',
    );
    const out = run();
    expect(out).toContain('audit:network OK');
  });

  it('exits non-zero on a raw fetch(', () => {
    setupFixture('core/dirty.ts', 'export async function f() { return fetch("/x"); }\n');
    let exited = 0;
    let stderr = '';
    try {
      run();
    } catch (err) {
      exited = err.status ?? -1;
      stderr = err.stderr?.toString() ?? '';
    }
    expect(exited).not.toBe(0);
    expect(stderr).toContain('fetch');
  });

  it('exits non-zero on new XMLHttpRequest', () => {
    setupFixture('core/xhr.ts', 'const x = new XMLHttpRequest();\n');
    let exited = 0;
    try {
      run();
    } catch (err) {
      exited = err.status ?? -1;
    }
    expect(exited).not.toBe(0);
  });

  it('exits non-zero on sendBeacon', () => {
    setupFixture(
      'core/beacon.ts',
      'export const x = (n) => n.sendBeacon("/x", "y");\n',
    );
    let exited = 0;
    try {
      run();
    } catch (err) {
      exited = err.status ?? -1;
    }
    expect(exited).not.toBe(0);
  });

  it('does NOT flag prose mentioning "fetch (" inside a comment', () => {
    setupFixture(
      'core/comment-only.ts',
      `// per-page fetch (per ADR-0012) is wired through the SDK\nexport const ok = 1;\n`,
    );
    const out = run();
    expect(out).toContain('audit:network OK');
  });

  it('does NOT flag identifiers that contain "fetch" but are not call sites', () => {
    setupFixture(
      'core/fetcher.ts',
      `export const fetcherName = "page-fetcher";\nexport const Prefetch = () => null;\n`,
    );
    const out = run();
    expect(out).toContain('audit:network OK');
  });

  it('does NOT scan __tests__', () => {
    setupFixture('core/__tests__/use-fetch.ts', 'fetch("/x");\n');
    const out = run();
    expect(out).toContain('audit:network OK');
  });
});
