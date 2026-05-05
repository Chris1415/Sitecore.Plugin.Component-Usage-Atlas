# ADR-0016: Atlas export construction is a pure function; `surfaceContext` is a click-time clone

## Status

Accepted

## Context

The atlas-export module emits JSON / CSV / HTML Blobs from the in-memory atlas. The construction logic interacts with three sources of state that all live in the iframe's JS heap:

1. The **atlas singleton** (per ADR-0010) — populated by the PRD-000 scan engine; holds renderings, datasources, page lists, totals, scan timestamp.
2. The **panel surface state** — the active page's `{ pageId, pageName, sitePath, language }` plus the panel's per-rendering snapshot. Stored in React state, not in the singleton.
3. The **scope filter** — per-tab user setting (PRD-000 US-3); already constrains what the atlas singleton holds.

PRD-001's critical review surfaced an internal contradiction: **AC-2.7** committed to "the export captures the page state at the moment the button was clicked," while **FR-1.2** said "construction reads the existing module-singleton atlas state." The singleton has no notion of *which page the panel was showing at click time* — it only knows the atlas. Without an explicit reconciliation, two reasonable engineers would build two different things:

- **Reading singleton:** export reflects whatever page the panel ends up showing when construction runs (wrong — violates AC-2.7).
- **Reading React panel state:** export reflects current React state, which may have already changed if the editor navigated mid-construction (also wrong — violates AC-2.7).

The third option — **the caller clones the panel context at click time and passes it as a parameter** — is the only one that makes AC-2.7 satisfiable AND keeps the construction function unit-testable without React.

This ADR codifies that third option as the architectural commitment for the export module, so the implementation cannot drift back to either of the wrong patterns.

## Decision

The atlas-export module exposes a single public construction function with the signature:

```ts
function buildExport(
  atlas: AtlasSnapshot,
  scope: ScopeDescriptor,
  surface: 'widget' | 'panel',
  format: 'json' | 'csv' | 'html',
  surfaceContext: SurfaceContext
): Blob
```

The function is **pure** in the following precise sense:

- Its only inputs are its arguments. It reads no module-level singletons, no React context, no `window` globals beyond what's needed to construct the `Blob` itself.
- Its only side effect is the `Blob` it returns (and the inevitable transient string allocations during construction).
- Given identical arguments, it produces a `Blob` whose body bytes are identical (modulo the `exported_at` timestamp which is an explicit field in `surfaceContext`).
- It is testable without the SDK, without React, and without a DOM beyond what `Blob` requires.

`surfaceContext` is a **click-time clone**, prepared by the caller (the surface integration component) at the moment the format-picker selection is made. For the panel surface, the caller deep-copies `{ pageId, pageName, sitePath, language, perRenderingSnapshot, exported_at }` from React state into a fresh object before invoking `buildExport`. For the widget surface, `surfaceContext` carries only widget-level metadata (`exported_at`, no per-page state).

The atlas singleton is read **once, at click time, by the caller**, and passed in as the `atlas` argument. The construction function does not re-read the singleton mid-construction. This means:

- A refresh-in-progress (PRD-000 IS-15) that mutates the singleton between click and Blob completion does not affect the in-flight export — the export reflects the click-time atlas snapshot.
- AC-2.7 (panel mid-navigation behavior) is satisfied because the cloned `surfaceContext` is immune to React re-renders happening in parallel.

## Consequences

### Easier

- Unit testing: format adapters and the construction function are pure functions; tests use fixture atlases and fixture `surfaceContext` objects. No React, no SDK, no DOM mocking.
- Determinism: AC-4.4 (byte-identical re-exports of an unchanged atlas) is straightforward to satisfy because purity is enforced at the function boundary.
- Concurrency: a refresh-in-progress + simultaneous export click cannot race — the click captures atlas state at its moment, the refresh continues independently, no shared mutable state during construction.
- Mid-navigation export (AC-2.7) becomes a clean contract instead of a TOCTOU bug waiting to happen.

### Harder

- Callers must be diligent about cloning at click time. A lazy implementation that passes a React state reference instead of a clone would silently violate AC-2.7. Mitigation: `SurfaceContext` is a structural type that the surface integration must construct explicitly, and tests assert that mutating React state after a click does not affect an in-flight export.
- The construction function cannot opportunistically read "fresher" atlas data if it becomes available mid-construction. This is by design (consistency over freshness), but documented so future maintainers don't try to "improve" it.

### Neutral

- The surfaceContext clone is small (a few hundred bytes for panel; less for widget) — no measurable perf cost.
- The function signature is explicit enough that LSP / IDE autocomplete makes incorrect call sites visible at write time.

## Date

2026-05-03
