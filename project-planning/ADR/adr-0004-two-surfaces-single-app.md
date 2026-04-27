# ADR-0004: Two surfaces in one Marketplace app — Dashboard Widget + Page Context Panel

## Status

Accepted

## Context

The PRD calls for editors to use the atlas in two distinct moments:

- **Component-centric** ("where is rendering X used?") — best served from a tenant-wide entry point (Dashboard Widget).
- **Page-centric** ("what does this page reference and who else uses those things?") — best served in-context on the page (Page Context Panel).

Marketplace SDK extension points relevant here (per `xmc.md` § 2c):
- `xmc:dashboardblocks` — tenant-scoped block on the dashboard.
- `xmc:pages:context-panel` — tenant-scoped side panel on the Pages canvas.

Both are bound to a single tenant per install (no Standalone-style cross-tenant umbrella). They share the same `application.context` shape and the same `sitecoreContextId`.

Two structural options:
1. **Two separate Marketplace apps**, each registering one extension point and shipping its own bundle.
2. **One Marketplace app**, registering both extension points and reusing scan logic + cache + UI primitives across both.

## Decision

**Ship one Marketplace app that registers both extension points.** The bundle exports two iframe entries — one for the dashboard widget, one for the page context panel — but shares:
- A single SDK client wrapper module (per NFR-8.1).
- A single in-memory atlas singleton (per ADR-0003).
- Shared UI primitives (loading visualization, drawer, table, counters).
- A single set of agent endpoints (per ADR-0005's identity model).

Concretely:
- Each editor install carries one Marketplace registration.
- Editors are not asked to install two separate apps to get the panel and the widget.
- The atlas built by the widget is reused by the panel (and vice versa) within the same iframe context — no double scans.

## Consequences

**Easier:**
- Single deployment artifact. One CI pipeline, one set of release notes, one version number.
- Code reuse across surfaces is the default, not an effort. Scan engine is written once.
- A scan triggered from the widget warms the panel's data and vice versa within the same iframe lifetime.
- Editors who use only one surface still get a coherent experience because the one they use is the only one that loads.

**Harder:**
- Bundle weight serves both surfaces; if the widget grows complex, the panel inherits the bundle cost (and vice versa). Mitigation: code-split per entry point so each iframe loads only what it renders.
- Both surfaces version-lockstep — a rapid iteration on the panel can't ship without re-deploying the widget.
- If at some future point we want one surface free and the other paid, we'd have to split — supersedes this ADR.
- Cross-iframe state sharing within the same Pages tab is **not** automatic (each extension point mounts its own iframe). The "shared" atlas is shared only within a single iframe's lifetime; widget and panel mounted in different iframes scan independently — acceptable, but worth noting in the architecture phase.

**Forbidden in this ADR:**
- Building the widget and panel as separate Marketplace registrations.
- Shipping divergent SDK client wrappers per surface.
- Shipping divergent visual languages (loading states, drawers, counters) per surface.

## Date

2026-04-27
