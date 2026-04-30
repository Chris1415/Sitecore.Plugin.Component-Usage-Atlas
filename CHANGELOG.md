# Changelog

All notable changes to **Component Usage Atlas** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
follows the project's PRD-based release cadence — entries are grouped by PRD number.

## [Unreleased — PRD-000]

Component Usage Atlas v0.1 — first end-to-end pass against PRD-000.

### Added
- **Dashboard Widget** (`xmc:dashboardblocks`) — search-first table of every rendering in the host site, sorted by total placements; click-row inline detail with two independently-scrolling panes (pages + datasources); `Refresh atlas`; collection-scope dropdown.
- **Page Context Panel** (`xmc:pages:context-panel`) — current-page rendering list with cross-tenant `+N other pages` counters; per-row expansion to the bound datasource with its own counter; per-rendering and per-datasource drawers; missing-datasource warnings.
- **Live in-memory atlas** scan engine (sites → pages → components fan-out, concurrency 8 with exponential backoff per ADR-0012); module-singleton state survives mount/unmount inside the same iframe (ADR-0010).
- **Branded loading visualization** — Console Operator aesthetic from POC v2; cancel-with-act preserves partial atlas (ADR-0011).
- **Lazy item-name resolution** for GUID-only / `xpath:` / `/sitecore/...` datasource refs via `xmc.authoring.graphql` with a process-wide cache; `Item · {short-id}` fallback when resolution fails.
- 14 ADRs covering scope, identity, surfaces, scaffold, state, telemetry, and routing — see `docs/decisions.md`.

### Smoke + design-polish iterations
- **Round 1 (2026-04-29 — S8/S9/S10/S11):** introduced separate `<DatasourceUsageDrawer />` (was wrongly reusing the rendering drawer); added marketer-friendly datasource display-name derivation; replaced `(home)` sentinel with the real page name; added color-tag visual affinity between rendering rows and their datasource. 219 → 241 tests.
- **Round 2 (2026-04-29 → 2026-04-30 — S22/S23):** unified rendering→datasource tree on the panel — `<DatasourceImpactGroup />` is no longer mounted on `<PanelSurface />`; each rendering row is now expandable and exposes the bound datasource inline (PRD AC-2.4 / FR-3.5 superseded). Widget-side `RenderingInlineDetail` now resolves Authoring item names same as the panel. Drawer header padding bumped `pr-10 → pr-14` with `mr-2 shrink-0` on badges. Inline-detail columns scroll independently with sticky titles. `Item · {short-id}` fallback replaces generic `Unnamed item`. 241 → 252 tests.

### Fixed
- `lib/sdk/authoring-resolve.ts` was reading `result.data.data.iN` (the query-rule unwrap) for a mutation that returns `result.data.iN` directly — every Authoring lookup silently returned `undefined`. One week of "Unnamed item" rows traced back to this. Fix handles both shapes; emits named `console.warn` telemetry (`mutate-threw` / `graphql-errors` / `zero-resolved-in-batch`) so future regressions can't be silent.
- Anti-metric grep guard test now ignores disclaimer comments so the rule itself can be discussed in code without tripping CI.

### Deferred / Pending
- T092 Vercel deploy, T093 Cloud Portal registration, T094 real-tenant smoke (`pass_with_caveats` against `solo-website` via ngrok dev origin), T113 manual test plan — see `project-planning/workflow/current-run.json` `smoke_outcomes`.

### Dogfood (back into the agent framework)
The following framework patches landed in the same iteration so the next Marketplace product gets these for free:
- `.agent/skills/sitecore/marketplace-sdk/client.md` § 8b — explicit "mutations single-unwrap" callout (`client.mutate` returns the body directly; reading `.data.data` is silent failure).
- `.agent/skills/sitecore/marketplace-sdk/xmc.md` § 7 + new § 7a — worked example of lazy Authoring item-name resolution with the failure ladder pattern.
- `.agent/agents/team/05-ui-designer.md` — long-list relationship-visibility check at design time.
- `.agent/commands/project/dev-flow/04-architect.md` — POCs must include per-click-target post-action frames; "drilldown drawer" is forbidden when more than one click target exists on the same surface.
- `.agent/skills/sitecore/marketplace-sdk/host-frame-testing.md` — sixth comparison axis for cross-row affinity / long-list visibility.
