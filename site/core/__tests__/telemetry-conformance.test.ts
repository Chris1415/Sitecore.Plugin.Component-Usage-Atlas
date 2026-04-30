// T073 / T074 / T075 — Telemetry conformance + anti-metric guard.
//
// Three test groups:
//   1. Event-shape conformance — every TelemetryEventKind has a
//      well-typed event that round-trips through track + getBuffer with
//      no PII keys leaking.
//   2. Ring-buffer behavior — overflow drops oldest (FIFO), cap is 500.
//      (Re-asserted at the conformance layer to make the contract
//      explicit; the M2 telemetry.test.ts already covers this.)
//   3. Anti-metric guard (DoD-4 / ADR-0013) — the source files under
//      `core/`, `lib/`, `components/`, `app/` MUST NOT contain any
//      forbidden vanity-metric strings as primary KPIs.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  __setEnabledForTest,
  clearBuffer,
  getBuffer,
  track,
  type TelemetryEvent,
  type TelemetryEventKind,
} from '@/core/telemetry';

// --- Group 1: event-shape conformance ----------------------------------

const ALL_KINDS: ReadonlyArray<TelemetryEventKind> = [
  'scan_started',
  'scan_completed',
  'scan_canceled',
  'scan_error',
  'page_skipped',
  'pulse_response',
  'surface_mounted',
  'phase_transition',
  'rate_limit_retry',
];

const FORBIDDEN_PII_KEYS = [
  'displayName',
  'sitePath',
  'pagePath',
  'editor',
  'editorName',
  'tenantName',
  'tenantId',
  'datasourcePath',
];

// Representative fixtures — IDs and counts only.
const FIXTURES: Record<TelemetryEventKind, Record<string, unknown>> = {
  scan_started: { scopeKind: 'all-collections', concurrency: 8 },
  scan_completed: { pages: 312, skipped: 4, renderings: 47, datasources: 184 },
  scan_canceled: { pages: 100, skipped: 2 },
  scan_error: { reasonKind: 'sites-fetch-failed' },
  page_skipped: { reason: 'forbidden', counter: 12 },
  pulse_response: { score: 4 },
  surface_mounted: {},
  phase_transition: { from: 'sites', to: 'pages' },
  rate_limit_retry: { attempt: 2, base_ms: 250 },
};

describe('TelemetryEvent conformance', () => {
  beforeEach(() => {
    clearBuffer();
    __setEnabledForTest(true);
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const kind of ALL_KINDS) {
    it(`accepts a ${kind} event and round-trips it without PII keys`, () => {
      const event: TelemetryEvent = {
        timestamp_ms: 1_700_000_000_000,
        kind,
        surface: 'widget',
        ...FIXTURES[kind],
      };
      track(event);
      const seen = getBuffer()[0];
      expect(seen?.kind).toBe(kind);
      expect(seen?.surface).toBe('widget');
      const serialized = JSON.stringify(seen);
      for (const forbidden of FORBIDDEN_PII_KEYS) {
        expect(serialized).not.toContain(forbidden);
      }
    });
  }
});

// --- Group 2: ring-buffer overflow ------------------------------------

describe('Telemetry ring buffer', () => {
  beforeEach(() => {
    clearBuffer();
    __setEnabledForTest(true);
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('drops oldest entries when exceeding cap of 500 (FIFO)', () => {
    for (let i = 0; i < 700; i += 1) {
      track({
        timestamp_ms: i,
        kind: 'phase_transition',
        surface: 'widget',
        index: i,
      });
    }
    const buf = getBuffer();
    expect(buf.length).toBe(500);
    // Oldest 200 dropped — first surviving event has index 200.
    expect((buf[0] as TelemetryEvent & { index: number }).index).toBe(200);
    // Last surviving event has index 699.
    expect((buf[buf.length - 1] as TelemetryEvent & { index: number }).index).toBe(699);
  });
});

// --- Group 3: anti-metric guard (DoD-4) -------------------------------

const FORBIDDEN_KPI_PATTERNS: ReadonlyArray<RegExp> = [
  /scans?_per_minute/i,
  /scans?\s*\/\s*minute/i,
  /api_calls_served/i,
  /api\s+calls\s+served/i,
  /session_count/i,
  /session\s+count/i,
];

const SITE_ROOT = resolve(__dirname, '..', '..');
const SCAN_DIRS = ['core', 'lib', 'components', 'app'] as const;
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs']);

function* walkSourceFiles(dir: string): Generator<string> {
  let entries: ReadonlyArray<string>;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === '__tests__' || entry.startsWith('.')) continue;
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      yield* walkSourceFiles(full);
    } else if (stat.isFile()) {
      const lastDot = entry.lastIndexOf('.');
      const ext = lastDot >= 0 ? entry.slice(lastDot) : '';
      if (SCAN_EXTENSIONS.has(ext) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
        yield full;
      }
    }
  }
}

describe('Anti-metric guard (DoD-4)', () => {
  it('production source under core/ + lib/ + components/ + app/ contains no forbidden vanity metrics', () => {
    const offenders: Array<{ readonly path: string; readonly line: number; readonly text: string; readonly pattern: RegExp }> = [];
    for (const dir of SCAN_DIRS) {
      for (const path of walkSourceFiles(join(SITE_ROOT, dir))) {
        let content: string;
        try {
          content = readFileSync(path, 'utf8');
        } catch {
          continue;
        }
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i] ?? '';
          // Skip lines that mention a forbidden token only inside a
          // disclaimer comment — the guard test ITSELF does this. We
          // detect by looking for ADR-0013 / DoD-4 / "anti-metric" /
          // "forbidden" markers on the same line.
          const isDisclaimer =
            /anti[-_ ]?metric|ADR-?0013|DoD-?4|forbidden|disallowed|MUST NOT/i.test(
              line,
            );
          if (isDisclaimer) continue;
          for (const pat of FORBIDDEN_KPI_PATTERNS) {
            if (pat.test(line)) {
              offenders.push({ path, line: i + 1, text: line.trim(), pattern: pat });
            }
          }
        }
      }
    }
    if (offenders.length > 0) {
      const detail = offenders
        .map(
          (o) => `${o.path}:${o.line} matched ${o.pattern.source} → ${o.text}`,
        )
        .join('\n');
      throw new Error(
        `Anti-metric guard FAILED — production source must not contain vanity KPIs:\n${detail}`,
      );
    }
    expect(offenders.length).toBe(0);
  });

  it('telemetry.ts does not declare any TelemetryEventKind that names a vanity metric', () => {
    const path = join(SITE_ROOT, 'core', 'telemetry.ts');
    const source = readFileSync(path, 'utf8');
    for (const pat of FORBIDDEN_KPI_PATTERNS) {
      expect(pat.test(source)).toBe(false);
    }
  });
});
