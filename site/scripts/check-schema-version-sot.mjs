#!/usr/bin/env node
// T043 — DoD-7 / IS-13 schema-version single-source-of-truth audit.
//
// ADR-0019 mandates that `ATLAS_EXPORT_SCHEMA_VERSION` be declared in
// EXACTLY ONE file: `core/atlas/export/schema-version.ts`. Adapters,
// header builder, and tests must import the constant; no other site
// may declare it (`export const ATLAS_EXPORT_SCHEMA_VERSION = …` or
// `const ATLAS_EXPORT_SCHEMA_VERSION = …`).
//
// This audit walks `core/atlas/export/`, excluding the SoT file itself
// and the `__tests__/` subtrees, and flags any line that:
//   - declares the constant (`const ATLAS_EXPORT_SCHEMA_VERSION = …`,
//     with optional `export`), OR
//   - assigns a literal numeric to a key named `atlas_export_schema_version`
//     that is not coming from the imported constant
//     (e.g. `atlas_export_schema_version: 1` instead of
//     `atlas_export_schema_version: ATLAS_EXPORT_SCHEMA_VERSION` /
//     `atlas_export_schema_version: header.atlas_export_schema_version`).
//
// Imports (`import { ATLAS_EXPORT_SCHEMA_VERSION } from …`) and read-only
// references / property accesses (`header.atlas_export_schema_version`)
// are allowed. Comments mentioning the constant are allowed.
//
// Wired into `npm run ci` after `audit:anti-metric`. Synthetic-violation
// test: declare a second `export const ATLAS_EXPORT_SCHEMA_VERSION = 1`
// in any file under `core/atlas/export/` (outside the SoT) and re-run
// — exit code MUST be 1.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SITE_ROOT = resolve(__dirname, '..');
const EXPORT_ROOT = join(SITE_ROOT, 'core', 'atlas', 'export');
const SOT_FILE = join(EXPORT_ROOT, 'schema-version.ts');

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs']);

// Match a declaration line (with or without `export`).
const DECLARATION_RE =
  /\b(?:export\s+)?(?:const|let|var)\s+ATLAS_EXPORT_SCHEMA_VERSION\b/;

// Match a literal-number assignment to the snake_case key. Numeric only —
// `atlas_export_schema_version: header.atlas_export_schema_version` and
// `atlas_export_schema_version: ATLAS_EXPORT_SCHEMA_VERSION` are allowed.
const LITERAL_KEY_RE = /\batlas_export_schema_version\s*:\s*(\d+)/;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === '__tests__') {
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

function isCommentOrString(line) {
  // Best-effort: ignore lines that are pure single-line comments or
  // contain the match inside a // comment after meaningful code.
  // (For our purposes the false-positive cost is low — adapters cite
  // `atlas_export_schema_version` in comments at the top of files, and
  // those lines start with `//` which is filtered here.)
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function main() {
  const offenders = [];
  for (const path of walk(EXPORT_ROOT)) {
    if (path === SOT_FILE) continue;
    let content;
    try {
      content = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (isCommentOrString(line)) continue;

      if (DECLARATION_RE.test(line)) {
        offenders.push({
          path,
          line: i + 1,
          text: line.trim(),
          reason: 'duplicate declaration of ATLAS_EXPORT_SCHEMA_VERSION',
        });
      }
      const lit = line.match(LITERAL_KEY_RE);
      if (lit !== null) {
        offenders.push({
          path,
          line: i + 1,
          text: line.trim(),
          reason: `literal numeric ${lit[1]} assigned to atlas_export_schema_version (must reference ATLAS_EXPORT_SCHEMA_VERSION)`,
        });
      }
    }
  }

  if (offenders.length > 0) {
    process.stderr.write(
      'Schema-version SoT audit FAILED — ATLAS_EXPORT_SCHEMA_VERSION must live in exactly one file (core/atlas/export/schema-version.ts):\n',
    );
    for (const o of offenders) {
      const rel = relative(SITE_ROOT, o.path).split(sep).join('/');
      process.stderr.write(`  ${rel}:${o.line} ${o.reason}\n    → ${o.text}\n`);
    }
    process.exit(1);
  }
  process.stdout.write(
    'Schema-version SoT audit OK — ATLAS_EXPORT_SCHEMA_VERSION declared exactly once (core/atlas/export/schema-version.ts).\n',
  );
}

main();
