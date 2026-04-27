# ADR-0013: Telemetry stays in-iframe — `console.info` markers + in-memory ring buffer; zero external egress

## Status

Accepted

## Context

PRD § 8 NFR-6 requires observability for scan timing, page count, skipped count, and errors. The Round-1 critical review tightened metric instrumentation: S1/S6 pulses, S2/S3 timings, S4 cancel-vs-action distinction, anti-metric guard at ship.

ADR-0002 forbids backend services. ADR-0003 forbids persistence (no localStorage / IndexedDB). NFR-5.2 forbids non-SDK network calls. PRD anti-metric list rules out activity volumes (scans/minute, API calls served, session count).

The constraint surface is unusual: we want telemetry, but we cannot persist it, cannot ship it to a backend, and cannot phone home. We can:

- Emit structured `console.info` markers — the dogfood team observes them via browser devtools during testing.
- Keep an in-memory ring buffer of recent events (state transitions, scan timings, skipped pages, errors) — exposed to the editor via a debug panel for friction-log self-report.
- Surface the buffer at point-in-time when the editor opts in (e.g., "Copy debug log to clipboard" affordance).
- Wait on platform-level Marketplace install analytics for retention metrics (S5) — explicitly OQ-12 in the PRD.

This is enough for the dogfood phase. Real production telemetry would require Phase-3 persistence and likely a backend.

## Decision

**Telemetry stays in-iframe.** Specifically:

- A `core/telemetry.ts` module exposes:
  - `track(event: TelemetryEvent)` — records an event into an in-memory ring buffer (max 500 entries; oldest evicted) AND emits a structured `console.info("[CUA]", event)` marker.
  - `getBuffer(): TelemetryEvent[]` — returns the current buffer for debug-panel rendering.
  - `clearBuffer()` — empties the buffer (no-op outside debug contexts).
- `TelemetryEvent` shape includes: `timestamp_ms`, `kind` (`scan_started`, `scan_completed`, `scan_canceled`, `scan_error`, `page_skipped`, `pulse_response`, `surface_mounted`, …), `surface` (`widget` / `panel`), and event-specific fields.
- **No PII.** Events include page IDs, rendering IDs, and counts. They do **not** include page paths beyond the route prefix, datasource paths, editor names, or tenant identifiers.
- **No external network calls.** Build-time check (per NFR-5.2) verifies no `fetch`/`XMLHttpRequest`/`navigator.sendBeacon` calls exist outside `@sitecore-marketplace-sdk/*`.
- **Debug panel:** a small `<DebugPanel />` component, gated behind a tab-scoped flag (e.g., `?debug=1` query string on the iframe URL during dogfood; off in production unless re-enabled). Renders the ring buffer + a "Copy to clipboard" button so the editor can paste a friction-log entry into the team's friction-log doc.
- **Anti-metric guard at ship (DoD-4):** at every release sign-off, the Team Lead grep-checks the codebase for any of the forbidden anti-metric strings (`scans_per_minute`, `api_calls_served`, `session_count` as a primary KPI). If found, the ADR is in violation; the release does not ship until the strings are removed or recontextualized.

## Consequences

**Easier:**
- Honors NFR-5.2, ADR-0002, ADR-0003 simultaneously without compromise.
- The dogfood team has structured logs in devtools and a debug-panel buffer for editor self-report — sufficient for v1 friction tracking.
- No backend, no PII risk, no third-party analytics dep.
- The buffer's bounded size (500 entries) keeps memory predictable.

**Harder:**
- Cannot measure S5 (retention) without platform analytics — captured in OQ-12 as still-open. v1 ships with S5 marked aspirational.
- Cannot aggregate telemetry across editors without a backend. The dogfood team relies on individual friction-log self-reports.
- Anti-metric guard is manual at ship — requires Team Lead discipline. Mitigation: a tiny grep step in the `/ship` checklist.

**Forbidden in this ADR:**
- Adding a backend for telemetry forwarding.
- Persisting telemetry to localStorage / sessionStorage / IndexedDB (violates ADR-0003).
- Using third-party analytics scripts (Google Analytics, Mixpanel, Segment, etc.).
- Including PII (page paths, datasource paths, editor identifiers, tenant identifiers) in any telemetry event.
- Reporting "scans per minute," "API calls served," or "session count" as a primary KPI on any dashboard.

**Phase-3 escape hatch:** when persistence is introduced (per ADR-0003's escape hatch), telemetry can move to a persistent buffer + opt-in egress. That would supersede this ADR with one that documents the egress destination, retention policy, and PII review.

## Date

2026-04-27
