/**
 * T031 — Export telemetry helpers.
 *
 * Thin wrappers around `track()` that emit the three export-related event
 * kinds added in T007 (`export_attempt` / `export_success` / `export_fail`).
 *
 * Per ADR-0021, every `export.*` event carries an `action: 'save' | 'open'
 * | 'copy'` field so the three-action egress shape can be reasoned about
 * downstream (telemetry distribution at /test, antimetric guard at /ship).
 *
 * No new transport — all events go through the existing in-iframe ring
 * buffer + `console.info("[CUA]", event)` mirror per ADR-0013. NO fetch,
 * NO postMessage, NO sendBeacon.
 *
 * The helpers are deliberately thin (no defaulting, no per-call validation).
 * Tests assert behavior at the integration layer (T040 / T041) — adding
 * dedicated unit tests here would be tautological per § 9.6.
 */

import type { ExportFailErrorCode } from '@/core/telemetry';
import { track } from '@/core/telemetry';

export type ExportSurface = 'widget' | 'panel';
export type ExportFormat = 'json' | 'csv' | 'html';
export type ExportAction = 'save' | 'open' | 'copy';
export type ExportScopeKind = 'all-collections' | 'collection';

export interface EmitExportAttemptParams {
  surface: ExportSurface;
  format: ExportFormat;
  action: ExportAction;
  atlasSize?: number;
  scopeKind?: ExportScopeKind;
}

export function emitExportAttempt(params: EmitExportAttemptParams): void {
  track({
    kind: 'export_attempt',
    timestamp_ms: Date.now(),
    surface: params.surface,
    format: params.format,
    action: params.action,
    atlasSize: params.atlasSize,
    scopeKind: params.scopeKind,
  });
}

export interface EmitExportSuccessParams {
  surface: ExportSurface;
  format: ExportFormat;
  action: ExportAction;
  durationMs?: number;
}

export function emitExportSuccess(params: EmitExportSuccessParams): void {
  track({
    kind: 'export_success',
    timestamp_ms: Date.now(),
    surface: params.surface,
    format: params.format,
    action: params.action,
    durationMs: params.durationMs,
  });
}

export interface EmitExportFailParams {
  surface: ExportSurface;
  format: ExportFormat;
  action: ExportAction;
  errorCode: ExportFailErrorCode;
  durationMs?: number;
}

export function emitExportFail(params: EmitExportFailParams): void {
  track({
    kind: 'export_fail',
    timestamp_ms: Date.now(),
    surface: params.surface,
    format: params.format,
    action: params.action,
    errorCode: params.errorCode,
    durationMs: params.durationMs,
  });
}
