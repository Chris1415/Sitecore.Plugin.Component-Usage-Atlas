# Architecture — Component Usage Atlas

> Narrative architecture overview for developers, reviewers, and future
> maintainers. For the full architecture blueprint with all decision-point
> trade-offs see `project-planning/architecture/`. For individual decisions
> with rationale see [`decisions.md`](decisions.md) and the ADRs in
> `project-planning/ADR/`.

## System overview

Component Usage Atlas is a Sitecore Marketplace app that gives content editors
a live, tenant-wide view of where every rendering — and its bound datasource
— is used across their tenant. The headline use case is *pre-change impact
analysis*: when an editor is about to publish, modify, or delete content,
they open a panel or widget to answer "if I do this, what else breaks?"
without leaving Pages.

The atlas is **fully live and in-memory**. A scan walks the tenant via the
Marketplace SDK's agent endpoints on demand, builds two indices in the
iframe heap, and caches the result for the lifetime of the browser tab.
There is no backend service, no persisted index, no scheduled job, and no
external network egress beyond the SDK itself. Installing the app means
registering one application with Sitecore Cloud Portal — there is nothing
else to deploy or maintain.

The app ships two surfaces from a single registration: a **Dashboard Widget**
for component-centric search and a **Page Context Panel** for page-centric
impact. Both surfaces import the same scan engine and the same singleton
state store, but each lives in its own iframe (its own JS heap), so a scan
running in the widget tab does not feed the panel tab and vice versa. Inside
a single iframe lifetime, only one scan runs at a time.

## Surface model

### Dashboard Widget — `xmc:dashboardblocks`

Mounted at the route `/widget`. Rendered by `WidgetSurface`
(`components/atlas/widget-surface.tsx`).

- **Search-first table** — type a rendering display name, the table filters
  client-side (no re-fetch). Columns: rendering name, total usages, distinct
  pages, datasource count.
- **Click-row drawer** (`UsageDrawer`) — opens a side drawer listing every
  page that uses the rendering, separated into *direct rendering usage* and
  *usage via datasource*. Each row click-throughs back into Pages.
- **Skipped-pages sub-drawer** (`SkippedDrawer`) — counts pages that failed
  during the scan and groups them by typed reason chip
  (`forbidden | timeout | not_found | network_error | other`). Forbidden
  rows are visually disabled and do not navigate.
- **Density toggle** — comfortable / compact rendering of the table.
- **Refresh atlas** — re-runs the scan; previous results stay visible until
  the new scan completes.
- **Scope picker** — narrow the scan to one collection (when the tenant has
  more than one).

### Page Context Panel — `xmc:pages:context-panel`

Mounted at the route `/panel`. Rendered by `PanelSurface`
(`components/atlas/panel-surface.tsx`).

The panel is page-centric — it subscribes to the SDK's `pages.context`
event so that when the editor switches pages in Pages, the panel updates in
place without re-scanning the tenant.

- **Page Context Card** — the active page's path and metadata at the top.
- **Rendering Impact List** (collapsible mini-accordion) — every rendering on
  the active page with a `+N other pages use this` counter that resolves once
  the global scan completes. Each row is **expandable**: clicking a row
  reveals an inline detail panel below it with two click targets — *"See all
  pages using this rendering →"* opens the per-rendering drawer (same drawer
  pattern as the widget); the datasource line opens the per-datasource
  drawer. Identical placements (same renderingId + same datasourceId) collapse
  into one row with a `×N` badge so a 12-Container page reads as one row, not
  twelve.
- **Lazy item-name resolution** — datasources whose layout reference is a
  bare GUID or `xpath:`/`/sitecore/...` path are resolved against the
  Authoring API on first paint via `core/use-datasource-names.ts` and a
  process-wide cache in `core/datasource-name-cache.ts`. When resolution
  fails the row falls back to `Item · {short-id}` so the editor still has a
  correlation hint.
- **Missing-datasource warnings** — when a page references a datasource that
  no longer exists in the tree.
- **Direct-bindings affordance** — a non-dismissable note that v1 counts only
  direct datasource bindings (see ADR-0006).

> **Anatomy note (S22/S23 — 2026-04-29 → 2026-04-30):** The original PRD
> § 5 / FR-8.1 spec called for a separate "Datasource impact" section stacked
> below the rendering list. Live-tenant smoke immediately surfaced two
> problems: (a) the cross-tenant datasource counter only makes sense in the
> context of the rendering that binds it, and (b) the stacked layout broke
> the rendering↔datasource visual link past 20+ items. The panel was
> reshaped into a single nested tree; `<DatasourceImpactGroup />` is no
> longer mounted on the panel surface (kept in the codebase for potential
> widget-side reuse).

The per-page render uses a separate `AbortBus` from the global scan, so the
panel paints in under one second on page-switch even while the global scan
is still in flight.

## Scan engine

`core/scan-engine.ts::runScan` is the only place in the codebase that calls
XMC agent endpoints. It is pure orchestration — every external call is
delegated to a typed wrapper in `lib/sdk/queries.ts`.

The scan walks three SDK calls in sequence, then fans out:

1. `xmc.agent.sitesGetSitesList` (filtered by collection scope if set)
2. For each site, `xmc.sites.retrieveSite` for the default language and
   `xmc.agent.sitesGetAllPagesBySite` for the page list
3. For each page, `xmc.agent.pagesGetComponentsOnPage` to read the rendering
   and datasource bindings

The components-fan-out runs at concurrency 8 (see ADR-0012) using a
worker-pool pattern in `core/concurrency-pool.ts` that honors an
`AbortSignal`. On rate-limit responses, calls are wrapped in
`core/scan-config.ts::withBackoff` — exponential backoff with jitter, capped
retries, and `AbortSignal` short-circuit. If retries are exhausted, the page
lands in `skipped[]` with reason `network_error`; the scan continues.

Per-page failures are classified by `core/error-classifier.ts` into a typed
union: `forbidden | timeout | not_found | network_error | other`. The whole
scan never aborts on a single page error. A shared `core/abort-bus.ts`
threads cancel through every in-flight request so the user can stop the
scan and keep whatever was gathered so far (the *cancel-with-act* pattern).

The state machine in `core/scan-state-machine.ts` enforces the only legal
transitions: `idle → scanning → completed | canceled | error`. Re-scans
go through `idle` between completions; a strict-mode guard in `runScan`
prevents two scans from racing inside one iframe.

When the scan finishes (or is canceled), `core/index-builder.ts` walks the
raw results into the two atlas indices:

- `renderingIndex: Map<RenderingId, RenderingUsage>` — for every rendering,
  the pages that use it and the distinct datasources bound to it.
- `datasourceIndex: Map<DatasourceId, DatasourceUsage>` — for every
  datasource, the pages that reference it via any rendering.

Index-builder is a pure function — input: raw scan results plus page refs;
output: indices plus skipped list plus totals. It is the load-bearing unit
test surface of the codebase.

## State model

Atlas state is held in a **module-singleton** (`core/atlas-store.ts`) wired
to React via `useSyncExternalStore` and exposed through
`core/use-atlas-slice.ts` for selective re-render. There is no Context, no
Zustand, no Redux — see ADR-0010 for the rationale.

`AtlasState` is a tagged union:

- `{ kind: 'idle' }`
- `{ kind: 'scanning', progress, partial }`
- `{ kind: 'completed', atlas }`
- `{ kind: 'canceled', partial }`
- `{ kind: 'error', reason }`

Once the atlas is `completed`, `core/atlas-freeze.ts` deep-freezes the entire
result object before any UI sees it. This both expresses intent ("the atlas
is immutable") and surfaces accidental mutation as a runtime error in tests.

Surface mount and unmount cycles inside the same iframe lifetime do not
clear the state — the atlas survives navigation between tabs as long as the
iframe is alive. The cache is invalidated on three events: explicit
"Refresh atlas", scope change (collection filter), and root unmount.

## SDK boundary

The SDK boundary is `lib/sdk/`. Three files:

- `client.ts` — `ClientSDK.init({ modules: [XMC] })` and the
  `MarketplaceProvider` React context that surfaces `useMarketplaceClient()`
  and `useAppContext()`. The `requireContextId()` guard from
  `core/context-resolver.ts` is the only legal way to extract
  `sitecoreContextId` — it never silently casts an `undefined` to `string`.
- `queries.ts` — typed wrappers around `client.query('xmc.*', { params })`
  calls. Each wrapper takes a narrowed `contextId: string` and unwraps the
  XMC double-envelope (`result.data?.data`) before returning. The most
  load-bearing wrapper is `queryComponentsOnPage`, which renames the SDK's
  raw shape (`componentId / componentName / dataSource (string) / placeholder`)
  to the atlas domain shape (`renderingId / renderingName / datasourceId /
  placeholderKey`).
- `types.ts` — two layers: `Sdk*` raws cite the generated SDK types
  (`@sitecore-marketplace-sdk/xmc/dist/types.gen.d.ts`) per the
  `40-sdk-contracts.mdc` rule, and the Atlas-shaped domain types are what
  `core/` and `components/` consume. The boundary is one-way:
  domain types never leak back into SDK calls.

## Telemetry and observability

Telemetry stays **in the iframe**. There is no `postMessage` to the host
frame, no `fetch`, no `XHR`, no `sendBeacon`. See ADR-0013.

`core/telemetry.ts` exposes a single `track(event)` function that:

1. Pushes the event into a 500-entry FIFO ring buffer (oldest dropped on
   overflow).
2. Mirrors the event to `console.info("[CUA]", event)` for visibility under
   browser devtools.

The ring buffer is exposed at runtime via a `<DebugPanel />` reachable when
`?debug=1` is on the surface URL.

Two CI gates enforce the no-egress rule and the no-vanity-KPI rule:

- `npm run audit:network` greps `core/`, `lib/`, `components/`, `app/` for
  `fetch`, `XMLHttpRequest`, `sendBeacon`. Every match must live inside an
  `@sitecore-marketplace-sdk/*` call.
- `npm run audit:anti-metric` greps the same trees for forbidden vanity-KPI
  strings (`scans/minute`, `API calls served`, `session count` as primary
  KPIs). The same forbidden-pattern set is also exercised as a Vitest test
  in `core/__tests__/telemetry-conformance.test.ts` so the gate fires inside
  `npm run test` regardless of the npm-script gate.

## Loading visualization

The loading visualization is the v2 *Console Operator* aesthetic from the
winning POC: a 3-segment progress strip (sites / pages / components) with
a numeric readout, elapsed-time counter, and an accessible cancel button.
Cancel preserves the partial atlas — clicking a result row in the next 30
seconds counts as a *cancel-with-act* and is not a frustration cancel.

Animations are CSS-only to stay at 60fps inside the portal sandbox. See
ADR-0011 for the visual-direction decision and the trade-off versus the
generative-art bloom and mini-game alternatives (both deferred to Phase 2).

## Identity model

- **Rendering identity** is the rendering definition item ID — the
  template-level component definition. Two instances of `HeroV2` on
  different pages share the same rendering ID.
- **Datasource identity** is the bound content item's ID.
- **`PageRef`** is `{ pageId, pageName, sitePath, siteId, siteName, language,
  collectionId? }`.

Editors see display names by default. When two renderings on the same result
share a display name, all colliding rows render with a `· <last-7-of-id>`
suffix and the full ID is exposed via tooltip. The collision computation
lives in `lib/collisions.ts::computeCollisions` and runs once per parent
render via `useMemo`. See ADR-0005.

## Routing

Three Next.js routes:

- `/widget` — Dashboard Widget surface. Registered as the
  `xmc:dashboardblocks` extension-point URL.
- `/panel` — Page Context Panel surface. Registered as the
  `xmc:pages:context-panel` extension-point URL.
- `/` — `app/page.tsx` returns Next.js `notFound()`. See ADR-0014.

The root `notFound()` rule is non-negotiable: outside the Cloud Portal
iframe, `<MarketplaceProvider>` shows its loader and never resolves, so a
public root would be a UX trap. The local smoke-test rule documented in the
README ("always hit `/widget` or `/panel` directly") is the operational
counterpart.

## What is not in v1

These are explicit non-goals in v1, all listed in the PRD's Out-of-Scope
section (`OS-1` through `OS-16`):

- **Persistence** — no IndexedDB, no localStorage, no external store. The
  atlas dies with the tab. See ADR-0003.
- **History / version drift** — no time-series view of when a rendering
  came or went.
- **Partial / page designs propagation** — datasources inherited from page
  designs are NOT counted in v1. See ADR-0006.
- **A/B variants and personalization** — variant-level usage is not in v1.
- **Cross-tenant umbrella** — each install is bound to one tenant; no
  cross-tenant fan-out (this is a Marketplace SDK constraint, not a
  v1 simplification — see ADR-0002).
- **Mini-game during loading** — gated on Phase-2 if the "felt fast" pulse
  underperforms.
- **Cross-tab cache sync** — each tab maintains its own scan and cache.
- **Sort / export controls in the widget** for IA / dev personas.
- **Active interception of publish / delete actions in Pages** — not
  feasible (Marketplace SDK does not expose these hooks).

The full Phase 2 / Phase 3 candidate list is in the PRD § 5 (`OS-1` to
`OS-16`) and § 15 (Future Opportunities).
