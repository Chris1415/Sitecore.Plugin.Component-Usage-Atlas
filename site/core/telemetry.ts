// T072 — In-iframe telemetry per ADR-0013.
//
// Keeps a module-scoped ring buffer (max 500) of structured events and
// mirrors each event to `console.info("[CUA]", event)`. NO external
// network. NO postMessage. NO fetch / XHR / sendBeacon. The debug panel
// (T074) reads `getBuffer()` to surface the recent events to a developer
// when the iframe URL carries `?debug=1`.
//
// Events are kept tiny — IDs and counts only. Display names, page paths,
// editor names, tenant identifiers MUST NOT appear. The rule is enforced
// at the call-site (engine + surfaces) — this module just stores what
// it's given.

const MAX_BUFFER_SIZE = 500;

export type TelemetryEventKind =
  | 'scan_started'
  | 'scan_completed'
  | 'scan_canceled'
  | 'scan_error'
  | 'page_skipped'
  | 'pulse_response'
  | 'surface_mounted'
  | 'phase_transition'
  | 'rate_limit_retry';

export type TelemetryEvent = {
  readonly timestamp_ms: number;
  readonly kind: TelemetryEventKind;
  readonly surface: 'widget' | 'panel';
  readonly [key: string]: unknown;
};

let buffer: TelemetryEvent[] = [];
let enabled = true;

export function track(event: TelemetryEvent): void {
  if (!enabled) return;
  buffer.push(event);
  if (buffer.length > MAX_BUFFER_SIZE) {
    // FIFO: drop the oldest entries to keep the cap.
    buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
  }
  // Structured marker so devtools filtering picks it up. No raw fetch /
  // postMessage / external network — this is the ONLY surface.
  console.info('[CUA]', event);
}

export function getBuffer(): ReadonlyArray<TelemetryEvent> {
  return buffer.slice();
}

export function clearBuffer(): void {
  buffer = [];
}

/**
 * Test-only: toggle the telemetry layer. In production the layer is
 * always on. Tests use this to assert "track is a no-op when disabled".
 */
export function __setEnabledForTest(value: boolean): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__setEnabledForTest may only be called in tests');
  }
  enabled = value;
}
