#!/usr/bin/env node
// T075 — Anti-metric guard (DoD-4 / ADR-0013).
//
// Greps the production source tree for forbidden vanity-metric strings
// that would betray ADR-0013's "no scans/minute, no API calls served,
// no session count as primary KPIs" mandate. Exits non-zero on a hit
// with the offending path:line in stderr.
//
// Run as `npm run check:antimetrics` (pre-ship) or via `npm run ci`.
// Excludes test files (anything in `__tests__/` and any `*.test.ts*`)
// because the test suite under `core/__tests__/telemetry-conformance.test.ts`
// legitimately mentions the forbidden strings to assert their absence
// in production.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SITE_ROOT = resolve(__dirname, '..');

const SCAN_DIRS = ['core', 'lib', 'components', 'app'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs']);

const FORBIDDEN_PATTERNS = [
  /scans?_per_minute/i,
  /scans?\s*\/\s*minute/i,
  /api_calls_served/i,
  /api\s+calls\s+served/i,
  /session_count/i,
  /session\s+count/i,
];

// A line that mentions "anti-metric", "ADR-0013", "DoD-4", "forbidden",
// or "MUST NOT" is a disclaimer and is allowed to name a forbidden
// string. The conformance test under `core/__tests__/` mirrors this.
const DISCLAIMER = /anti[-_ ]?metric|ADR-?0013|DoD-?4|forbidden|disallowed|MUST NOT/i;

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
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
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
      'Anti-metric guard FAILED — production source must not name vanity KPIs:\n',
    );
    for (const o of offenders) {
      process.stderr.write(`  ${o.path}:${o.line} matched ${o.pattern} → ${o.text}\n`);
    }
    process.exit(1);
  }
  process.stdout.write('Anti-metric guard OK — no forbidden KPIs in production source.\n');
}

main();
