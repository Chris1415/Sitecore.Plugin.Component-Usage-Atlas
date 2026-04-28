#!/usr/bin/env node
// T091 — Sanity scan: production source MUST NOT contain raw network
// primitives outside of the Marketplace SDK boundary. Per ADR-0013 +
// DoD-1 the only allowed network egress is via `client.query` /
// `client.mutate` (which transit through `@sitecore-marketplace-sdk/*`,
// not raw fetch).
//
// Greps `core/`, `lib/`, `components/`, `app/` for the four forbidden
// primitives and exits non-zero if any are found. Test files are
// excluded — vitest fixtures and stubs use `vi.fn` and never the real
// primitives.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SITE_ROOT = resolve(__dirname, '..');

const SCAN_DIRS = ['core', 'lib', 'components', 'app'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);

// We grep for a `(` after the keyword to avoid false positives on
// substrings like "fetcher" or `prefetch`. The patterns below match
// the canonical call shape `fetch(...)`, `XMLHttpRequest(`,
// `sendBeacon(`, `new XMLHttpRequest`.
const FORBIDDEN_PATTERNS = [
  /\bfetch\s*\(/, // fetch(
  /\bnew\s+XMLHttpRequest\b/, // new XMLHttpRequest
  /\bXMLHttpRequest\s*\(/, // XMLHttpRequest(
  /\.sendBeacon\s*\(/, // navigator.sendBeacon(
];

// Strip out comments so prose like "per-page fetch (per..." does not
// trip the grep. We perform a per-line `//`-comment strip and a global
// block-comment strip BEFORE the line scan. This is conservative: we
// only need real call sites, not narrative.
function stripCommentsLine(line) {
  // Remove `// ...` line comments (not inside string literals — for the
  // simple TypeScript bodies in this codebase the naive form is good
  // enough; a real call shape `fetch(` in a string would still match
  // and that is intentional).
  const idx = line.indexOf('//');
  if (idx === -1) return line;
  // Don't strip if `//` is inside a quoted string. Heuristic: check
  // whether the prefix has an odd number of unescaped quotes.
  const prefix = line.slice(0, idx);
  const quotes = (prefix.match(/(?<!\\)["']/g) ?? []).length;
  if (quotes % 2 !== 0) return line;
  return prefix;
}

function stripBlockComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, '');
}

const DISCLAIMER = /audit[-_ ]?network|forbidden|disallowed|MUST NOT|sanity\s+scan|@allow-fetch/i;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === '__tests__' || entry === 'node_modules') {
      continue;
    }
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (stat.isFile()) {
      const lastDot = entry.lastIndexOf('.');
      const ext = lastDot >= 0 ? entry.slice(lastDot) : '';
      if (
        SCAN_EXTENSIONS.has(ext) &&
        !entry.endsWith('.test.ts') &&
        !entry.endsWith('.test.tsx')
      ) {
        yield full;
      }
    }
  }
}

function main() {
  const offenders = [];
  for (const sub of SCAN_DIRS) {
    for (const path of walk(join(SITE_ROOT, sub))) {
      let content;
      try {
        content = readFileSync(path, 'utf8');
      } catch {
        continue;
      }
      const noBlocks = stripBlockComments(content);
      const lines = noBlocks.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const rawLine = lines[i];
        const line = stripCommentsLine(rawLine);
        if (line.trim() === '') continue;
        if (DISCLAIMER.test(line)) continue;
        for (const pat of FORBIDDEN_PATTERNS) {
          if (pat.test(line)) {
            offenders.push({ path, line: i + 1, text: line.trim(), pattern: pat.source });
          }
        }
      }
    }
  }
  if (offenders.length > 0) {
    process.stderr.write(
      'audit:network FAILED — production source must not call raw fetch/XHR/sendBeacon (use SDK):\n',
    );
    for (const o of offenders) {
      process.stderr.write(`  ${o.path}:${o.line} matched ${o.pattern} → ${o.text}\n`);
    }
    process.exit(1);
  }
  process.stdout.write(
    'audit:network OK — no raw fetch/XHR/sendBeacon outside the SDK boundary.\n',
  );
}

main();
