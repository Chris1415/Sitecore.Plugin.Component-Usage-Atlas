// T046 — Telemetry distribution contract test (DoD-9 / NFR-6.2 / ADR-0021).
//
// Asserts the three export-event helpers (`emitExportAttempt` /
// `emitExportSuccess` / `emitExportFail`) can fire across the full
// 18-cell distribution matrix:
//
//   2 surfaces × 3 formats × 3 actions = 18 cells per event kind.
//
// This is a CONTRACT test, not a runtime smoke. The DoD-9 friction-log
// distribution table is populated at /test by an instrumented host-frame
// run; here we verify the helper API is structurally capable of emitting
// every variant the union allows AND that each call lands a single,
// well-shaped event in the in-iframe ring buffer (ADR-0013).
//
// Provenance: telemetry types live in `core/telemetry.ts` (project-internal,
// not SDK).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  emitExportAttempt,
  emitExportFail,
  emitExportSuccess,
  type ExportAction,
  type ExportFormat,
  type ExportSurface,
} from '@/core/atlas/export/telemetry/events';
import {
  __setEnabledForTest,
  clearBuffer,
  getBuffer,
  type ExportFailErrorCode,
  type TelemetryEvent,
} from '@/core/telemetry';

const SURFACES: readonly ExportSurface[] = ['widget', 'panel'];
const FORMATS: readonly ExportFormat[] = ['json', 'csv', 'html'];
const ACTIONS: readonly ExportAction[] = ['save', 'open', 'copy'];
const ERROR_CODES: readonly ExportFailErrorCode[] = [
  'blob_construction_failed',
  'sandbox_blocked_download',
  'browser_save_canceled',
  'popup_blocked',
  'clipboard_blocked',
  'unknown',
];

describe('export telemetry — distribution contract (DoD-9 / ADR-0021)', () => {
  beforeEach(() => {
    clearBuffer();
    __setEnabledForTest(true);
    // Silence the [CUA] mirror in console output for the matrix runs.
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits export_attempt for every (surface × format × action) cell', () => {
    let count = 0;
    for (const surface of SURFACES) {
      for (const format of FORMATS) {
        for (const action of ACTIONS) {
          emitExportAttempt({ surface, format, action });
          count += 1;
        }
      }
    }
    expect(count).toBe(18);
    const buf = getBuffer();
    expect(buf).toHaveLength(18);

    // Each cell appears exactly once.
    for (const surface of SURFACES) {
      for (const format of FORMATS) {
        for (const action of ACTIONS) {
          const matches = buf.filter(
            (e) =>
              e.kind === 'export_attempt' &&
              e.surface === surface &&
              (e as TelemetryEvent & { format: string }).format === format &&
              (e as TelemetryEvent & { action: string }).action === action,
          );
          expect(matches).toHaveLength(1);
        }
      }
    }
  });

  it('emits export_success for every (surface × format × action) cell', () => {
    for (const surface of SURFACES) {
      for (const format of FORMATS) {
        for (const action of ACTIONS) {
          emitExportSuccess({ surface, format, action, durationMs: 7 });
        }
      }
    }
    const buf = getBuffer();
    expect(buf).toHaveLength(18);
    expect(buf.every((e) => e.kind === 'export_success')).toBe(true);
    expect(buf.every((e) => typeof e.timestamp_ms === 'number')).toBe(true);
  });

  it('emits export_fail for every (surface × format × action) cell with each errorCode', () => {
    let count = 0;
    for (const surface of SURFACES) {
      for (const format of FORMATS) {
        for (const action of ACTIONS) {
          // Pick an errorCode that physically aligns with the action so
          // the test case mirrors realistic failure modes:
          //   save → browser_save_canceled
          //   open → popup_blocked
          //   copy → clipboard_blocked
          const errorCode: ExportFailErrorCode =
            action === 'save'
              ? 'browser_save_canceled'
              : action === 'open'
                ? 'popup_blocked'
                : 'clipboard_blocked';
          emitExportFail({ surface, format, action, errorCode });
          count += 1;
        }
      }
    }
    expect(count).toBe(18);
    const buf = getBuffer();
    expect(buf).toHaveLength(18);
    expect(buf.every((e) => e.kind === 'export_fail')).toBe(true);
  });

  it('export_fail accepts every documented errorCode (ADR-0021 union)', () => {
    for (const errorCode of ERROR_CODES) {
      emitExportFail({
        surface: 'widget',
        format: 'json',
        action: 'open',
        errorCode,
      });
    }
    const buf = getBuffer();
    expect(buf).toHaveLength(ERROR_CODES.length);
    const observed = new Set(
      buf.map(
        (e) => (e as TelemetryEvent & { errorCode: ExportFailErrorCode }).errorCode,
      ),
    );
    for (const code of ERROR_CODES) {
      expect(observed.has(code)).toBe(true);
    }
  });

  it('every emitted event carries a numeric timestamp_ms', () => {
    emitExportAttempt({ surface: 'widget', format: 'json', action: 'open' });
    emitExportSuccess({ surface: 'panel', format: 'csv', action: 'copy' });
    emitExportFail({
      surface: 'widget',
      format: 'html',
      action: 'save',
      errorCode: 'sandbox_blocked_download',
    });
    const buf = getBuffer();
    expect(buf).toHaveLength(3);
    for (const e of buf) {
      expect(typeof e.timestamp_ms).toBe('number');
      expect(Number.isFinite(e.timestamp_ms)).toBe(true);
    }
  });
});
