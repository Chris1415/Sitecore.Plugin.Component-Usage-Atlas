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
  | 'rate_limit_retry'
  // T007 — PRD-001 export-related event kinds. ADR-0021 introduced the
  // three-action egress pattern (Save canonical-but-disabled, Open + Copy
  // primary in this iframe sandbox); event payloads carry an
  // `action: 'save' | 'open' | 'copy'` field plus an extended `errorCode`
  // union for the new failure modes (popup_blocked, clipboard_blocked,
  // browser_save_canceled). See ADR-0013 for transport (in-iframe ring
  // buffer + console mirror only — no fetch / XHR / sendBeacon).
  | 'export_attempt'
  | 'export_success'
  | 'export_fail';

/**
 * ADR-0021 errorCode union for `export_fail` events. Listed here as a
 * named type so the surfaces / hooks consume one source of truth for
 * the available codes. The `TelemetryEvent` index signature
 * (`[key: string]: unknown`) does not enforce this on the event-level
 * payload — call-sites use this type when constructing the event so
 * the union is checked at the build boundary.
 */
export type ExportFailErrorCode =
  | 'blob_construction_failed'
  | 'sandbox_blocked_download'
  | 'browser_save_canceled'
  | 'popup_blocked'
  | 'clipboard_blocked'
  | 'unknown';

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
