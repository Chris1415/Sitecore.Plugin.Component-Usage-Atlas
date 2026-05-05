# Changelog

All notable changes to **Component Usage Atlas** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
follows the project's PRD-based release cadence — entries are grouped by PRD number.

## [Unreleased — PRD-001] — 2026-05-05

**Atlas Snapshot Export.** Editors can now take a portable snapshot of the
atlas out of the iframe — for diffing across time, sharing with stakeholders
who don't have XM Cloud access, or feeding the data into spreadsheets / BI
tools / refactor scripts. Builds purely on top of PRD-000's in-memory atlas;
no new SDK calls, no new extension points, no backend.

### Added

- **Three-action egress per surface** — each of the Dashboard Widget and the
  Page Context Panel now hosts a format picker (JSON / CSV / HTML) followed
  by a three-action cluster: **Save**, **Open in new tab**, **Copy to
  clipboard**. The picker exposes a tiered size hint when the atlas is large
  (no annotation under 5 MB; muted size text 5–50 MB; warning glyph + "large,
  may take a moment" copy at 50 MB+).
- **JSON export** — full data: every rendering, its full pages array, its
  datasources array; for the panel surface, page metadata + every rendering
  with parameters + bound datasource + cross-tenant counters and per-rendering
  cross-tenant page list. Schema versioned (`atlas_export_schema_version: 1`),
  deterministic key + array order so two snapshots of an unchanged atlas
  diff cleanly.
- **CSV export** — flat lite columns suited for spreadsheet import; RFC 4180
  quoting; OWASP-style formula-injection guard (`'`-prefix on string fields
  starting with `=` / `+` / `-` / `@`); UTF-8 without BOM.
- **HTML export** — printable / shareable single-file artifact. Inlined CSS
  with a dedicated print stylesheet (11 pt body, repeating table headers,
  partial-scan badge with `print-color-adjust: exact`). Doubles as the route
  to PDF via the browser's "Save as PDF" print dialog. No remote assets, no
  JavaScript, no remote fonts.
- **Per-action UX states** — Save renders disabled in the current Marketplace
  iframe sandbox with a tooltip pointing the editor at Open or Copy ("Save
  will work once Sitecore enables it"). Open shows a sticky `'blocked'` state
  if popups are also restricted. Copy is sticky `'denied'` for the session
  on permission rejection. All three actions share success / failure
  telemetry events via the existing in-iframe ring buffer.
- **Telemetry** — three new event kinds (`export_attempt`, `export_success`,
  `export_fail`) with `surface` × `format` × `action` payload fields and a
  widened `errorCode` union (`blob_construction_failed`,
  `sandbox_blocked_download`, `browser_save_canceled`, `popup_blocked`,
  `clipboard_blocked`, `unknown`). No external transport — all events route
  through the existing ADR-0013 ring buffer.
- **Filename convention** — `atlas-<tenantSlug>-<surface>-<scope>-<ISO>.<ext>`
  (widget) or `atlas-<tenantSlug>-panel-<pageSlug>-<ISO>.<ext>` (panel).
  Tenant-name fallback `tenant-<last-7-of-tenantId>` when the SDK doesn't
  expose a tenant name (resolved via `application.context.resourceAccess[0]`
  per ADR-0020).
- **CI guards** — `npm run check:schema-version` (DoD-7 — verifies
  `ATLAS_EXPORT_SCHEMA_VERSION` is declared in exactly one file). The
  anti-metric guard (`npm run audit:anti-metric`) now also blocks
  `downloads/minute`, `total bytes exported`, and `format diversity per
  editor` so the export feature can't quietly grow vanity KPIs (DoD-6).
- **7 new ADRs** — ADR-0015 (export-as-v1-feature, supersedes PRD-000 OS-15),
  ADR-0016 (export construction is pure; surfaceContext is a click-time
  clone), ADR-0017 (Save mechanism + initial fallback hierarchy — see Changed
  below), ADR-0018 (no client-side PDF library; HTML + browser print is the
  only PDF route), ADR-0019 (export schema versioning policy), ADR-0020
  (tenant identity via `application.context.resourceAccess[0]`), ADR-0021
  (three-action egress per pageshot precedent — supersedes ADR-0017's F1/F2/F3
  cascade).

### Changed

- **PRD-000 OS-15 partially superseded by PRD-001** — the export-half is now
  shipped in v1 (ADR-0015). The sort-controls half (per-rendering "sort by
  usage" et al.) remains deferred to Phase 2 unchanged.
- **ADR-0017 superseded in part by ADR-0021** — the original spec called for
  a single Download mechanism with an F1/F2/F3 fallback cascade engineered
  on demand if the canonical Save path failed at smoke. The T001 spike on
  2026-05-04 confirmed the canonical Save path is silent-blocked in the
  Marketplace iframe sandbox (host omits `allow-downloads` at the time of
  writing — known platform limitation, also documented inline in the sibling
  Pageshot product). The plan forked to the **pageshot three-action pattern**:
  Save preserved as future-proof and rendered disabled today; Open
  (`window.open` of the Blob URL) and Copy (`navigator.clipboard.writeText`
  for JSON/CSV; `ClipboardItem` with text/html + text/plain peers for HTML)
  ship as primary user-visible actions. ADR-0017 § Amendment 1 captures the
  spike outcome; ADR-0021 documents the three-action contract end-to-end.

### Deferred

- **DoD-5 bundle-cap escalation (NFR-1.4)** — the v1 cumulative gzipped delta
  measures ~38 KB against a 20 KB cap (file-summing × compression-ratio
  estimate; coarse). The cap was sized when the spec assumed a single
  Download button; ADR-0021's three-action pattern is structurally heavier.
  Two paths are tracked for `/ship`: re-measure precisely with
  `next-bundle-analyzer`, or amend NFR-1.4 to reflect the post-fork
  architecture. Tracked in `project-planning/workflow/current-run.json`
  `smoke_outcomes.bundle_cap_dod5`.
- **T047 HTML print-preview manual gate** — DoD-4 requires a print-preview
  pass on Chromium + Firefox + Safari × A4 + Letter against
  `pocs/poc-v1/html-output-sample.html`. Pending; recorded in `smoke_outcomes`.
- **T048 host-frame visual smoke** — `sitecore:marketplace-sdk-host-frame-testing`
  recipe, comparing clipped iframe screenshots of the live install on both
  surfaces against `pocs/poc-v1/`. Currently blocked on (a) host URL
  collection from the user and (b) POC re-spin for the action-cluster shape
  (the existing POC frames show the pre-fork single-Download UX). Recorded
  in `smoke_outcomes`.
- **Live walkthrough** — mandatory before `shipped` status per the test
  command's § 1d-i.8. Recorded in `smoke_outcomes.live_walkthrough`.
- **POC clickdummy update** — `pocs/poc-v1/` shows the pre-fork single-button
  UX. New frames for the three-action cluster + per-action states are queued
  for a `/document` polish pass after the live walkthrough lands.

### Dogfood (back into the agent framework)

Patches that landed alongside this iteration so the next Marketplace product
gets these for free:

- **Spike-first contract for iframe-side Save** — ADR-0017's spike codification
  (T001 of `/task-breakdown`) is the canonical pattern for any feature that
  depends on a sandbox-restricted browser API. The hard-fork to pageshot's
  three-action pattern shows the workflow when the spike fails, not just
  when it passes.
- **`40-sdk-contracts.mdc` exercised end-to-end** — the SDK contract gate
  surfaced an inaccuracy in the PRD's shorthand (`application.context.tenantName`
  doesn't exist on the SDK shape; the canonical access is
  `application.context.resourceAccess[0].tenantName`). ADR-0020 captures the
  correction and the new `requireTenantIdentity()` resolver pattern.
- **Bundle-cap measurement methodology** — DoD-5's "file-summing × ratio"
  approach is approximate; this iteration documents the precise alternative
  (`next-bundle-analyzer`) so future PRDs that touch the bundle have a
  better reference.

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
