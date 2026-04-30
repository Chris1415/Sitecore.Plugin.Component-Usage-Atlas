// T072 — inline RED+GREEN unit tests for `core/telemetry.ts`. Per § 5
// entry 25 these ship with the implementation in the same task.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setEnabledForTest,
  clearBuffer,
  getBuffer,
  track,
  type TelemetryEvent,
} from '@/core/telemetry';

const ev = (kind: TelemetryEvent['kind'], extra: Record<string, unknown> = {}): TelemetryEvent => ({
  timestamp_ms: 0,
  kind,
  surface: 'widget',
  ...extra,
});

describe('telemetry', () => {
  beforeEach(() => {
    clearBuffer();
    __setEnabledForTest(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('track(event) appends to the buffer; getBuffer returns appended events', () => {
    track(ev('scan_started'));
    track(ev('scan_completed'));
    const out = getBuffer();
    expect(out.length).toBe(2);
    expect(out[0]?.kind).toBe('scan_started');
    expect(out[1]?.kind).toBe('scan_completed');
  });

  it('ring buffer cap 500 — emit 600 events, buffer length stays 500, oldest dropped', () => {
    for (let i = 0; i < 600; i += 1) {
      track(ev('phase_transition', { i }));
    }
    const out = getBuffer();
    expect(out.length).toBe(500);
    // Oldest 100 dropped — first surviving event was the 100th one.
    expect((out[0] as TelemetryEvent & { i: number }).i).toBe(100);
  });

  it('clearBuffer empties the buffer', () => {
    track(ev('scan_started'));
    expect(getBuffer().length).toBe(1);
    clearBuffer();
    expect(getBuffer().length).toBe(0);
  });

  it('track also calls console.info("[CUA]", event)', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const event = ev('scan_started');
    track(event);
    expect(spy).toHaveBeenCalledWith('[CUA]', event);
  });

  it('disabled telemetry is a no-op (track does not append)', () => {
    __setEnabledForTest(false);
    track(ev('scan_started'));
    expect(getBuffer().length).toBe(0);
    __setEnabledForTest(true);
  });

  it('events stay tiny: a representative scan_started fixture has no PII keys', () => {
    // Regression — ADR-0013. The contract at the call-site is "IDs and
    // counts only". This test enumerates a representative event and
    // confirms no obviously-PII keys leak through the type contract.
    const event = ev('scan_started', { scopeKind: 'all-collections', concurrency: 8 });
    track(event);
    const serialized = JSON.stringify(getBuffer()[0]);
    expect(serialized).not.toContain('displayName');
    expect(serialized).not.toContain('sitePath');
    expect(serialized).not.toContain('editor');
    expect(serialized).not.toContain('tenantName');
  });
});
