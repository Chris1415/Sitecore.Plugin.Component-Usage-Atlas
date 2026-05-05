// T008 — RED unit tests for the new export-related telemetry event
// kinds (lifts to GREEN at T007). Per § 10 T008 + ADR-0021: every
// `export.*` event carries an `action: 'save' | 'open' | 'copy'` field.
// The error-code union now includes
//   'blob_construction_failed' | 'sandbox_blocked_download'
// | 'browser_save_canceled' | 'popup_blocked' | 'clipboard_blocked'
// | 'unknown'
// per ADR-0021 § Telemetry shift. No new transport — the existing
// ring-buffer + `console.info("[CUA]", event)` mirror is the only sink
// (ADR-0013).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setEnabledForTest,
  clearBuffer,
  getBuffer,
  track,
  type TelemetryEvent,
} from '@/core/telemetry';

describe('telemetry — export event kinds (PRD-001 / ADR-0021)', () => {
  beforeEach(() => {
    clearBuffer();
    __setEnabledForTest(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buffers export_attempt events with surface/format/action/atlasSize', () => {
    const event: TelemetryEvent = {
      timestamp_ms: 1,
      kind: 'export_attempt',
      surface: 'widget',
      format: 'json',
      atlasSize: 12345,
      action: 'open',
    };
    track(event);
    const buf = getBuffer();
    expect(buf).toHaveLength(1);
    expect(buf[0]?.kind).toBe('export_attempt');
    expect(buf[0]?.surface).toBe('widget');
    expect((buf[0] as TelemetryEvent & { format: string }).format).toBe('json');
    expect((buf[0] as TelemetryEvent & { action: string }).action).toBe('open');
    expect((buf[0] as TelemetryEvent & { atlasSize: number }).atlasSize).toBe(12345);
  });

  it('buffers export_fail events with errorCode + action', () => {
    const event: TelemetryEvent = {
      timestamp_ms: 2,
      kind: 'export_fail',
      surface: 'panel',
      format: 'csv',
      errorCode: 'sandbox_blocked_download',
      action: 'save',
    };
    track(event);
    const buf = getBuffer();
    expect(buf).toHaveLength(1);
    expect(buf[0]?.kind).toBe('export_fail');
    expect((buf[0] as TelemetryEvent & { errorCode: string }).errorCode).toBe(
      'sandbox_blocked_download',
    );
    expect((buf[0] as TelemetryEvent & { action: string }).action).toBe('save');
  });

  it('preserves FIFO order across attempt → success → fail', () => {
    const a: TelemetryEvent = {
      timestamp_ms: 10,
      kind: 'export_attempt',
      surface: 'widget',
      format: 'json',
      action: 'open',
    };
    const s: TelemetryEvent = {
      timestamp_ms: 20,
      kind: 'export_success',
      surface: 'widget',
      format: 'json',
      action: 'open',
      durationMs: 42,
    };
    const f: TelemetryEvent = {
      timestamp_ms: 30,
      kind: 'export_fail',
      surface: 'panel',
      format: 'html',
      action: 'copy',
      errorCode: 'clipboard_blocked',
    };
    track(a);
    track(s);
    track(f);
    const buf = getBuffer();
    expect(buf.map((e) => e.kind)).toEqual([
      'export_attempt',
      'export_success',
      'export_fail',
    ]);
  });

  it('mirrors export events to console.info("[CUA]", event)', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const event: TelemetryEvent = {
      timestamp_ms: 99,
      kind: 'export_success',
      surface: 'widget',
      format: 'html',
      action: 'copy',
      scopeKind: 'all-collections',
      durationMs: 17,
    };
    track(event);
    expect(spy).toHaveBeenCalledWith('[CUA]', event);
  });

  it('typechecks: all three new export kinds + ADR-0021 errorCode union are accepted', () => {
    // This test exists to lock the type contract — if T007 fails to
    // extend the `TelemetryEventKind` union, this file fails to compile.
    const attempt: TelemetryEvent = {
      timestamp_ms: 1,
      kind: 'export_attempt',
      surface: 'widget',
      format: 'json',
      action: 'open',
    };
    const success: TelemetryEvent = {
      timestamp_ms: 2,
      kind: 'export_success',
      surface: 'panel',
      format: 'csv',
      action: 'copy',
      scopeKind: 'collection',
    };
    const failBlob: TelemetryEvent = {
      timestamp_ms: 3,
      kind: 'export_fail',
      surface: 'widget',
      format: 'json',
      action: 'save',
      errorCode: 'blob_construction_failed',
    };
    const failSandbox: TelemetryEvent = {
      timestamp_ms: 4,
      kind: 'export_fail',
      surface: 'widget',
      format: 'json',
      action: 'save',
      errorCode: 'sandbox_blocked_download',
    };
    const failCancel: TelemetryEvent = {
      timestamp_ms: 5,
      kind: 'export_fail',
      surface: 'panel',
      format: 'csv',
      action: 'save',
      errorCode: 'browser_save_canceled',
    };
    const failPopup: TelemetryEvent = {
      timestamp_ms: 6,
      kind: 'export_fail',
      surface: 'panel',
      format: 'html',
      action: 'open',
      errorCode: 'popup_blocked',
    };
    const failClip: TelemetryEvent = {
      timestamp_ms: 7,
      kind: 'export_fail',
      surface: 'widget',
      format: 'csv',
      action: 'copy',
      errorCode: 'clipboard_blocked',
    };
    const failUnknown: TelemetryEvent = {
      timestamp_ms: 8,
      kind: 'export_fail',
      surface: 'widget',
      format: 'html',
      action: 'open',
      errorCode: 'unknown',
    };
    [attempt, success, failBlob, failSandbox, failCancel, failPopup, failClip, failUnknown].forEach(
      track,
    );
    expect(getBuffer()).toHaveLength(8);
  });
});
