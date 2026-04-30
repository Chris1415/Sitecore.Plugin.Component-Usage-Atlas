---
title: Component Usage Atlas — Host-Frame Smoke Test Addendum
run_id: 20260427T104955Z
addendum_to: products/component-usage-atlas/project-planning/plans/test-report-20260428T122500Z.md
captured_at: 2026-04-28T14:07:00Z
captured_by: 07-qa-specialist (assisted, host-frame protocol per .agent/skills/sitecore/marketplace-sdk/host-frame-testing.md)
verdict: PASS-WITH-CAVEATS
---

# Host-Frame Smoke — T094 Evidence

## Inputs

| Input | Value |
|-------|-------|
| Host URL | `https://pages.sitecorecloud.io/editor?organization=org_Yr0e8LadQ1bxB05s&tenantName=sitecoresaa516c-chahdevexjoee24-proda41d&sc_site=solo-website&sc_itemid=a1628138-…` (Pages context-panel surface) |
| App origin | `https://8805-2003-c0-d736-f491-c922-c1d0-fab5-d873.ngrok-free.app` (ngrok tunnel of local dev) |
| App name (registered) | "Dog feeding App" — registered Marketplace app entry that points to this build (cosmetic; **finding S1**) |
| Surface tested | `xmc:pages:context-panel` (panel only — Dashboard widget not exercised this run) |
| POC reference | `products/component-usage-atlas/pocs/poc-v2/index.html` |
| Auth | Interactive SSO (user confirmed READY) |
| Browser viewport | 1440×900 |
| Iframe clip box | x=310 y=174 w=480 h=726 |
| Tenant scale | 28 pages, 21 renderings, 54 datasources |

## States captured

| State | Host clip | POC reference | Notes |
|-------|-----------|---------------|-------|
| Default (panel · page context) | `test-evidence/20260428-smoke/state-default-host.png` | screen 4 (`state-default-poc-panel.png`) | Loaded Atlas with Home page selected; tenant stats summary visible |
| Scanning (panel · refresh in flight) | `test-evidence/20260428-smoke/state-scanning-host.png` | screen 1 (`state-scanning-poc.png`) — **widget-scoped only**; no panel-scoped POC | Triple-segment progress bars + Cancel button + `Components 0/28 · 00:01` counter; `+?` placeholders on rendering rows during scan |
| Drilldown (rendering counter drawer) | `test-evidence/20260428-smoke/state-drilldown-host.png` | screen 5 (`state-drilldown-poc.png`) — datasource drawer (analogous, not identical) | HeroBanner / 9 uses / 9 pages · 7 datasources / sites×pages list / "esc closes · click row to navigate" footer |
| Empty | not captured (Pages reverted to Home before capture) | — | Page navigated to `Test-Pages/...` showed *"No renderings on this page yet."* in snapshot before reverting; not photographed |
| Cancel-with-act | not captured | — | 28-page tenant scan completes in ≈ 1 s — no click-window for Cancel |

Evidence directory: `products/component-usage-atlas/test-evidence/20260428-smoke/`.

## 5-axis scoring — per state

### Default panel · page context

| Axis | Verdict | Note |
|------|---------|------|
| Layout & spacing | PASS | Card chrome, header band, row layout (counter-on-left, name-and-datasource center, arrow-right) match POC. |
| Typography | PASS | Sans family, counter-large/label-medium/datasource-small hierarchy match. |
| Color & contrast | PASS | Purple counter accent, gray subtext, info-blue "Direct bindings only" chip, green check before stats summary all match POC tokens. |
| Component anatomy | WARN | POC stats line is **page-scoped** (`5 renderings · 3 datasources · last scan 14:32`); host stats line is **tenant-scoped** (`21 renderings · 54 datasources · 28 pages`). Architectural divergence from POC, not a regression — flag for design review. |
| State fidelity | PASS | Item-info row + Refresh + RENDERINGS ON THIS PAGE list match. POC's "DATASOURCE IMPACT" sub-section was below scroll fold — not contradicted. |

### Scanning panel

POC v2 only models **widget**-scoped scanning (screen 1). Host scans the **panel** surface — no equivalent POC frame.

| Axis | Verdict | Note |
|------|---------|------|
| Layout & spacing | N/A — POC GAP | Host shows triple-bar progress + counter; POC has dots + per-phase counters at widget scale only. |
| Typography | PASS | Counter typography matches widget POC. |
| Color & contrast | PASS | Phase color sequence (green completed → purple in flight) reads as branded loading per ADR-0011. |
| Component anatomy | NEW | `+?` count placeholders during scan are a host-only invention (not in POC). Visually clean; preserves layout stability. |
| State fidelity | NEW BASELINE NEEDED | Per host-frame-testing.md § 6, host clips should not silently become baselines. Recommend POC v2 add `Panel · scan running` screen, or document acceptance of current host clip as new ground truth. |

### Drilldown counter drawer

| Axis | Verdict | Note |
|------|---------|------|
| Layout & spacing | PASS | Drawer slides over panel; header with counter pill top-right + close X; sectioned list; sticky footer. |
| Typography | PASS | Title + subtitle + section headers + row labels match POC scale. |
| Color & contrast | PASS | Counter pill accent matches; light surface, gray subtext, purple section accent. |
| Component anatomy | PASS | Drawer chrome shape matches POC `Panel · counter drawer`. **Note:** POC drawer drills a *datasource* (HeroData-Main → cross-tenant pages bound + renderings binding it); host drawer drills a *rendering* (HeroBanner → pages using it). Both are valid Atlas drilldown targets — pattern reused, target differs. |
| State fidelity | PASS | "esc closes · click row to navigate" footer + Close drawer button match POC. |

## Findings

### S1 — Registered app name "Dog feeding App" (severity: minor)
The app appears in the Sitecore portal panel chrome with the title **"Dog feeding App"** + a red dog logo, not as "Component Usage Atlas." Confirms T093 (Cloud Portal registration) was performed, but under a placeholder/dogfood name. Not a code defect — Marketplace app metadata edit in Cloud Portal. Worth renaming before any external demo.

### S2 — Stats summary scope diverges from POC (severity: medium)
Host panel header shows **tenant-wide** stats (21 renderings · 54 datasources · 28 pages); POC panel header shows **page-scoped** stats (`5 renderings · 3 datasources · last scan 14:32`). Either is defensible — tenant view is cross-context; page view answers "what's on THIS page." Decide: keep current (atlas-summary anchor at top of panel) or restore POC's page-scoped header.

### S3 — POC v2 lacks Panel-scanning frame (severity: medium — POC gap)
POC v2 screen 1 is widget-scoped scanning only. Panel scanning visual (triple progress bars + Cancel + `Components X/Y · MM:SS` + `+?` placeholders) has no POC equivalent and was implemented from PRD/ADR-0011 verbatim. Per host-frame-testing.md § 6, this requires either a POC update (`/architect` § 3) or an explicit decision to promote the host clip as new baseline. Recommend the former.

### S4 — Drilldown target divergence (severity: low — clarification only)
POC `Panel · counter drawer` (screen 5) drills a *datasource*; host drilldown from rendering row drills a *rendering*. Same drawer pattern, different target type. Both are valid per PRD; POC just happened to picture the datasource case. Document both flows in the next POC iteration.

### S5 — Host console errors (severity: low — host-side only)
Three errors per page navigation: `_vercel/insights/script.js 404`, `_rsc=… 404`, `api/editing/render?_rsc=… 401`. All originate from `xmc-...sitecorecloud.io` (host editing surface) — **none from Atlas origin**. Atlas's own console is clean (only `[CUA]` telemetry + `xmc.agent.*` query INFO logs). Confirms ADR-0013 in-iframe telemetry is not leaking IDs at the visible console-message level.

### S6 — Cancel-with-act not exercised (severity: low — coverage gap)
28-page tenant scan completes in ~1s; not enough time to click Cancel. To validate Cancel-with-act flow (T094 sub-criterion), need either (a) a larger tenant, or (b) artificial throttle/breakpoint. Recommend: add a future smoke against a larger tenant before promoting T094 to `pass`.

### S7 — Empty state not captured (severity: low — coverage gap)
While navigating, snapshot showed `"No renderings on this page yet."` for a different page, but Pages reverted to Home before screenshot. Empty state observed in DOM but no clipped image in evidence.

---

## Live walkthrough findings (user, 2026-04-28)

User reviewed real-tenant render (Image #1 panel, Image #2 rendering drawer, Image #3 DATASOURCE IMPACT, Image #4 datasource drawer). Four substantive product-level issues raised during walkthrough.

### S8 — Datasource rows show raw IDs as both title and subtitle (severity: HIGH — usability blocker for marketers)

In `DATASOURCE IMPACT`, rows fall into two display patterns:

| Pattern | Example | Cause |
|---------|---------|-------|
| Path-based | `local:/Data/Home Content Top Banner` | `dataSource` field is a `local:` path; current code shows path as both title and subtitle |
| GUID-based | `1db01d13-2526-4837-ab03-89180e76769e` | `dataSource` field is a bare item ID; **no name resolved**; ID printed twice (title + subtitle) |

Marketer reaction (verbatim): *"those are pretty useless for a marketer. Those are datasource items. Don't they have an item name?"*

**Required redesign of the row anatomy:**
- **Title** = item NAME (resolved via Authoring/Content GraphQL or layout-side metadata) — e.g. `Home Content Top Banner`, `Brand List`
- **Subtitle** = path OR id (whichever Sitecore returned) in monospace muted color — e.g. `local:/Data/Home Content Top Banner` or `{1db01d13-…}`
- **Fallback** when name cannot be resolved: derive last path segment for `local:` paths (`local:/Data/Foo Bar` → display name `Foo Bar`); for bare GUIDs, show `Unnamed item` + the GUID and lazy-resolve via Item Service / layout-presentation lookup.

**Source-of-truth to consult:** the current page's **layout/presentation details** (which the editor is currently looking at) include the datasource item references with a resolvable item path that yields a name. The Authoring GraphQL `item(path: …)` returns `name` + `displayName`. Add a resolver step after `pagesGetComponentsOnPage` returns; cache by item id.

**Same fix applies inside the rendering drawer** for any datasource references shown there.

### S9 — Home page displayed as `(home)` instead of `Home` (severity: MEDIUM — display name resolution bug)

In Image #4 (`DIRECT RENDERING USAGE` drawer for HeroBanner), three rows show `(home) · solo-website /` where the actual Sitecore item is named `Home`. This is the route-name fallback leaking through — likely from `sitesGetAllPagesBySite` returning either an empty `displayName` for the root or a JSS-style `(home)` route placeholder.

**Fix:** display-name resolution chain `displayName || name || pathSegmentTitleCase || '(home)'`. The literal string `(home)` should not be a user-visible value.

### S10 — Datasource drilldown drawer shows the wrong content (severity: HIGH — semantic regression)

User flow: panel `DATASOURCE IMPACT · local:/Data/MediaText · 2 pages` → click `→` → drawer opens.
**Expected:** drawer header = the datasource item; body = list of pages that bind this datasource (the *content reuse* answer).
**Actual:** drawer reuses the rendering-drilldown layout — so user sees rendering usage data again, redundant with the rendering rows above.

User feedback (verbatim): *"i would expect all the pages where this datasource item is also used, not the rendering again: this is redundant as we have top the rendering item bottom the datasource item which both open the same sidebar."*

**Required:** route the drawer by source row type:

| Source row | Drawer header | Drawer body |
|------------|---------------|-------------|
| Rendering on this page | `<Rendering name>` + `<N> uses` pill + `N pages · M datasources` | section `DIRECT RENDERING USAGE · N PAGES`; one row per page placement (already correct) |
| Datasource impact | `<Datasource item name>` + `<N> pages` pill + `<N> pages · <M> renderings binding it` | NEW: section `PAGES BINDING THIS DATASOURCE · N`; rows = pages where datasource is bound. Below: section `RENDERINGS BINDING THIS DATASOURCE · M`; rows = each rendering definition that uses this datasource (with placement count badge). Matches POC v2 screen 5 anatomy ("CROSS-TENANT PAGES BOUND" + "RENDERINGS BINDING THIS DATASOURCE"). |

The POC v2 already designed this split correctly (screen 5 = datasource-target drawer); implementation collapsed both targets into the rendering-target view. Restore the POC's two-target drawer routing.

### S11 — Visual link between rendering row and its datasource (severity: MEDIUM — comprehension aid)

Each datasource shown in `DATASOURCE IMPACT` is, by construction, bound by at least one rendering listed in `RENDERINGS ON THIS PAGE` above (renderings can have no datasource, but every datasource has ≥1 rendering binding it on this page). Today the user has to read both lists and mentally match by datasource path string.

User ask (verbatim): *"can we also somehow highlight which rendering belongs to which datasource item as every datasource item mentioned should have at least one rendering which uses it, but of course not every rendering has a datasource item"*

**Options to consider (rank in design follow-up):**
1. **Hover affinity** — hover a `RENDERINGS ON THIS PAGE` row with a datasource → highlight the matching `DATASOURCE IMPACT` row, and vice versa.
2. **Color/letter tag** — auto-assign small colored tags (or letter A/B/C) per distinct datasource; render them on both sides.
3. **Anchor jump** — clicking the datasource path in a rendering row scrolls + flashes the matching DATASOURCE IMPACT row.
4. **Single grouped view (radical)** — collapse the two sections into one "By datasource → renderings binding it (+ pages cross-tenant)" tree. **Tradeoff:** loses the rendering-on-this-page primary surface; not recommended.

Recommended: option 1 + option 2 stacked. Cheap to implement (id-keyed hover state + a deterministic palette by datasource id).

## Implementation log — S8/S9/S10/S11 fixes (2026-04-29)

User authorized direct execution after walkthrough. All four findings landed on the same prd-000 branch:

| Finding | Files touched | Notes |
|---------|---------------|-------|
| S8 — datasource name resolution + row anatomy | `lib/sdk/datasource-name.ts` (new), `core/index-builder.ts`, `components/atlas/datasource-impact-group.tsx`, `components/atlas/rendering-impact-list.tsx` | New `deriveDatasourceDisplayName()` extracts last path segment from `local:/Data/<X>` and `xpath:/...` patterns, returns `Unnamed item` for bare/braced GUIDs, decodes URL-encoded segments. Index-builder now seeds `DatasourceUsage.displayName` with the parsed name (was raw id). Both panel rows fall back to the helper when atlas hasn't built yet. |
| S9 — `(home)` sentinel removed | `lib/sdk/queries.ts` | `deriveNameFromPath()` returns `Home` for empty/root paths and decodes URL-encoded segments. |
| S10 — two-target drawer | `components/atlas/datasource-usage-drawer.tsx` (new), `components/atlas/datasource-impact-group.tsx`, `components/atlas/panel-surface.tsx` | New `<DatasourceUsageDrawer />` opened from `DATASOURCE IMPACT` rows. Header shows datasource name + page-count pill; subtitle shows raw id. Two body sections per POC v2 screen 5: `Pages binding this datasource · N` (clickable, navigates editor) + `Renderings binding this datasource · M` (read-only, lists rendering names with placement counts on this datasource). `DatasourceImpactGroup` no longer routes through a host-rendering id — it emits `onSelectDatasource(datasourceId)` directly. |
| S11 — visual affinity | `lib/datasource-tag.ts` (new), `components/atlas/datasource-impact-group.tsx`, `components/atlas/rendering-impact-list.tsx`, `components/atlas/panel-surface.tsx` | Deterministic 10-color palette keyed by datasource id (`hash(dsId) % palette`). Tag dot rendered next to datasource name on both lists and inside the new drawer header. `PanelSurface` owns `hoveredDatasourceId` state; both lists report hover via `onHoverDatasource`; matching rows get a subtle `bg-neutral-bg ring-primary/40` affined treatment. |

**Test coverage added (3 files, 22 tests):**
- `lib/sdk/__tests__/datasource-name.test.ts` (12 tests) — local: paths, xpath:, bare/braced GUIDs, URL-decoding, fallbacks.
- `lib/__tests__/datasource-tag.test.ts` (4 tests) — determinism, hex format, palette spread, empty-input safety.
- `components/atlas/__tests__/datasource-usage-drawer.test.tsx` (6 tests) — header/pill/subtitle, page+rendering sections, navigate callback, unknown-rendering fallback, footer close.

**Gates after implementation:** lint 0 errors / 2 pre-existing warnings; typecheck 0; test 241/35 passing; build OK; audit:network OK; audit:anti-metric OK.

**Out of scope (Phase-2 reminder):** Bare-GUID datasources still display as `Unnamed item` because v1 doesn't hit the Authoring Item API per page during scan. A name-resolution pass (Authoring GraphQL `item(path: …)`) can be added once we decide the budget — recommend doing it lazily on drawer-open rather than in the hot scan path.

## Verdict

**T094 outcome: `pass_with_caveats`** — host-frame iframe boots, renders, fetches XMC data, completes tenant scan, drives drilldown drawer, all under real Pages chrome with real Blok theme. Three of five PRD-listed states (default / scanning / drilldown) captured cleanly. Two (cancel-with-act / empty) deferred to a tenant or session that affords them.

No FAIL on any visual axis. Two WARN (stats-scope, scanning POC gap) are design-decision items, not regressions.

## Recommended follow-ups

**Blocking before next external demo:**
1. **Resolve datasource item names** and rebuild the row anatomy (title=name, subtitle=path/id). (S8 — HIGH)
2. **Restore the two-target drawer routing** so datasource impact rows open a datasource-scoped drawer, not the rendering drawer. (S10 — HIGH; POC v2 screen 5 anatomy already specifies this)

**High value:**
3. **Display-name fallback chain** to eliminate `(home)` and similar sentinel strings. (S9)
4. **Visual rendering↔datasource affinity** (hover highlight + per-datasource color tag). (S11)

**Design alignment / coverage:**
5. **Decide stats-line scope** (tenant vs page) and align POC ↔ implementation. (S2)
6. **Update POC v2** with a `Panel · scan running` screen so future host-frame compares have ground truth. (S3)
7. **Re-run smoke against a larger tenant** to capture cancel-with-act + the editor-walkthrough flow (T113). (S6)
8. **Capture empty state** on next pass — navigate to `Test-Pages/Bad Content` (or any 0-rendering page) and freeze before re-navigation. (S7)
9. **Cosmetic: rename Cloud Portal app entry** from "Dog feeding App" to "Component Usage Atlas" before external demo. (S1)
