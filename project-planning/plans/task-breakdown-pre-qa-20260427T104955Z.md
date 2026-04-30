# Development Execution Plan — Component Usage Atlas

---
document_type: task_breakdown
artifact_name: task-breakdown-20260427T104955Z.md
generated_at: 2026-04-27T16:00:00Z
run_manifest: products/component-usage-atlas/project-planning/workflow/run-20260427T104955Z.json
source_inputs:
  - products/component-usage-atlas/project-planning/PRD/prd-000.md
  - products/component-usage-atlas/project-planning/PRD/prd-minimal-000.md
  - products/component-usage-atlas/project-planning/architecture/architecture-20260427T104955Z.md
  - products/component-usage-atlas/project-planning/ui-design/ui-design-20260427T104955Z-v2.md
  - products/component-usage-atlas/pocs/poc-v2/index.html
  - products/component-usage-atlas/pocs/poc-v2/styles.css
  - products/component-usage-atlas/pocs/poc-v2/app.js
  - products/component-usage-atlas/project-planning/ADR/adr-0002-mode-a-iframe-only-no-backend.md
  - products/component-usage-atlas/project-planning/ADR/adr-0003-no-persistence-live-in-memory-atlas.md
  - products/component-usage-atlas/project-planning/ADR/adr-0004-two-surfaces-single-app.md
  - products/component-usage-atlas/project-planning/ADR/adr-0005-rendering-and-datasource-identity-model.md
  - products/component-usage-atlas/project-planning/ADR/adr-0006-direct-datasource-bindings-only.md
  - products/component-usage-atlas/project-planning/ADR/adr-0007-scaffold-marketplace-client-side.md
  - products/component-usage-atlas/project-planning/ADR/adr-0008-bundler-stay-on-nextjs.md
  - products/component-usage-atlas/project-planning/ADR/adr-0009-blok-as-ui-layer.md
  - products/component-usage-atlas/project-planning/ADR/adr-0010-state-module-singleton.md
  - products/component-usage-atlas/project-planning/ADR/adr-0011-loading-visual-branded-animation.md
  - products/component-usage-atlas/project-planning/ADR/adr-0012-scan-concurrency-and-backoff.md
  - products/component-usage-atlas/project-planning/ADR/adr-0013-telemetry-in-iframe-only.md
  - products/component-usage-atlas/project-planning/ADR/adr-0014-root-route-notfound.md
  - .agent/skills/sitecore/setup/scaffold.md
  - .agent/skills/sitecore/marketplace-sdk/client.md
  - .agent/skills/sitecore/marketplace-sdk/xmc.md
  - .agent/skills/sitecore/marketplace-sdk/lifecycle.md
  - .agent/skills/sitecore/marketplace-sdk/testing-debug.md
consumed_by:
  - QA Specialist (07) enriches this file in place; Developer Code Monkey (08) implements from this file + prd-minimal-000.md only
next_input:
  - products/component-usage-atlas/project-planning/plans/qa-report.md (optional on minimal track — likely null for this run)
---

## 1. Implementation Overview

Component Usage Atlas is a **single Sitecore Marketplace app** (one registration) that ships **two iframe entries** living side-by-side in the same Next.js codebase:

- **Dashboard Widget** (`/widget`) mounted at `xmc:dashboardblocks` — search-first table of every rendering used across the tenant, with per-rendering page lists.
- **Page Context Panel** (`/panel`) mounted at `xmc:pages:context-panel` — current-page rendering list with cross-tenant counters and a Datasource Impact group.

Both surfaces share one in-memory **atlas singleton** (no persistence, no backend, no cron, no DB). On first mount in an iframe the surface triggers a scan via the shared engine: `xmc.agent.sitesGetSitesList` → for each site `xmc.sites.retrieveSite` (default language) → `xmc.agent.sitesGetAllPagesBySite` → fan-out to `xmc.agent.pagesGetComponentsOnPage` (concurrency cap 8, exponential backoff with jitter, 12s per-page timeout). The result is two indices (`renderingIndex`, `datasourceIndex`) that power both surfaces.

The user has selected **UI variant v2 "Console Operator"** (`ui-design-20260427T104955Z-v2.md`). Visual reference is the winning POC clickdummy at `pocs/poc-v2/` (`index.html` + `styles.css` + `app.js`). The design is information-dense, mono-numerical, action-first; loading lives in a CI-style segmented progress strip ("Sites · Pages · Components") at the top of the surface — built on Blok semantic tokens only, no raw hex.

This is the **third Marketplace dogfood app** in the `products/` portfolio (after `pageshot` and `quickcopy`) and the **first to exercise multi-step graph fetching across the tenant** — meaning the scan engine is the load-bearing experiment. The implementation follows architecture decisions ADR-0002..ADR-0014 and the Marketplace Client-Side scaffold (Scaffold 2 per `setup/scaffold.md`).

**Slim-context developer note:** Developer (08) implements this plan with **only `prd-minimal-000.md` + this task breakdown**. Every architectural boundary, every external SDK key, every Blok component, and every visual spec the developer needs is captured in § 4c below. The Developer **may** open `pocs/poc-v2/{index.html,styles.css,app.js}` to match visual fidelity — those are the canonical visual reference per template § 4c-4.

---

## 2. Epics

The split below is suggested (the QA Specialist may merge or split during enrichment). Tasks in § 4 are tagged with their epic for traceability.

| Epic | Title | Scope summary |
|------|-------|---------------|
| **E1** | Marketplace scaffold + lifecycle wiring | Scaffold 2, MarketplaceProvider, two route entries (`/widget`, `/panel`), root `notFound()`, PNA headers, lint fixes, test stack install, Blok theme + components install. |
| **E2** | Scan engine | `lib/sdk/queries.ts` wrappers, context resolver, sites enumerator, site-language resolver, pages enumerator, components fetcher, concurrency pool, abort bus, error classifier, scan-state machine, scan engine orchestrator. Pure index builder. |
| **E3** | Atlas state model | Module-singleton `atlas-store.ts`, `useSyncExternalStore` selector hooks, freeze utility, scan transitions, two-iframe scoping. |
| **E4** | Widget surface | `WidgetSurface`, search input, search-first table with `<RenderingNameCell />`, sortable columns, mini-bar, density toggle, KPI rail, freshness ribbon, refresh action, scope picker. |
| **E5** | Panel surface | `PanelSurface`, active-page rendering stack via `<CounterRow />` (panel paints before global scan), datasource impact group, missing-datasource handling, page-switch via `pages.context` subscription. |
| **E6** | Loading visual + drawer | `<ScanStatusBar />` segmented progress + cancel button, `<UsageDrawer />` (Direct usage + Via datasource sections), skipped-pages sub-drawer, `<EmptyStates>` / `<ErrorStates>`. |
| **E7** | Telemetry + observability | `core/telemetry.ts` ring buffer, `console.info` markers, `<DebugPanel />` (gated), no PII contract, anti-metric guard hook. |
| **E8** | Edge handling | Display-name collision suffix, `(unknown rendering)` group, `Direct bindings only` affordance, missing-datasource warning, permission-denied skipped reasons, deep-link via `pages.context` mutate. |
| **E9** | Build/CI/release | `npm run typecheck` + `lint` + `test` + `build` gates, Vercel deploy, Cloud Portal registration paste, README rule documenting `/widget`/`/panel` smoke-test rule. |

UI variant v2 "Console Operator" supplies the visual contract for E4, E5, E6, E8 (visible affordances). POC at `pocs/poc-v2/` is the canonical look-and-feel reference.

---

## 3. Feature Breakdown

Decomposed by epic, mapping to PRD feature numbering (FR-N) and PRD acceptance criteria (AC-N). The Developer should treat this as an outline of how tasks group; § 4 is the unit of execution.

### E1 — Marketplace scaffold + lifecycle wiring
- **F-E1.1 Scaffold the Marketplace Client-Side app** at `products/component-usage-atlas/site/`. Apply quickstart fixes (P-019 lint, Nova badge API), install test stack, flatten `next-app/` if needed.
- **F-E1.2 Wire two iframe entries** — `app/widget/page.tsx`, `app/panel/page.tsx`, `app/page.tsx` returns `notFound()`. (ADR-0014.)
- **F-E1.3 Provider stays at root** — keep `<MarketplaceProvider>` in `app/layout.tsx`. (ADR-0014.)
- **F-E1.4 Add Chrome PNA headers** to `next.config.mjs` (mandatory before portal install). (Scaffold 2 step 8.)
- **F-E1.5 Install Blok theme + components** per § 4c-3 component list. (ADR-0009.)
- **F-E1.6 Verify SDK component-record shape** (OQ-A1) — inspect installed `@sitecore-marketplace-sdk/xmc` types for `pagesGetComponentsOnPage`; record version in CATALOG.

### E2 — Scan engine
Maps to PRD FR-1 (tenant scan engine).
- **F-E2.1 SDK adapter** — `lib/sdk/client.ts` (re-exports), `lib/sdk/queries.ts` (5 typed wrappers; double-unwrap), `lib/sdk/types.ts` (domain types).
- **F-E2.2 Context resolver** — `core/context-resolver.ts::requireContextId`. Throws on absence; prefers `.live` over `.preview`.
- **F-E2.3 Sites + collections** — `core/sites-enumerator.ts`, optional `core/collections.ts` for scope filter (FR-1.8).
- **F-E2.4 Site language** — `core/site-language-resolver.ts` (IS-13, FR-1.3); per-site cache.
- **F-E2.5 Pages enumeration** — `core/pages-enumerator.ts`. (FR-1.3, OQ-A2 — verify pagination at scaffold time.)
- **F-E2.6 Components fetcher** — `core/components-fetcher.ts`. (FR-1.4.)
- **F-E2.7 Concurrency pool** — `core/concurrency-pool.ts` (cap=8, FR-1.6, NFR-2.2).
- **F-E2.8 Abort bus** — `core/abort-bus.ts` (FR-5.2).
- **F-E2.9 Error classifier** — `core/error-classifier.ts` → `'forbidden' | 'timeout' | 'not_found' | 'network_error' | 'other'` (FR-7.2).
- **F-E2.10 Backoff + per-page timeout** — `core/scan-config.ts` (`SCAN_CONCURRENCY=8`, `PER_PAGE_TIMEOUT_MS=12_000`, `RATE_LIMIT_BACKOFF`). (ADR-0012.)
- **F-E2.11 Index builder (pure)** — `core/index-builder.ts` (FR-1.5, ADR-0005, ADR-0006). Unit-test surface for FR-7.2 classification.
- **F-E2.12 Scan engine orchestrator** — `core/scan-engine.ts::runScan(ScanInput): ScanHandle` (returns `cancel()` + `donePromise`).
- **F-E2.13 Scan-state machine** — `core/scan-state-machine.ts` documenting allowed transitions (`idle → scanning → completed | canceled | error`, `completed/canceled/error → scanning`, `(any) → idle` via `resetAtlas`).

### E3 — Atlas state model
Maps to PRD FR-4 (session-scoped cache) + ADR-0010.
- **F-E3.1 Module singleton** — `core/atlas-store.ts` exporting `subscribeAtlas`, `getAtlasSnapshot`, `setAtlasState`, `resetAtlas`. (ADR-0010.)
- **F-E3.2 Selector hooks** — `useAtlasSlice<T>(selector)` based on `useSyncExternalStore` (referentially-stable pattern from `setup/scaffold.md` § Scaffold 2 step 5).
- **F-E3.3 Strict-mode guard** — module-level boolean to prevent double-start under React 18 strict mode (ADR-0010).
- **F-E3.4 Test reset** — `__resetForTest()` gated on `NODE_ENV === 'test'`.
- **F-E3.5 Freeze utility** — `core/atlas-freeze.ts` to wrap `Map` instances as `ReadonlyMap` and `Object.freeze` the atlas root.

### E4 — Widget surface
Maps to PRD US-1, FR-2.
- **F-E4.1 `WidgetSurface`** — `components/surfaces/widget-surface.tsx`. Triggers scan on first mount when atlas `idle`.
- **F-E4.2 `<SearchInput />`** wrapper using `@blok/search-input`. Disabled while scanning (per W1).
- **F-E4.3 Widget data table** — `@blok/table` + `@blok/scroll-area`, sortable, keyboard-navigable rows. Columns: Rendering / Total / Pages / Mini-bar / Datasources (+ Last seen at ≥1024 px).
- **F-E4.4 Mini-bar cell** — CSS-only horizontal bar `pages / max(pages)`. `aria-hidden="true"`.
- **F-E4.5 `<RenderingNameCell />`** — display name + `· <last-7-of-id>` collision suffix + tooltip with full ID. (FR-9, ADR-0005.)
- **F-E4.6 `<KpiRail />`** — sticky-bottom 3–4 KPI cells (TOTAL RENDERINGS / TOTAL DATASOURCES / PAGES SCANNED / SKIPPED). `text-2xl font-semibold tabular-nums`.
- **F-E4.7 Density toggle** — `@blok/toggle-group` if installed, else native `<button role="radio">` group fallback (per v2 § 4.5).
- **F-E4.8 Refresh atlas action** — primary `@blok/button` in the freshness ribbon; calls `runScan({ scope })` keeping previous result visible.
- **F-E4.9 Scope picker** — `@blok/select` with disabled / hidden states per AC-3.4 / AC-3.5 / AC-3.6.
- **F-E4.10 `<FreshnessRibbon />`** — `@blok/alert` + ghost re-scan button; `Stale?` text at ≥15 min.

### E5 — Panel surface
Maps to PRD US-2, FR-3.
- **F-E5.1 `PanelSurface`** — `components/surfaces/panel-surface.tsx`. Issues per-page `pagesGetComponentsOnPage` **before** global scan (OQ-A5 / FR-3.3). Triggers global scan on first mount when atlas `idle`.
- **F-E5.2 `<CounterRow />`** — big mono-tabular count + label + primary text + chevron. States: `loading`, `default`, `zero`, `missing`, `focused`, `hovered` (per v2 § 4.2).
- **F-E5.3 Active page rendering stack** — paint immediately from per-page fetch; counter slot shows skeleton until global scan resolves (AC-2.2).
- **F-E5.4 Datasource impact group** — same `<CounterRow />` pattern. Missing datasource (`isMissing`) renders a `⚠` glyph with `missing` + `referenced by N pages` (AC-2.5).
- **F-E5.5 `pages.context` subscribe** — re-paint Zone 3 on page change; do **not** abort the global scan (D10, AR-5).
- **F-E5.6 Narrow-viewport adjustments** — scope picker behind `@blok/dropdown-menu` kebab at <420 px; status bar wraps to two lines (per v2 § 5.1 (xs)).

### E6 — Loading visual + drawer
Maps to PRD FR-5, US-1 AC-1.5/1.6, US-2 AC-2.3/2.4, AC-4.x.
- **F-E6.1 `<ScanStatusBar />`** — segmented Sites/Pages/Components progress strip with active-phase pulse, numerical readout, cancel button. CSS-only animations; `prefers-reduced-motion` respected. Implements `LoadingVisualizerProps` from ADR-0011.
- **F-E6.2 Cancel flow** — calls scan-level `AbortController.abort()`; partial atlas presented; `aria-live` announces "Cancellation requested." (FR-5.2.)
- **F-E6.3 Slow-connection hint** — at >5s with no progress, surface `Slow connection — retrying` plus `Try again` (AC-4.4).
- **F-E6.4 `<UsageDrawer />`** — `@blok/sheet`, two stacked sections separated by `@blok/separator`: "Direct rendering usage" + "Via datasource". Page rows click-through via `pages.context` mutate (FR-6.1). Footer with `@blok/kbd` Esc hint.
- **F-E6.5 Skipped-pages sub-drawer** — opened from KPI SKIPPED cell or Zone 2 link; lists `Skipped` entries with reasons (`forbidden` chip in destructive color, etc.). (FR-7.2.)
- **F-E6.6 Empty / error states** — `@blok/empty-states` + `@blok/error-states` for W4, W5, P5 per v2.

### E7 — Telemetry + observability
Maps to PRD NFR-6, ADR-0013.
- **F-E7.1 `core/telemetry.ts`** — `track`, `getBuffer`, `clearBuffer`, ring buffer max 500, `console.info("[CUA]", event)`.
- **F-E7.2 Event emission sites** — every state transition, scan timing (S2/S3), page-skipped (with reason), pulse responses, `surface_mounted`.
- **F-E7.3 No-PII linter / hand-audit** — verify event shapes contain only IDs and counts; never display names, paths, editor, tenant identifiers.
- **F-E7.4 `<DebugPanel />`** — gated by `?debug=1`; renders buffer + Copy-to-clipboard.
- **F-E7.5 Anti-metric guard** — npm script or `/ship` checklist step that greps for forbidden strings.

### E8 — Edge handling
- **F-E8.1 Display-name collision** — disambiguation suffix at render time (FR-9; index keys by ID — ADR-0005).
- **F-E8.2 `(unknown rendering)` group** — synthetic IDs preserved in `renderingIndex`; widget table renders one virtual row + per-page expansion in drawer (AR-9).
- **F-E8.3 `Direct bindings only` affordance** — `@blok/badge` + `@blok/tooltip`/`@blok/popover` always visible on both surfaces (FR-8.3, ADR-0006). Copy locked to ADR-0006 § Decision text.
- **F-E8.4 Missing-datasource warning** — `⚠` glyph + `missing` text reinforce color (NFR-4.3, AC-2.5).
- **F-E8.5 Permission-denied page handling** — pages classified `'forbidden'` go to `skipped[]`; never silently 0-counted; click-through prevented at UI layer.
- **F-E8.6 No tenant context** — `<ErrorStates>` with PRD § 11.3 copy; no retry button (OQ-A6).

### E9 — Build / CI / release
- **F-E9.1 npm scripts** — `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch` (per scaffold + test-stack additions).
- **F-E9.2 Type-check + lint + test + build** all green before any merge.
- **F-E9.3 Vercel project** — root at `products/component-usage-atlas/site`.
- **F-E9.4 Cloud Portal registration** — paste `/widget` and `/panel`; request `xmc.agent.read` + `xmc.sites.read` scopes.
- **F-E9.5 README** — `products/component-usage-atlas/README.md` calls out smoke-test rule (`/widget` or `/panel`, never `/`) per ADR-0014.
- **F-E9.6 CATALOG row** — record SDK versions (`@sitecore-marketplace-sdk/client`, `@sitecore-marketplace-sdk/xmc`), Blok components installed, Run number per `marketplace-sdk/CATALOG.md`.

---

## 4. Task Breakdown

Tasks are atomic units. Test tasks default to test-after ordering; the QA Specialist will reorder to test-first where TDD applies. Task IDs are **stable** (T001+) — the QA Specialist may use suffixes (T012a, T012b) to split.

**Visual reference for any UI task:** open `products/component-usage-atlas/pocs/poc-v2/index.html`, `styles.css`, `app.js`. When v2 spec text and clickdummy diverge on visual details, the clickdummy wins.

### Epic E1 — Marketplace scaffold + lifecycle wiring

- **Task ID:** T001
  - **Title:** Scaffold the Marketplace Client-Side app under `site/`
  - **Description:** From `products/component-usage-atlas/`, run the Scaffold 2 non-interactive command exactly as documented in `setup/scaffold.md` § Scaffold 2: `yes '' | npx --yes shadcn@latest add https://blok.sitecore.com/r/marketplace/next/quickstart-with-client-side-xmc.json --yes --cwd C:\Projects\agentic\agentic.hahn-solo\products\component-usage-atlas\site`. Accept defaults: Next.js / `next-app` / Radix / Nova preset. After the command completes, **flatten** the nested `next-app/` subdir per `setup/scaffold.md` § Scaffold 2 (P-043) so `site/package.json` is the top-level Next.js root. Verify: `site/package.json` exists; `site/next-app` does NOT exist.
  - **Expected Output:** `products/component-usage-atlas/site/` is a working Next.js 16 + Radix + Nova preset Marketplace app with `MarketplaceProvider` wired in `components/providers/marketplace.tsx`, `app/layout.tsx` wrapping it, `app/page.tsx` rendering example components. `npm install` already run. Top-level Next.js root is `site/` (no `next-app/` nesting).
  - **Depends on:** none

- **Task ID:** T002
  - **Title:** Apply quickstart lint fixes (P-019)
  - **Description:** In `site/components/providers/marketplace.tsx`, fix the two scaffold typos that fail `npm run lint` out of the box: (a) typo `extention` → `extension`; (b) unescaped apostrophe `your app's` → `your app&apos;s` (or switch the surrounding string to double-quoted). Confirm by running `npm run lint` after — must exit 0.
  - **Expected Output:** `npm run lint` from `site/` exits 0 on a clean scaffold (no other code changes yet).
  - **Depends on:** T001

- **Task ID:** T003
  - **Title:** Install test stack + tsconfig types patch
  - **Description:** From `site/`, run `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react`. Create `vitest.config.ts` and `vitest.setup.ts` exactly per `setup/scaffold.md` § Scaffold 2 step 5. Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json` `scripts`. Add `"types": ["vitest/globals", "@testing-library/jest-dom"]` to `tsconfig.json` `compilerOptions` (this is mandatory — `tsc --noEmit` fails on test files without it).
  - **Expected Output:** `npm run test` exits 0 (zero tests is acceptable); `npm run typecheck` exits 0; the four test-related dev deps are in `package.json`.
  - **Depends on:** T001

- **Task ID:** T004
  - **Title:** Add Chrome Local Network Access headers to `next.config.mjs`
  - **Description:** Edit `site/next.config.mjs` and add the four PNA + CORS headers exactly as in `setup/scaffold.md` § Scaffold 2 step 8 (`Access-Control-Allow-Private-Network: true`, `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`, `Access-Control-Allow-Headers: Content-Type, Authorization, Access-Control-Request-Private-Network`). **Do NOT** add `Access-Control-Allow-Credentials: true` alongside `Origin: *` — spec violation; browsers reject. HTTPS not required for Mode A.
  - **Expected Output:** `next.config.mjs` ships the four headers; `npm run build` still succeeds.
  - **Depends on:** T001

- **Task ID:** T005
  - **Title:** Pin SDK versions; verify `pagesGetComponentsOnPage` shape (OQ-A1)
  - **Description:** Run `npm install @sitecore-marketplace-sdk/client@latest @sitecore-marketplace-sdk/xmc@latest` from `site/`. Inspect `node_modules/@sitecore-marketplace-sdk/xmc/dist/*.d.ts` (or equivalent) for the `Xmapp.GetComponentsOnPageResponse` type (or whatever the package names it). Verify field names: `renderingId`, `renderingName`, `placeholderKey`, `datasource.itemId`, `datasource.displayName`, `datasource.path`, `parameters`. If any name differs, **update the `ComponentRecord` interface in `lib/sdk/types.ts` (see T013) accordingly** — and note the difference in the friction log. Also verify `sitesGetAllPagesBySite` pagination shape (OQ-A2): is the response a flat array or paginated? Pin exact versions in `package.json` (no `^` ranges). Record both versions in `.agent/skills/sitecore/marketplace-sdk/CATALOG.md` per the catalog rule.
  - **Expected Output:** Exact SDK versions in `package.json`; CATALOG row added; OQ-A1 + OQ-A2 results recorded in friction log; `lib/sdk/types.ts` aligned with verified shapes.
  - **Depends on:** T001, T013

- **Task ID:** T006
  - **Title:** Install Blok theme via shadcn registry
  - **Description:** From `site/`, run `npx shadcn@latest add https://blok.sitecore.com/r/theme.json` per ADR-0009 / `setup/scaffold.md`. Inspect the resulting CSS for a mono variant custom property (e.g. `--font-mono`) and for the `success` / `warning` semantic colors (resolves OQ-V2-1 + OQ-V2-2 from v2 § 6). Update `tailwind.config.ts` to register the mono family (system mono fallback per v2 § 4.6 if Blok ships none). Do NOT edit the generated `:root { --blok-* }` block by hand.
  - **Expected Output:** Blok semantic tokens available via Tailwind utilities (`bg-background`, `text-foreground`, `bg-muted`, `bg-primary`, `text-primary-foreground`, etc.). Mono font registered as `font-mono`. Resolution of OQ-V2-1 / OQ-V2-2 recorded in friction log.
  - **Depends on:** T001

- **Task ID:** T007
  - **Title:** Install required Blok components
  - **Description:** From `site/`, install components needed by v2 (per ui-design-v2 § 4.1): `npx shadcn@latest add @blok/table @blok/search-input @blok/sheet @blok/select @blok/tooltip @blok/popover @blok/toggle-group @blok/dropdown-menu @blok/scroll-area @blok/empty-states @blok/error-states @blok/kbd @blok/icon`. (Pre-installed: `alert`, `badge`, `button`, `card`, `collapsible`, `separator`, `skeleton` — do not re-install.) If `@blok/toggle-group` install fails (per `components.md` "not in quickstart"), document the failure in the friction log; the density-toggle fallback (T065) will activate.
  - **Expected Output:** All listed components added to `site/components/ui/` (or wherever shadcn lands them per Blok preset). Build + typecheck both green.
  - **Depends on:** T006

- **Task ID:** T008
  - **Title:** Create root route → `notFound()` (ADR-0014)
  - **Description:** Replace `site/app/page.tsx` with a `notFound()` server-action. Exact content:
    ```tsx
    import { notFound } from 'next/navigation';
    export default function RootPage() {
      notFound();
    }
    ```
    Add a comment above the function: `// ADR-0014 — root is unreachable; smoke-test on /widget or /panel`. Do NOT remove the root `<MarketplaceProvider>` from `app/layout.tsx` — provider stays (per ADR-0014).
  - **Expected Output:** `http://localhost:3000/` returns Next.js 404; `app/layout.tsx` still wraps `<MarketplaceProvider>`.
  - **Depends on:** T002

- **Task ID:** T009
  - **Title:** Scaffold widget route entry `app/widget/page.tsx`
  - **Description:** Create `site/app/widget/page.tsx` as a `'use client'` page that renders `<WidgetSurface />` (placeholder import to be filled by T040). Use the "Full hooks" template from `client.md` § 3a — call `useMarketplaceClient()` and `useAppContext()` to obtain the SDK client and context. For now the page renders a placeholder `<div>Widget surface — pending implementation</div>` so the route resolves; surface implementation comes in E4.
  - **Expected Output:** `http://localhost:3000/widget` returns the placeholder (provider resolves only inside the portal iframe — for local dev outside the portal you'll see the provider's loader; that's expected). `npm run build` succeeds.
  - **Depends on:** T002

- **Task ID:** T010
  - **Title:** Scaffold panel route entry `app/panel/page.tsx`
  - **Description:** Same shape as T009 but at `site/app/panel/page.tsx`. Renders placeholder `<div>Panel surface — pending implementation</div>`. Imports `<PanelSurface />` (filled by T050).
  - **Expected Output:** `http://localhost:3000/panel` returns the placeholder; `npm run build` succeeds.
  - **Depends on:** T002

- **Task ID:** T011
  - **Title:** Document local smoke-test rule in product README
  - **Description:** Create or update `products/component-usage-atlas/README.md` with: (a) one-paragraph overview ("Tenant-wide live atlas; widget + panel surfaces"); (b) **Local smoke-test rule** — always hit `http://localhost:3000/widget` or `/panel` directly; never `/` (it's `notFound()` per ADR-0014). (c) Cloud Portal route URLs to paste: `/widget`, `/panel`. (d) Required API scopes: `xmc.agent.read`, `xmc.sites.read`. (Per architecture § 6.2.) Keep README short — full docs come from `/document` later.
  - **Expected Output:** README at `products/component-usage-atlas/README.md` calls out the smoke-test rule, both route URLs, and the required API scopes.
  - **Depends on:** T008, T009, T010

### Epic E2 — Scan engine

- **Task ID:** T012
  - **Title:** Create `lib/sdk/client.ts` (re-export scaffold's hooks)
  - **Description:** Create `site/lib/sdk/client.ts` that re-exports `useMarketplaceClient`, `useAppContext`, and `MarketplaceProvider` from `components/providers/marketplace.tsx`. **Do not** patch the provider — only re-export. This module is the import surface for everything else in `lib/sdk/` and `core/`.
  - **Expected Output:** A file with three named re-exports, no behavioral change.
  - **Depends on:** T002

- **Task ID:** T013
  - **Title:** Define domain types in `lib/sdk/types.ts`
  - **Description:** Create `site/lib/sdk/types.ts` exporting: `RenderingId`, `DatasourceId`, `PageId`, `SiteId`, `CollectionId` (all `string`); `PageRef`, `RenderingUsage`, `DatasourceUsage`, `Skipped`, `Atlas`, `AtlasScope`, `ScanProgress`, `AtlasState`, `AtlasErrorReason`, `ComponentRecord`, `Site`, `SiteSummary`, `SiteDetails`, `Collection`, `PageStub`. Use exact shapes from architecture § 4.1, § 4.2, § 4.4. Mark `renderingIndex` / `datasourceIndex` as `ReadonlyMap<…>`. `Atlas.skipped` is `ReadonlyArray<Skipped>`. **No `any`.**
  - **Expected Output:** `lib/sdk/types.ts` with all listed type exports; `npm run typecheck` passes.
  - **Depends on:** T002

- **Task ID:** T014
  - **Title:** Implement `core/context-resolver.ts` (`requireContextId`)
  - **Description:** Create `site/core/context-resolver.ts` exporting `requireContextId(ctx: ApplicationContext | null): string`. Logic per architecture § 5.1 + `client.md` § 4: prefer `ctx.resourceAccess[0].context.live`, fall back to `.preview`. If neither, throw a typed `AtlasNoContextError extends Error`. Also export the error class. **No `as string` / `as never` / `as any`.**
  - **Expected Output:** Pure function; throws `AtlasNoContextError` on absence; returns `string` on success.
  - **Depends on:** T013

- **Task ID:** T015
  - **Title:** Implement `lib/sdk/queries.ts` — five typed wrappers
  - **Description:** Create `site/lib/sdk/queries.ts` exporting five async wrappers that take `(client: ClientSDK, contextId: string, …)` (contextId is **already-narrowed** — never `string | undefined`):
    - `querySitesList(client, contextId): Promise<readonly SiteSummary[]>` — calls `client.query('xmc.agent.sitesGetSitesList', { params: { query: { sitecoreContextId: contextId } } })`; returns `result.data?.data ?? []`.
    - `queryListCollections(client, contextId): Promise<readonly Collection[]>` — calls `'xmc.sites.listCollections'`; same shape.
    - `queryRetrieveSite(client, contextId, siteId): Promise<SiteDetails>` — calls `'xmc.sites.retrieveSite'` with `params: { path: { siteId }, query: { sitecoreContextId: contextId } }`; throws if `result.data?.data` is empty.
    - `queryAllPagesBySite(client, contextId, siteName, language, signal): Promise<readonly PageStub[]>` — calls `'xmc.agent.sitesGetAllPagesBySite'` with `params: { path: { siteName }, query: { language, sitecoreContextId: contextId } }`; throws `DOMException('aborted', 'AbortError')` if `signal.aborted` after resolution. **Note:** path keys by `siteName`, not `siteId` (per architecture § 5.5).
    - `queryComponentsOnPage(client, contextId, pageId, language, signal): Promise<readonly ComponentRecord[]>` — calls `'xmc.agent.pagesGetComponentsOnPage'` with `params: { path: { pageId }, query: { language, sitecoreContextId: contextId } }`; same abort check.
    All five **double-unwrap** via `result.data?.data` (per `client.md` § 8b).
  - **Expected Output:** Module with five typed wrappers; tsc green; no `any`/`never` casts at call sites.
  - **Depends on:** T012, T013, T014

- **Task ID:** T016
  - **Title:** Implement `core/abort-bus.ts`
  - **Description:** Create `site/core/abort-bus.ts` exporting `createAbortBus(): { signal: AbortSignal; abort: () => void; aborted: () => boolean }`. Wraps `AbortController` with a disposed-flag so duplicate `abort()` calls are no-ops. Used by the scan engine to share one signal across sites/pages/components steps.
  - **Expected Output:** Pure utility; idempotent abort.
  - **Depends on:** T013

- **Task ID:** T017
  - **Title:** Implement `core/concurrency-pool.ts` (`runWithConcurrency`)
  - **Description:** Create `site/core/concurrency-pool.ts` exporting `runWithConcurrency<T>(jobs: Array<() => Promise<T>>, cap: number, signal: AbortSignal): Promise<PromiseSettledResult<T>[]>`. Worker-pool pattern: at most `cap` jobs in-flight; preserves output order matching input order; honors `AbortSignal` (any subsequent jobs not yet started are not started; in-flight jobs are NOT aborted by this helper — they should respond to the same signal via their own AbortController-aware logic). Returns `Promise.allSettled`-shaped results.
  - **Expected Output:** Generic helper; no SDK coupling; deterministic output ordering.
  - **Depends on:** T013, T016

- **Task ID:** T018
  - **Title:** Implement `core/error-classifier.ts`
  - **Description:** Create `site/core/error-classifier.ts` exporting `classifyError(err: unknown): SkipReason` mapping to `'forbidden' | 'timeout' | 'not_found' | 'network_error' | 'other'`. Recognize at minimum: 403 → `'forbidden'`, 404 → `'not_found'`, `DOMException name='AbortError'` if NOT a user cancel → `'timeout'`, network/fetch errors → `'network_error'`, else `'other'`. Handle the SDK error envelope shape from `client.md` § 8f when surfaced. **The 429 / rate-limit path is handled at the call-site retry layer** (T019); only after `maxRetries` is exhausted does the page get classified — and the classification at that point is `'network_error'` per ADR-0012.
  - **Expected Output:** Pure function; deterministic classification; `'other'` is the catch-all.
  - **Depends on:** T013

- **Task ID:** T019
  - **Title:** Implement `core/scan-config.ts` and rate-limit retry helper
  - **Description:** Create `site/core/scan-config.ts` exporting:
    ```ts
    export const SCAN_CONCURRENCY = 8;
    export const PER_PAGE_TIMEOUT_MS = 12_000;
    export const RATE_LIMIT_BACKOFF = { baseMs: 250, maxRetries: 4, jitterPercent: 20 } as const;
    ```
    Also implement `withBackoff<T>(fn: () => Promise<T>, isRateLimit: (err: unknown) => boolean, signal: AbortSignal): Promise<T>` that retries `fn` with exponential backoff + jitter on rate-limit errors, up to `maxRetries`. After exhaustion, throws the last error. Logs each retry via `core/telemetry.ts` (T072). (ADR-0012.)
  - **Expected Output:** Constants module + retry helper with deterministic backoff math.
  - **Depends on:** T013, T016, T018, T072

- **Task ID:** T020
  - **Title:** Implement `core/sites-enumerator.ts`
  - **Description:** Create `site/core/sites-enumerator.ts` exporting `enumerateSites(client: ClientSDK, contextId: string, scope: AtlasScope): Promise<readonly Site[]>`. Calls `querySitesList`. If `scope.kind === 'collection'`, also calls `queryListCollections` and filters sites whose `collectionId` matches. Returns `Site[]` with `siteName` retained (needed by `queryAllPagesBySite`).
  - **Expected Output:** Pure async function; returns filtered site list.
  - **Depends on:** T015

- **Task ID:** T021
  - **Title:** Implement `core/site-language-resolver.ts`
  - **Description:** Create `site/core/site-language-resolver.ts` exporting `resolveSiteLanguage(client, contextId, site): Promise<string>` per architecture § 5.4 / IS-13 / FR-1.3. Calls `queryRetrieveSite` once per site, reads default language. Falls back to tenant default when site doesn't declare one (architect TBD value at first run — for v1, hardcode `'en'` as final fallback and surface in friction log if used). Per-site cache `Map<SiteId, string>` cleared on scan completion.
  - **Expected Output:** Async function with per-site cache; honors fallback chain.
  - **Depends on:** T015

- **Task ID:** T022
  - **Title:** Implement `core/pages-enumerator.ts`
  - **Description:** Create `site/core/pages-enumerator.ts` exporting `enumeratePages(client, contextId, site, language, signal): Promise<readonly PageStub[]>`. Calls `queryAllPagesBySite`. Flattens response to `PageStub[]` with `{ pageId, pageName, sitePath, siteId, siteName, language, collectionId? }`. Honors `signal`. **OQ-A2 verification:** if T005 found pagination, implement page-by-page following here; otherwise trust the simple list and document the assumption.
  - **Expected Output:** Returns `PageStub[]` for one site; cancels on abort.
  - **Depends on:** T015

- **Task ID:** T023
  - **Title:** Implement `core/components-fetcher.ts`
  - **Description:** Create `site/core/components-fetcher.ts` exporting `fetchComponents(client, contextId, page, signal): Promise<readonly ComponentRecord[]>`. Wraps `queryComponentsOnPage` with `withBackoff` (T019) and a per-page timeout (`Promise.race` with `PER_PAGE_TIMEOUT_MS`). Throws/rejects so `Promise.allSettled` in the pool can classify failures.
  - **Expected Output:** Async function; honors timeout + backoff + abort.
  - **Depends on:** T015, T019

- **Task ID:** T024
  - **Title:** Implement `core/index-builder.ts` (pure function)
  - **Description:** Create `site/core/index-builder.ts` exporting `buildIndices(pageRefs: ReadonlyArray<PageRef>, componentResults: ReadonlyArray<PromiseSettledResult<readonly ComponentRecord[]>>): { renderingIndex: Map<RenderingId, RenderingUsage>; datasourceIndex: Map<DatasourceId, DatasourceUsage>; skipped: Skipped[]; totals: Atlas['totals'] }`. Algorithm per architecture § 4.3 (deterministic single-pass; pageRefs and componentResults indexed in matching order). Synthetic IDs for unknown renderings: `unknown:<page-id>:<placeholder>:<index>` and `isUnknown: true` (ADR-0005). Direct datasources only — inherited / personalized / token-resolved bindings ignored (ADR-0006). **Pure function — no SDK imports, no React, no side effects.**
  - **Expected Output:** Pure function returning the four-field result; unit-testable in isolation.
  - **Depends on:** T013, T018

- **Task ID:** T025
  - **Title:** Implement `core/scan-state-machine.ts`
  - **Description:** Create `site/core/scan-state-machine.ts` documenting the allowed state transitions (per architecture § 4.1):
    ```
    idle → scanning
    scanning → completed | canceled | error
    completed | canceled | error → scanning
    (any) → idle (only via resetAtlas)
    ```
    Export `transitionTo(prev: AtlasState, next: AtlasState): AtlasState` that throws on disallowed transitions; export an `ALLOWED_TRANSITIONS` table for tests.
  - **Expected Output:** State-machine helper + transition table; tests can assert the disallowed paths.
  - **Depends on:** T013

- **Task ID:** T026
  - **Title:** Implement `core/atlas-freeze.ts`
  - **Description:** Create `site/core/atlas-freeze.ts` exporting `freezeAtlas(atlas: Atlas): Atlas`. Wraps the two `Map`s as `ReadonlyMap` (`Object.freeze` after construction — Maps freeze imperfectly, so the wrapper is a thin facade that throws on mutation in dev). `Object.freeze(atlas)` at root.
  - **Expected Output:** Helper; UI selectors must not mutate.
  - **Depends on:** T013

- **Task ID:** T027
  - **Title:** Implement `core/scan-engine.ts::runScan`
  - **Description:** Create `site/core/scan-engine.ts` exporting `runScan(input: ScanInput): ScanHandle` where `ScanInput = { client: ClientSDK; contextId: string; scope: AtlasScope }` and `ScanHandle = { cancel: () => void; donePromise: Promise<void> }`. Steps:
    1. Set state to `scanning` (phase `'sites'`).
    2. `enumerateSites(client, contextId, scope)`.
    3. Phase `'sites'` complete; resolve site languages via `resolveSiteLanguage` (concurrency-pool, cap 8).
    4. Phase `'pages'`. For each site, `enumeratePages(client, contextId, site, language, signal)`. Flatten to `pageRefs[]`.
    5. Phase `'components'`. `runWithConcurrency(jobs = pageRefs.map(p => () => fetchComponents(client, contextId, p, signal)), cap = 8, signal)`.
    6. `buildIndices(pageRefs, results)`.
    7. `freezeAtlas(...)`. Set state to `completed` (or `canceled` if `signal.aborted` — partial atlas with `isPartial: true`).
    Use one shared `AbortBus` (T016) for the whole scan. On error in step 2 (sites fetch failed), set state to `error` with `{ kind: 'sites-fetch-failed', cause }`. Per-page failures are normal (`Promise.allSettled`) and end up in `skipped[]`. Emit telemetry events (T072) at every transition + start + complete + cancel + error.
  - **Expected Output:** `runScan` returns a `ScanHandle`; calling `cancel()` aborts; `donePromise` resolves once state is `completed | canceled | error`.
  - **Depends on:** T013, T014, T015, T016, T017, T020, T021, T022, T023, T024, T025, T026, T072

### Epic E3 — Atlas state model

- **Task ID:** T030
  - **Title:** Implement `core/atlas-store.ts` module singleton
  - **Description:** Create `site/core/atlas-store.ts` per architecture § 7.2 / ADR-0010. Module-scoped `let state: AtlasState = { kind: 'idle' }`. Exports: `subscribeAtlas(listener: () => void): () => void` (Set-based), `getAtlasSnapshot(): AtlasState` (returns referentially-stable state), `setAtlasState(next: AtlasState): void` (no-op when `next === state`; otherwise updates and notifies all listeners), `resetAtlas(): void` (sets to `{ kind: 'idle' }`). Add a strict-mode guard (`let scanInFlight = false`) used by `runScan` to ignore double-starts during React 18 strict-mode double-mount. **Do NOT** put state on `window`.
  - **Expected Output:** Module-singleton with the four exports; unit-testable; survives strict-mode double-mount.
  - **Depends on:** T013

- **Task ID:** T031
  - **Title:** Implement `core/use-atlas-slice.ts` selector hook
  - **Description:** Create `site/core/use-atlas-slice.ts` exporting `useAtlasSlice<T>(selector: (s: AtlasState) => T): T`. Uses `useSyncExternalStore(subscribeAtlas, () => selector(getAtlasSnapshot()), () => selector(getAtlasSnapshot()))`. **Critical caveat:** `getSnapshot` must return referentially-stable values when the underlying state hasn't changed — otherwise React enters an infinite loop ("Maximum update depth exceeded"). Per `setup/scaffold.md` § Scaffold 2 step 5: cache derived values at module scope when the selector returns a fresh object each call, OR rely on the selector being a pure projection of immutable state (which our atlas is, since it's frozen). The third arg `getServerSnapshot` is the same as `getSnapshot` — required by React API; never SSR.
  - **Expected Output:** Generic hook; components subscribe to slices; React's bail-out skips re-render when shallow-equal.
  - **Depends on:** T030

- **Task ID:** T032
  - **Title:** Add `__resetForTest()` test helper
  - **Description:** In `core/atlas-store.ts`, add `export function __resetForTest(): void` gated by `if (process.env.NODE_ENV !== 'test') throw new Error('__resetForTest may only be called in tests')`. Tests that import the singleton across multiple `describe` blocks call this in `beforeEach` to reset state and the strict-mode guard.
  - **Expected Output:** Test-only reset; throws in non-test contexts.
  - **Depends on:** T030

- **Task ID:** T033
  - **Title:** Wire scan triggers into atlas-store actions
  - **Description:** Add `core/atlas-actions.ts` exporting `startScan(client, contextId, scope)`, `cancelScan()`, `refreshAtlas(client, contextId)`, `setScope(client, contextId, newScope)`. Each action:
    - `startScan`: if `state.kind === 'scanning'`, no-op (strict-mode guard). Else call `runScan(...)`; store the `ScanHandle` in module-scoped `currentHandle`.
    - `cancelScan`: `currentHandle?.cancel()`.
    - `refreshAtlas` / `setScope`: keep prior atlas visible until new scan completes — per FR-2.5 / AC-3.2 — by NOT calling `resetAtlas` between cancel and start; instead, the new `runScan` overwrites state on completion.
  - **Expected Output:** Action surface that surfaces consume; encapsulates the scan-handle lifecycle.
  - **Depends on:** T027, T030

### Epic E4 — Widget surface

- **Task ID:** T040
  - **Title:** Implement `<WidgetSurface />`
  - **Description:** Create `site/components/surfaces/widget-surface.tsx` (`'use client'`). On first mount with `atlas.kind === 'idle'`, call `startScan(client, contextId, { kind: 'all-collections' })`. Subscribes to atlas via `useAtlasSlice`. Renders 4-zone anatomy from v2 § 2: Zone 1 status bar / freshness ribbon, Zone 2 disclosure strip ("ⓘ Direct bindings only" + skipped link), Zone 3 search-first table (`<WidgetTable />`), Zone 4 KPI rail (`<KpiRail />`). Wraps surface in a React error boundary (per architecture § 7).
  - **Expected Output:** Widget surface renders the 4 zones; behaves per v2 W1/W2/W4/W5 states.
  - **Depends on:** T031, T033, T041, T042, T043, T046, T060, T061

- **Task ID:** T041
  - **Title:** Implement `<WidgetTable />`
  - **Description:** Create `site/components/widget/widget-table.tsx`. Wraps `@blok/table` in `@blok/scroll-area`. Columns per v2 § 3: Rendering (`<RenderingNameCell />`), Total (mono tabular, default sort desc), Pages (distinct), Mini-bar (CSS-only `pages / max(pages)`, `aria-hidden="true"`), Datasources, Last seen (≥1024 px only). Rows are `cursor-pointer`; full-row click opens drawer. Keyboard: arrow keys move focus row, Enter opens drawer, Esc closes (per AC NFR-4.1). Row chrome `bg-card`, hover `bg-muted/50`, focus ring via `ring-ring`. Display-name disambiguation memoized per visible result set (AR-3).
  - **Expected Output:** Table renders sorted, filterable rows; collisions show suffix; keyboard nav works.
  - **Depends on:** T013, T031, T044, T045, T060

- **Task ID:** T042
  - **Title:** Implement `<SearchInput />` + filter logic
  - **Description:** Create `site/components/widget/search-input.tsx` wrapping `@blok/search-input`. Disabled while scanning (helper text "Search will activate when scan completes."). Filters table rows client-side (no re-fetch). Debounce: 80 ms.
  - **Expected Output:** Controlled input that filters by display name (case-insensitive substring); disabled state during `scanning`.
  - **Depends on:** T040

- **Task ID:** T043
  - **Title:** Implement `<KpiRail />`
  - **Description:** Create `site/components/widget/kpi-rail.tsx` per v2 § 4.2. Sticky-bottom `@blok/card` containing 3–4 `<KpiCell>` (TOTAL RENDERINGS, TOTAL DATASOURCES, PAGES SCANNED, SKIPPED). Cell: `text-xs uppercase tracking-wide text-muted-foreground` label above `text-2xl font-semibold tabular-nums` value. SKIPPED is `<button>` opening the skipped sub-drawer (T064). At 800–1024 px, SKIPPED collapses into a Zone 2 link (per v2 § 5.1).
  - **Expected Output:** KPI rail renders 3–4 cells; SKIPPED clickable; aria-labels on every cell (`aria-label="Total renderings: 124"` etc.).
  - **Depends on:** T031, T064

- **Task ID:** T044
  - **Title:** Implement `<RenderingNameCell />`
  - **Description:** Create `site/components/widget/rendering-name-cell.tsx`. Composes `@blok/badge` (for `· <last-7-of-id>` collision suffix) + `@blok/tooltip` (full ID on hover). Layout: display name + (when collision) badge + (small ID-copy `@blok/button variant="ghost" size="icon"` with copy icon). For unknown renderings, label is `(unknown rendering)` per ADR-0005.
  - **Expected Output:** Cell renders names cleanly; collision suffix appears only when needed; ID is copyable.
  - **Depends on:** T013

- **Task ID:** T045
  - **Title:** Implement collision-suffix utility (FR-9, ADR-0005)
  - **Description:** Create `site/lib/collisions.ts` exporting `computeCollisions(renderings: ReadonlyArray<RenderingUsage>): Map<RenderingId, { suffix: string | null }>`. For each rendering, check whether any other rendering in the visible set shares the same display name. If yes, set `suffix = '· ' + lastN(renderingId, 7)`. Pure function; memoizable.
  - **Expected Output:** Pure utility; unit-testable.
  - **Depends on:** T013

- **Task ID:** T046
  - **Title:** Implement `<FreshnessRibbon />` + Refresh atlas action
  - **Description:** Create `site/components/widget/freshness-ribbon.tsx`. Renders when state is `completed` / `canceled`. Composes `@blok/alert` (`variant="default"`, switches to `variant="warning"` semantic at ≥15 min stale per AC-5.2 — adds `Stale?` text in `text-warning`) + `@blok/button` ("Refresh atlas", primary). Shows "Last scanned HH:MM · whole tenant (3 collections, 8 sites, 312 pages)" per v2 W2. Re-scan button calls `refreshAtlas`. Replaced by `<ScanStatusBar />` during `scanning`.
  - **Expected Output:** Ribbon renders fresh / stale states; refresh action wired.
  - **Depends on:** T031, T033, T060

- **Task ID:** T047
  - **Title:** Implement `<ScopePicker />`
  - **Description:** Create `site/components/widget/scope-picker.tsx`. `@blok/select` listing "All collections" + one option per `Collection` (from `queryListCollections`). Calls `setScope(...)` on change. States per AC-3.4 / AC-3.5 / AC-3.6: one collection → disabled with helper text; zero collections → hidden; collections with zero sites → filtered out.
  - **Expected Output:** Scope picker renders correctly across the three tenant configurations.
  - **Depends on:** T031, T033

- **Task ID:** T048
  - **Title:** Implement density toggle (with fallback)
  - **Description:** Create `site/components/widget/density-toggle.tsx`. Primary path: `@blok/toggle-group` with options "Compact" / "Comfortable", default `compact`. Fallback (per v2 § 4.5): native `<button role="radio">` group if `@blok/toggle-group` failed to install (per T007 friction). Persists per-tab via in-memory state (no localStorage — ADR-0003).
  - **Expected Output:** Toggle renders both options; compact is default; selected state carried through to the table row height.
  - **Depends on:** T007

### Epic E5 — Panel surface

- **Task ID:** T050
  - **Title:** Implement `<PanelSurface />`
  - **Description:** Create `site/components/surfaces/panel-surface.tsx` (`'use client'`). On first mount: (a) issue per-page fetch (`queryComponentsOnPage`) immediately on a separate `AbortBus` (OQ-A5 — paint <1s even on a 5k-page tenant); (b) start global scan if atlas is `idle`. Subscribes to atlas + `pages.context` via `client.query('pages.context', { subscribe: true, onSuccess })` (per `client.md` § 6a). Renders 4-zone anatomy from v2 § 2 minus Zone 4 (no KPI rail on panel). On unmount, calls the subscription's `unsubscribe`. Wraps in a separate React error boundary from the widget (per architecture § 7).
  - **Expected Output:** Panel paints active-page rendering stack instantly; counters resolve as global scan completes; page-switch swaps Zone 3 only.
  - **Depends on:** T015, T031, T033, T051, T052, T060

- **Task ID:** T051
  - **Title:** Implement `<CounterRow />` + states
  - **Description:** Create `site/components/panel/counter-row.tsx`. States per v2 § 4.2: `loading`, `default`, `zero`, `missing`, `focused`, `hovered`. Counter typography:
    - `loading` → `@blok/skeleton`, 3ch wide.
    - `≥1` → `text-3xl font-bold tabular-nums text-primary`.
    - `0` → `text-3xl font-bold tabular-nums text-muted-foreground`; row `aria-disabled`.
    - `missing` → `<Icon name="alert-triangle" />` in `text-warning` + word `missing` in `text-xs uppercase tracking-wide text-warning`.
    Click opens drawer (when `count >= 1`). `aria-label="12 other pages use HeroV2"`.
  - **Expected Output:** Row component renders all states; states reinforce text where color is used (NFR-4.3).
  - **Depends on:** T013, T031

- **Task ID:** T052
  - **Title:** Active-page rendering stack + Datasource Impact group
  - **Description:** In `<PanelSurface />`, compose two `<CounterRow />` lists: (1) **Rendering stack** — one row per component on the active page (from per-page fetch). Counter shows skeleton until atlas resolves; resolves to "+N other pages" per `renderingIndex.get(renderingId).pages.length - 1`. (2) **Datasource impact** — one row per unique datasource bound on the active page; counter is "+N pages" via `datasourceIndex.get(dsId).pages.length`; missing datasources (per AC-2.5) show the warning glyph.
  - **Expected Output:** Two grouped lists with cross-tenant counters; missing datasources warned.
  - **Depends on:** T050, T051

- **Task ID:** T053
  - **Title:** Implement panel page-switch handler (D10, AR-5)
  - **Description:** In `<PanelSurface />`, the `pages.context` subscribe handler swaps the per-page view (Zone 3) **only** — Zones 1, 2, 4 (status bar, disclosure strip — KPI absent on panel) remain still. CSS-only 250 ms cross-fade on the rendering stack signals the swap. The global scan does NOT abort.
  - **Expected Output:** Page-switch re-paints Zone 3; status bar continues if scan running; cross-fade collapses to instant swap under `prefers-reduced-motion: reduce`.
  - **Depends on:** T050

- **Task ID:** T054
  - **Title:** Narrow-viewport adjustments for panel (<420 px)
  - **Description:** In `<PanelSurface />`, when iframe width <420 px: scope picker collapses behind `@blok/dropdown-menu` kebab; status bar wraps to 2 lines; counter typography drops one tier (`text-2xl` instead of `text-3xl`); drawer takes 90% width (per v2 § 5.1 (xs)).
  - **Expected Output:** Panel renders cleanly at 360 px width; verified at 360 / 420 / 800 px.
  - **Depends on:** T050

### Epic E6 — Loading visual + drawer

- **Task ID:** T060
  - **Title:** Implement `<ScanStatusBar />`
  - **Description:** Create `site/components/loading/scan-status-bar.tsx` per ADR-0011 / v2 § 4.2.
    ```ts
    type ScanStatusBarProps = {
      phase: 'sites' | 'pages' | 'components';
      progress: { current: number; total: number };
      elapsedMs: number;
      onCancel: () => void;
    };
    ```
    Markup: outer `<div role="status" aria-live="polite" aria-atomic="true">`. Three segmented `<div class="flex-1 h-1.5 rounded-full">`s; pending = `bg-muted`, active = `bg-primary` with CSS keyframe pulse 0.6→1.0 over 1.6s (collapsed to static fill under `prefers-reduced-motion`), completed = `bg-success` (or `bg-primary` fallback if Blok ships no `success`). Numerical readout: `<span class="font-mono tabular-nums text-sm text-muted-foreground">Pages 47 / 312 · 14s elapsed</span>`. Cancel button: `@blok/button variant="ghost" size="sm"` with `@blok/icon name="x"`; `aria-label="Cancel scan"`. CSS animation uses `transform`/`opacity` only (60fps target — DoD-6 / AR-8). Phase transitions announced via `aria-live` once per transition (not per-page).
  - **Expected Output:** Status bar renders all 6 states (`pending`, `scanning-sites`, `scanning-pages`, `scanning-components`, `completed`, `canceled`, `error`); cancel works; reduced-motion respected.
  - **Depends on:** T013, T031, T033

- **Task ID:** T061
  - **Title:** Wire status bar / freshness ribbon into Zone 1 swap
  - **Description:** In both surfaces, Zone 1 renders `<ScanStatusBar />` when state is `scanning`, otherwise renders `<FreshnessRibbon />` (or `<ErrorStates>` chip when `error`). Use `useAtlasSlice` to subscribe to `state.kind`.
  - **Expected Output:** Zone 1 swaps cleanly between states; never both visible at once.
  - **Depends on:** T031, T046, T060

- **Task ID:** T062
  - **Title:** Implement slow-connection hint (AC-4.4)
  - **Description:** Inside `<ScanStatusBar />`, track time since last progress update. If >5s without progress (`progress.current` unchanged), surface a small hint below the bar: "Slow connection — retrying" with a "Try again" affordance (calls `cancelScan` then `startScan` with the same scope). Backoff retries from T019 also surface here when active.
  - **Expected Output:** Hint appears when stalled; never shown during normal progress.
  - **Depends on:** T060

- **Task ID:** T063
  - **Title:** Implement `<UsageDrawer />`
  - **Description:** Create `site/components/drawer/usage-drawer.tsx`. `@blok/sheet` anchored right (widget) or side opposite host (panel — verify at first real-tenant smoke per OQ-V2-4). Two-section layout via `@blok/separator`: "Direct rendering usage" (page rows) + "Via datasource" (sub-cards per datasource → page rows). Header: rendering display name + `· <last-7-of-id>` suffix + ID-copy button. Page row click → `client.mutate('pages.context', { params: { itemId: pageRef.pageId } })` (FR-6.1). Footer: `@blok/button variant="ghost"` Close + `@blok/kbd Esc`. Body uses `@blok/scroll-area` for the page list. Focus trap inside drawer; Esc closes.
  - **Expected Output:** Drawer opens/closes; click-through navigates the host; focus is trapped while open.
  - **Depends on:** T012, T013, T031

- **Task ID:** T064
  - **Title:** Implement skipped-pages sub-drawer (FR-7.2)
  - **Description:** Create `site/components/drawer/skipped-drawer.tsx`. Opens from KPI SKIPPED cell or Zone 2 link. Lists `Skipped` entries grouped by reason (`forbidden`, `timeout`, `not_found`, `network_error`, `other`). `forbidden` chips render in `text-destructive` + word `forbidden`; `timeout` in `text-warning` + `timeout`; etc. Click on a page chip is disabled (we don't navigate to pages we couldn't read — esp. `forbidden`).
  - **Expected Output:** Sub-drawer renders all skip reasons clearly; reinforces color with text per NFR-4.3.
  - **Depends on:** T013, T031, T063

- **Task ID:** T065
  - **Title:** Implement `<EmptyStates>` and `<ErrorStates>` integrations
  - **Description:** For widget W4 (no shared usage), W5 (no context), and panel P5 (same), use `@blok/empty-states` + `@blok/error-states`. Copy from PRD § 11.3:
    - W5 / P5: "Atlas needs a tenant connection — please reload the dashboard." (No retry button per OQ-A6 / architecture § 10.1.)
    - W4: "Every component is unique to a page" — body "This tenant has no shared renderings. Datasources are still indexed below."
    - Empty tenant: "This tenant has no published pages yet."
    - Search zero matches: "No renderings match `<term>`. Try a partial name."
  - **Expected Output:** All four empty/error copy strings render in their states.
  - **Depends on:** T007

### Epic E7 — Telemetry + observability

- **Task ID:** T072
  - **Title:** Implement `core/telemetry.ts`
  - **Description:** Create `site/core/telemetry.ts` per ADR-0013. Exports `track(event: TelemetryEvent)`, `getBuffer(): TelemetryEvent[]`, `clearBuffer()`. Module-scoped ring buffer max 500. `track` also calls `console.info("[CUA]", event)`. `TelemetryEvent` shape: `{ timestamp_ms, kind: 'scan_started' | 'scan_completed' | 'scan_canceled' | 'scan_error' | 'page_skipped' | 'pulse_response' | 'surface_mounted' | 'phase_transition' | 'rate_limit_retry', surface: 'widget' | 'panel', /* event-specific fields */ }`. **No PII:** never include page paths beyond route prefix, datasource paths, editor names, tenant identifiers. Page IDs and rendering IDs are allowed.
  - **Expected Output:** Module with three exports; ring buffer; structured console marker.
  - **Depends on:** T013

- **Task ID:** T073
  - **Title:** Wire telemetry emission across the engine
  - **Description:** Add `track(...)` calls in: `runScan` start (`scan_started`), each phase transition (`phase_transition`), each cancel (`scan_canceled`), each error (`scan_error`), each rate-limit retry (`rate_limit_retry`), each page classified as skipped (`page_skipped` with reason — but ONLY the reason and a counter, never the pageId in production builds; allow pageId behind a `?debug=1` flag). Surface mount in `WidgetSurface` / `PanelSurface` (`surface_mounted`).
  - **Expected Output:** Every scan run emits a deterministic event sequence; verifiable in browser devtools.
  - **Depends on:** T027, T040, T050, T072

- **Task ID:** T074
  - **Title:** Implement `<DebugPanel />`
  - **Description:** Create `site/components/debug/debug-panel.tsx`. Gated by `?debug=1` query string on the iframe URL. Renders the current `getBuffer()` as a list + "Copy to clipboard" button (writes JSON). Editor pastes into the team's friction-log doc. Off in production unless re-enabled.
  - **Expected Output:** Debug panel appears only with `?debug=1`; copy works.
  - **Depends on:** T072

- **Task ID:** T075
  - **Title:** Anti-metric guard (DoD-4)
  - **Description:** Add an npm script `"check:antimetrics": "node scripts/check-antimetrics.mjs"` that greps the `src/`, `app/`, `components/`, `core/`, `lib/` trees for forbidden strings: `scans_per_minute`, `api_calls_served`, `session_count`. If found, exit non-zero with a clear message. Wire into the Team Lead's `/ship` checklist (E9 / T091).
  - **Expected Output:** Script exits 0 on green code; non-zero with instructive output if anti-metric strings are introduced.
  - **Depends on:** T072

### Epic E8 — Edge handling

- **Task ID:** T080
  - **Title:** "ⓘ Direct bindings only" affordance (FR-8.3, ADR-0006)
  - **Description:** Create `site/components/info/direct-bindings-info.tsx`. Always-visible `@blok/badge` (icon ⓘ + text "Direct bindings only") with `@blok/tooltip` (or `@blok/popover` on narrow panels) revealing the lock copy from ADR-0006: *"Counts include datasources bound directly on the page's layout. Inherited (page designs), personalized, A/B variant, and token-resolved bindings are not counted in this version."* Mounted in Zone 2 of both surfaces. **The copy is locked** — do not paraphrase.
  - **Expected Output:** Badge always visible on both surfaces; tooltip / popover renders the locked copy verbatim.
  - **Depends on:** T007

- **Task ID:** T081
  - **Title:** "(unknown rendering)" virtual row (AR-9)
  - **Description:** In `<WidgetTable />`, group all `RenderingUsage` entries with `isUnknown: true` under one virtual row labeled "(unknown rendering)". The drawer for this row expands to show per-page-with-placeholder breakdown (because each unknown placement was indexed under a synthetic ID `unknown:<page-id>:<placeholder>:<index>`).
  - **Expected Output:** Single virtual row in the table; drawer reveals per-page detail.
  - **Depends on:** T041, T063

- **Task ID:** T082
  - **Title:** Forbidden page handling at click-through (US-1 AC-1.5)
  - **Description:** In page rows inside `<UsageDrawer />`, the `pages.context` mutate is the click-through. If the current `Atlas.skipped` contains the same `pageId` with reason `forbidden`, render the row as `aria-disabled` with a small "no access" tooltip and prevent the click handler from firing. Pages itself otherwise enforces permissions if a click slips through. (Belt and suspenders for IS-17 / NFR-3.)
  - **Expected Output:** Forbidden pages don't navigate; rest navigate normally.
  - **Depends on:** T063

### Epic E9 — Build / CI / release

- **Task ID:** T090
  - **Title:** All-green gate
  - **Description:** From `site/`, ensure `npm run typecheck && npm run lint && npm run test && npm run build` exits 0. Fix any drift introduced during implementation. This is the QA gate before review (per architecture § 6.5 / NFR-8 / DoD-2..6).
  - **Expected Output:** All four commands exit 0.
  - **Depends on:** all implementation tasks

- **Task ID:** T091
  - **Title:** Ship checklist + anti-metric guard run
  - **Description:** Run `npm run check:antimetrics` (T075) — must exit 0. Confirm no Sentry / Datadog / GA / Mixpanel / external-network code anywhere via `grep -RE 'fetch|XMLHttpRequest|sendBeacon' --include='*.ts' --include='*.tsx' core/ lib/ components/ app/` — every match should be an SDK call (which goes through `client.query`/`mutate`, not raw fetch). (DoD-4 / DoD-1.)
  - **Expected Output:** Anti-metric guard green; no raw `fetch` to non-SDK origins.
  - **Depends on:** T075, T090

- **Task ID:** T092
  - **Title:** Configure Vercel project root
  - **Description:** In Vercel dashboard (or via `vercel.json` if used), set the project root to `products/component-usage-atlas/site`. `npm run build` is the build command; output is Next.js default. (Architecture § 6.5.)
  - **Expected Output:** Vercel preview deploy succeeds for any branch push.
  - **Depends on:** T090

- **Task ID:** T093
  - **Title:** Cloud Portal registration paste
  - **Description:** In Cloud Portal → App Studio (already done by user during /create-prd / install workflow if applicable; otherwise the user runs this), paste route URLs:
    ```
    Dashboard widgets #1     | /widget
    Page context panel       | /panel
    ```
    Request API access scopes: `xmc.agent.read`, `xmc.sites.read`. Required role: `Organization Admin` or `Organization Owner`. (Architecture § 6.2.)
  - **Expected Output:** App is installable to a test tenant; routes resolve from the portal.
  - **Depends on:** T092

- **Task ID:** T094
  - **Title:** Real-tenant smoke test (per `marketplace-sdk/testing-debug.md`)
  - **Description:** After deploy, install to a test tenant (≥500 pages, ≥2 sites, ≥1 collection per DoD-2). Walk all five user stories. Confirm: (a) widget cold scan completes <30s on ~1k pages (NFR-1.1, S3); (b) widget warm re-mount <200ms (NFR-1.3); (c) cancel-with-act flow works (US-1 AC-1.2 / S4); (d) collision suffix appears for two-rendering same-name (IS-16); (e) "Direct bindings only" affordance is visible on both surfaces; (f) skipped pages with `forbidden` reason render distinct from `timeout`. Capture screenshots; log a friction-log entry per `marketplace-sdk/testing-debug.md`.
  - **Expected Output:** Smoke test report with screenshots; friction log entries.
  - **Depends on:** T093

### Tests (initial seed — QA Specialist will reorder for TDD)

- **Task ID:** T100
  - **Title:** Unit tests — `index-builder.ts` (the pure-function spine)
  - **Description:** Create `site/core/__tests__/index-builder.test.ts` covering: (a) one rendering on N pages → `renderingIndex` has it once with `pages.length === N`; (b) datasource bound on rendering → both indices populated and cross-referenced (`renderingUsage.datasources` has the dsId; `datasourceUsage.renderings` has the renderingId); (c) per-page rejected promise → `skipped[]` entry with classified reason; (d) unknown rendering → synthetic ID and `isUnknown: true`; (e) inherited / token / personalized bindings absent from output (proxy: a fixture with `parameters` containing a token expression must NOT appear in `datasourceIndex`); (f) totals computed correctly.
  - **Expected Output:** Vitest suite, deterministic, no SDK imports, fast (<200ms total).
  - **Depends on:** T024

- **Task ID:** T101
  - **Title:** Unit tests — `error-classifier.ts`
  - **Description:** Cover all five reasons + the `'other'` fallback. Use representative SDK error envelopes from `client.md` § 8f.
  - **Expected Output:** Vitest suite green.
  - **Depends on:** T018

- **Task ID:** T102
  - **Title:** Unit tests — `scan-state-machine.ts`
  - **Description:** Assert allowed transitions succeed; disallowed throw. Cover every cell in the state machine table from architecture § 4.1.
  - **Expected Output:** Vitest suite green.
  - **Depends on:** T025

- **Task ID:** T103
  - **Title:** Unit tests — `concurrency-pool.ts`
  - **Description:** Cover: (a) cap=8 means at most 8 in-flight at any time (instrument via mocked job that records start/end timestamps); (b) order preservation — output positions match input positions; (c) abort signal stops new jobs from starting; in-flight jobs complete or reject according to their own behavior.
  - **Expected Output:** Vitest suite green; concurrency invariant explicit.
  - **Depends on:** T017

- **Task ID:** T104
  - **Title:** Unit tests — `withBackoff` retry helper (T019)
  - **Description:** Cover: (a) zero rate-limit errors → fn invoked once, returns; (b) one rate-limit error → fn invoked twice, succeeds on retry; (c) maxRetries+1 rate-limit errors → throws the last error; (d) jitter: delay distribution roughly +/- 20% of base*2^n; (e) abort signal during backoff cancels next retry.
  - **Expected Output:** Vitest suite green; backoff math validated.
  - **Depends on:** T019

- **Task ID:** T105
  - **Title:** Unit tests — `requireContextId` / `AtlasNoContextError`
  - **Description:** (a) `.live` present → returns it; (b) `.live` absent, `.preview` present → returns `.preview`; (c) both absent → throws `AtlasNoContextError`; (d) `ctx === null` → throws.
  - **Expected Output:** Vitest suite green.
  - **Depends on:** T014

- **Task ID:** T106
  - **Title:** Unit tests — collisions utility (`computeCollisions`)
  - **Description:** (a) Distinct names → no suffixes; (b) two same name → both rows get `· <last-7>`; (c) three same name → all three suffixed; (d) one rendering → no suffix.
  - **Expected Output:** Vitest suite green.
  - **Depends on:** T045

- **Task ID:** T107
  - **Title:** Integration tests — scan engine with stubbed SDK
  - **Description:** Create `site/core/__tests__/scan-engine.test.ts` using the typed stub pattern from `client.md` § 9 (`Mock<QueryFn>`, etc.). Cover: (a) happy path — 2 sites × 5 pages each → atlas with 10 pages, all renderings indexed; (b) one site fails on `retrieveSite` → fallback language used, scan still completes; (c) cancel during components phase → `canceled` state with `partial: true`; (d) all pages return `403` → atlas with `skipped.length === 10`, all reason `forbidden`, atlas itself otherwise complete; (e) rate-limit then success → no skip, retry path exercised.
  - **Expected Output:** Vitest suite green; deterministic mocks; no real network.
  - **Depends on:** T027, T032

- **Task ID:** T108
  - **Title:** UI tests — `<CounterRow />` states
  - **Description:** Use `@testing-library/react` to assert all six states render with correct typography classes and `aria-disabled` / `aria-label` values. Verify reduced-motion fallback for the cross-fade.
  - **Expected Output:** Vitest+RTL suite green.
  - **Depends on:** T051

- **Task ID:** T109
  - **Title:** UI tests — `<ScanStatusBar />` accessibility
  - **Description:** Assert `role="status" aria-live="polite" aria-atomic="true"`. Phase transitions cause one announcement (not per-page). Cancel button has `aria-label="Cancel scan"`. Reduced-motion collapses pulse.
  - **Expected Output:** Vitest+RTL suite green.
  - **Depends on:** T060

- **Task ID:** T110
  - **Title:** UI tests — `<RenderingNameCell />` collision rendering
  - **Description:** With two distinct renderings sharing a display name, both render with suffix; tooltip exposes full ID. With distinct names, no suffix.
  - **Expected Output:** Vitest+RTL suite green.
  - **Depends on:** T044, T045

- **Task ID:** T111
  - **Title:** UI tests — Forbidden / disabled drawer rows
  - **Description:** When `Atlas.skipped` contains a pageId with reason `forbidden` and the drawer renders that page, the row is `aria-disabled` with the no-access tooltip and click handler does not fire.
  - **Expected Output:** Vitest+RTL suite green.
  - **Depends on:** T082

- **Task ID:** T112
  - **Title:** UI tests — "Direct bindings only" affordance is always visible
  - **Description:** Mount `<WidgetSurface />` and `<PanelSurface />` in the four primary states (`idle`, `scanning`, `completed`, `error`). Affordance is in DOM in all four. Tooltip copy matches ADR-0006 exactly.
  - **Expected Output:** Vitest+RTL suite green.
  - **Depends on:** T080

- **Task ID:** T113
  - **Title:** Manual / E2E (real-portal) test plan
  - **Description:** Document the manual smoke test set in `site/docs/manual-tests.md` (or wherever lifelong runbooks live for the project) so QA can re-run after each release. Cases: scan completion at thousands-of-pages scale; cancel-with-act; collision suffix; "Direct bindings only" copy; in-memory only (no localStorage entries after scan); datasource impact pre-change; permission-denied skipped reasoning; search filtering; cross-tenant counter accuracy. (No Cypress/Playwright in v1 — DoD doesn't require it; real portal smoke is the integration test per `lifecycle.md` § 9a.)
  - **Expected Output:** A short manual-test runbook the dogfood team can follow.
  - **Depends on:** T094

---

## 4b. Important Test Cases (by epic / feature)

These are seed cases for the QA Specialist (07) to expand into per-task specs in § 10. Each line is a meaningful test (the implementation users care about, not a trivial identity check).

- **E1 / Scaffold and lifecycle**
  - Cold smoke: `/widget` and `/panel` resolve in real portal; `/` shows 404 (regression — UI | manual).
  - PNA headers present on every response (regression — manual / browser devtools).

- **E2 / Scan engine**
  - Scan completion at thousands-of-pages scale: 2k-page mock tenant completes within a budget commensurate with NFR-1.1 (target unit | scan-engine integration).
  - Cancel-with-act behavior (PRD F-3 / S4): canceling mid-scan freezes results; partial atlas usable; user clicking a result row fires `pages.context` mutate (UI + integration).
  - Display-name collision suffix (ADR-0005): two HeroV2 with distinct rendering IDs both render `· <suffix>` (unit + UI).
  - Direct bindings only affordance (ADR-0006): always visible on both surfaces; copy matches ADR text verbatim (UI + regression).
  - In-memory only (no persistence — ADR-0003): `localStorage.length === 0` and `IndexedDB.databases().length === 0` after a full scan (regression — manual / scripted).
  - Datasource impact pre-change (G3): editing a datasource on a page → editor opens panel → counter renders with skeleton then resolves to "+N pages"; click opens drawer with cross-tenant page list (E2E manual).
  - Permission-denied skipped pages reasoning (FR-7.2): a tenant returning 403 on N pages → atlas has `skipped.length === N` with reason `forbidden`; SKIPPED KPI cell shows `N` (unit + UI).
  - Search filtering (FR-2.3): typing partial name filters table client-side; no SDK call fires (UI).
  - Cross-tenant counter accuracy (US-2 AC-2.2): for any rendering on the active page, `counter === renderingIndex.get(rid).pages.length - 1` (the active page itself excluded) (unit + UI).

- **E4 / Widget surface**
  - Sortable Total column default desc; click toggles asc; both stable (UI).
  - Keyboard navigation: arrow keys move focus row; Enter opens drawer; Esc closes (UI / a11y).
  - KPI rail SKIPPED cell click → skipped sub-drawer opens (UI).

- **E5 / Panel surface**
  - First paint: panel paints active-page rendering stack <1s on a 5k-page mock (separate AbortBus path — OQ-A5) (integration).
  - Page-switch: navigating to another page in Pages re-paints Zone 3 only; scan continues; `cross-fade` collapsed under reduced-motion (UI).
  - Missing datasource: warning glyph + word `missing` + "referenced by N pages" (UI / a11y).

- **E6 / Loading + drawer**
  - Status bar: phase transitions announced once via `aria-live` (a11y).
  - Slow connection hint after 5s with no progress (UI).
  - Drawer click-through: Direct usage section row → `client.mutate('pages.context', { params: { itemId } })` called with the right itemId (integration UI).

- **E7 / Telemetry**
  - Every scan emits `scan_started` → `phase_transition` × 3 → `scan_completed` (or `_canceled` / `_error`) in order (unit / integration).
  - No telemetry event contains a `displayName`, page path beyond route prefix, datasource path, editor name, or tenant identifier (regression — schema check).
  - Anti-metric guard: introducing the string `scans_per_minute` anywhere in `core/`, `lib/`, `components/`, or `app/` causes the guard script to exit non-zero (CI).

- **E8 / Edge handling**
  - Unknown rendering: page with one rendering missing a definition reference → row `(unknown rendering)` in widget; drawer expands per-page.
  - Forbidden drawer row: row `aria-disabled`, tooltip "no access", click does NOT fire `pages.context` mutate (UI / a11y).

- **E9 / Build/release**
  - `npm run typecheck && npm run lint && npm run test && npm run build` exits 0 on every PR (CI).
  - `check:antimetrics` exits 0 on every PR (CI).
  - Real-portal smoke covers all five user stories on a representative test tenant (DoD-2 / manual).

---

## 4c. Implementation execution contract (for Developer 08)

> **Lead Developer (06) self-audit:** every subsection below is filled or explicitly `N/A — <reason>`. Developer (08) reads only this file + `prd-minimal-000.md`. The Developer **may** open `pocs/poc-v2/{index.html,styles.css,app.js}` for visual reference during implementation.

### 4c-1. Non-negotiable technical boundaries

- **Mode A iframe-only.** No backend, no `experimental_createXMCClient`, no API routes, no Auth0, no server actions. All XMC reads go through `client.query('xmc.*', ...)` from the iframe. (ADR-0002.)
- **No persistence of any kind.** No `localStorage`, no `sessionStorage`, no `IndexedDB`, no cookies, no external KV/DB, no item-bucket storage. The atlas dies with the tab. (ADR-0003.)
- **One Marketplace app, two iframe entries.** Single registration; surfaces share scan engine + atlas singleton + UI primitives + visual language. Do not create separate apps. (ADR-0004.)
- **Rendering identity = rendering definition item ID; datasource identity = content item ID.** Do NOT key by display name. Display-name collisions are a render-time disambiguation only. Renderings without a definition reference get synthetic IDs `unknown:<page-id>:<placeholder>:<index>` and `isUnknown: true`. (ADR-0005.)
- **Direct datasource bindings only in v1.** Inherited (page-design / partial-design), personalized, A/B variant, and token-resolved bindings are NOT counted. The "ⓘ Direct bindings only" affordance is mandatory on both surfaces with the locked copy from ADR-0006 § Decision. (ADR-0006, FR-8.)
- **Marketplace Client-Side scaffold (Scaffold 2).** Do not switch starters. Do not add Auth0, NextAuth, `@auth0/*`, `experimental_createXMCClient`, or server-action paths. (ADR-0007.)
- **Stay on Next.js + Turbopack.** Do not introduce Vite. Code-splitting is per Next.js App Router route. (ADR-0008.)
- **Blok is the UI layer.** Use `@blok/*` registry components only. Use Blok semantic tokens (`bg-background`, `bg-card`, `text-muted-foreground`, `bg-primary`, etc.) — never raw hex, never invented `--blok-*` tokens, never custom font families. No MUI / Mantine / Ant / shadcn-vanilla. No `@sitecore/blok-theme` (Chakra v1 — legacy). (ADR-0009.)
- **State = module-singleton + `useSyncExternalStore`.** No Zustand, no Redux, no Jotai, no Recoil, no MobX, no Valtio. No SWR, no TanStack Query. No `window.*` globals as backing store. (ADR-0010.)
- **Loading = branded animation only in v1.** No mini-game, no generative-art bloom in v1 (those are Phase 2 swap-ins behind the same `<LoadingVisualizer />` interface). No "Distract me" toggle in v1. CSS-only animations using `transform`/`opacity`; 60fps target (DoD-6). `prefers-reduced-motion` collapses pulses. (ADR-0011.)
- **Concurrency = 8; backoff exponential with jitter, max 4 retries, base 250ms; per-page timeout 12s.** Constants live in `core/scan-config.ts`. Not user-tunable in v1. (ADR-0012.)
- **Telemetry stays in-iframe.** Structured `console.info("[CUA]", event)` markers + in-memory ring buffer (max 500). No external network. No PII (no display names, paths, editor names, tenant identifiers). No Sentry, no Datadog, no GA, no Mixpanel. Anti-metric guard at `/ship`. (ADR-0013, NFR-5.2, NFR-5.3.)
- **Root route `/` is `notFound()`.** Local smoke-test rule: always hit `/widget` or `/panel` directly; never `/`. (ADR-0014.)
- **Type safety:** TypeScript strict; **no `as any`, no `as never`** at SDK call sites or production code (the only allowed `as never` is on a `vi.fn(...)` resolved value in tests per `client.md` § 9b; the only allowed `as unknown as ClientSDK` is on the assembled stub object). (`client.md` § 8a.)
- **`sitecoreContextId` always passed**, always already-narrowed `string` via `requireContextId` — never `string | undefined` at any call site. (`xmc.md` § 12a; architecture § 5.9.)
- **Double-unwrap XMC responses** at `result.data?.data ?? []` in every wrapper in `lib/sdk/queries.ts`. Base-map queries (`application.context`, `pages.context`) single-unwrap at `result.data`. (`client.md` § 8b.)
- **Two surfaces; two error boundaries.** A crash in `<WidgetSurface />` does NOT unmount `<PanelSurface />` and vice versa. (Architecture § 7.)
- **Color is never the only signal.** Stale = warning ribbon + word `Stale?`; missing datasource = warning glyph + word `missing`; forbidden chip = destructive-tinted + word `forbidden`. (NFR-4.3.)

### 4c-2. ADR one-liners

- **ADR-0001:** Use ADRs as the architecture backbone — one decision per ADR, numbered, irreversible without an explicit superseding ADR.
- **ADR-0002:** Mode A iframe-only — no backend, no Mode B, no `experimental_createXMCClient`. Auth is portal-brokered.
- **ADR-0003:** No persistence of any kind in v1 — atlas is built fresh in the iframe heap, cached for the tab's lifetime, discarded on tab close.
- **ADR-0004:** Two surfaces in one Marketplace app (Dashboard Widget + Page Context Panel) — single registration, shared scan engine + atlas + UI primitives.
- **ADR-0005:** Identity model — rendering = rendering definition item ID; datasource = content item ID. Display name is presentation, never identity. Disambiguation suffix `· <last-7-of-id>` at render time on collisions.
- **ADR-0006:** Direct datasource bindings only in v1. Inherited / personalized / A/B / token-resolved bindings not counted. Mandatory "ⓘ Direct bindings only" affordance with locked copy.
- **ADR-0007:** Use Marketplace Client-Side scaffold (Scaffold 2 in `setup/scaffold.md`). Do not switch starters; do not add Auth0 / API routes / server actions.
- **ADR-0008:** Stay on Next.js + Turbopack (scaffold default). Do not switch to Vite. Code-splitting is per Next.js App Router route boundary.
- **ADR-0009:** Blok is the UI layer. `@blok/*` shadcn registry components + theme via `theme.json` from registry. Semantic tokens only — no raw hex, no invented tokens, no custom font families.
- **ADR-0010:** Atlas state via module-level singleton + `useSyncExternalStore` pub/sub. No Zustand, no Redux, no React Context for atlas state. No `window` globals.
- **ADR-0011:** Loading visualization = branded animation in v1. Mini-game and generative bloom deferred (Phase 2 swap-ins behind the same `<LoadingVisualizer />` interface). No "Distract me" toggle in v1.
- **ADR-0012:** Scan concurrency cap 8; exponential backoff with jitter (base 250ms, max 4 retries) on rate-limit; per-page timeout 12s. Constants in `core/scan-config.ts`. Not user-tunable in v1.
- **ADR-0013:** Telemetry stays in-iframe — structured `console.info` markers + in-memory ring buffer (max 500). Zero external egress. No PII. Anti-metric guard at ship.
- **ADR-0014:** Root route `/` returns `notFound()`. `<MarketplaceProvider>` stays at root layout. Smoke-test rule: always hit `/widget` or `/panel` directly.

### 4c-3. Stack / tooling specifics

**Marketplace scaffold command (this is the FIRST execution step — see T001):**

```bash
# from C:\Projects\agentic\agentic.hahn-solo\products\component-usage-atlas
yes '' | npx --yes shadcn@latest add https://blok.sitecore.com/r/marketplace/next/quickstart-with-client-side-xmc.json --yes --cwd C:\Projects\agentic\agentic.hahn-solo\products\component-usage-atlas\site
```

Accept defaults: Next.js / `next-app` / Radix / Nova preset. After the command completes, **flatten** the nested `next-app/` subdirectory so `site/package.json` is the top-level Next.js root (per `setup/scaffold.md` § Scaffold 2 P-043):

```bash
cd products/component-usage-atlas/site
mv next-app/* next-app/.* . 2>/dev/null
rmdir next-app
```

Verify: `site/package.json` exists at the top level; `site/next-app/` does NOT exist. From this point on the canonical app root is `products/component-usage-atlas/site/` — every § 4c-5 path references `site/`, NOT `site/next-app/`.

**Stack:**

| Concern | Choice |
|---------|--------|
| Package manager | `npm` (scaffold default; `package-lock.json` is the lockfile of record) |
| Node version | Node 18+ (`setup/scaffold.md` § 1a — minimum) — pin to LTS where possible |
| Framework | Next.js 16 (App Router), `'use client'` on every page |
| Bundler | Next.js / Turbopack (dev) + webpack-or-Turbopack (build) — scaffold default |
| Language | TypeScript strict |
| Test runner | **Vitest** (`vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react`) — install per `setup/scaffold.md` § Scaffold 2 step 5 (T003) |
| Linting | ESLint default from Next.js + `eslint-config-next` (Next 16 includes `react-hooks/set-state-in-effect` — use `useSyncExternalStore`, not `useEffect+setState`, for client-only value detection) |
| Type-check | `tsc --noEmit` via `npm run typecheck` — requires `"types": ["vitest/globals", "@testing-library/jest-dom"]` in `tsconfig.json` `compilerOptions` (T003) |
| UI library | Blok (`@blok/*` shadcn registry) — install theme via `npx shadcn@latest add https://blok.sitecore.com/r/theme.json` (T006), components via `npx shadcn@latest add @blok/<name>` (T007) |
| Tailwind | Already installed by Scaffold 2; do not configure custom palette |
| Marketplace SDK | `@sitecore-marketplace-sdk/client@latest` + `@sitecore-marketplace-sdk/xmc@latest` (T005); pinned versions in `package.json` after T005; AI module **NOT** installed |
| State management | Module singleton + `useSyncExternalStore` (`core/atlas-store.ts`); zero state-management dependencies (ADR-0010) |
| Forms / data fetching libs | None (no SWR, no TanStack Query, no React Hook Form) |
| Telemetry | In-iframe ring buffer + `console.info` (`core/telemetry.ts`); no external (ADR-0013) |
| Routing | Next.js App Router (`/widget`, `/panel`, `/` returns `notFound()`); no nested routing |

**npm scripts (final):**

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "check:antimetrics": "node scripts/check-antimetrics.mjs"
}
```

**Build/test gate (must all exit 0 before merge — T090):**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

**Local dev:**

```bash
cd products/component-usage-atlas/site
npm run dev               # http://localhost:3000 — HTTP is fine for Mode A
# Smoke test ONLY at /widget or /panel — never /
```

PNA headers in `next.config.mjs` (T004) are mandatory before installing the app to a real portal.

**Forbidden dependencies (do NOT add):** Vite, Vite-React, Zustand, Redux, Jotai, Recoil, MobX, Valtio, SWR, TanStack Query, RTK Query, Dexie, idb, localforage, `@auth0/*`, NextAuth, Sentry, Datadog browser, LogRocket, MUI, Mantine, Ant Design, Chakra, `@sitecore/blok-theme`, `experimental_createXMCClient`. (Architecture § 7.1.)

### 4c-4. UI implementation notes

**Selected variant:** **v2 "Console Operator"** (`ui-design-20260427T104955Z-v2.md`).

**Winning POC clickdummy (canonical visual reference):** `products/component-usage-atlas/pocs/poc-v2/` — `index.html`, `styles.css`, `app.js`. Open these files during implementation. **When v2 spec text and the clickdummy diverge on visual details, the clickdummy wins.** v2's POC ships 6 representative screens (cold scan, completed warm, drawer open, empty result, error/no-context, panel page-switch), exercised live by `app.js`.

**Visual identity:** information-dense, mono-numerical, action-first. Strong neutral surfaces (`bg-background`, `bg-card`, `bg-muted`). KPI numbers are bold, mono-tabular, large — first thing the eye lands on. Decoration is minimal; every pixel earns its place by carrying data.

**Real Blok semantic tokens — ONLY (no raw hex):**

| Role | Tailwind utility (Blok semantic) | Used for |
|------|----------------------------------|----------|
| Neutral surface | `bg-background`, `bg-card` | All canvases |
| Subtle surface | `bg-muted`, `text-muted-foreground` | Empty / pre-scan placeholders, secondary text |
| Primary action / active counter | `bg-primary`, `text-primary-foreground` | Refresh atlas button, active phase, focused-row chip |
| Success / completed | `border-success`, `text-success` (fallback to `text-foreground` if `success` not in `theme.json` — verified at install per OQ-V2-2) | Completed scan phase chunk, freshness ribbon |
| Warning / stale / missing | `border-warning`, `text-warning`, `bg-warning/10` | Stale freshness ribbon, missing-datasource glyph, "skipped pages" link |
| Destructive / forbidden | `border-destructive`, `text-destructive`, `bg-destructive/10` | Permission-denied chips in skipped sub-drawer |
| Accent / informational | `text-accent`, `bg-accent/10` | "ⓘ Direct bindings only" badge popover |

**Typography (Blok defaults from `theme.json`):**

- Body: Blok default sans (the registry's shipped sans family; do NOT pull Google Fonts or custom families).
- Mono numerals: Blok mono variant if shipped (verified at install per OQ-V2-1). If absent, system mono (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`) registered as `font-mono`, AND `font-feature-settings: "tnum" 1, "lnum" 1` applied to the surface root so the default sans uses tabular numerals on counters.
- Heading: `text-lg font-semibold` (drawer header), `text-sm` body.
- Counters: `text-3xl font-bold tabular-nums text-primary` (panel `<CounterRow />`); `text-2xl font-semibold tabular-nums` (KPI rail).
- Labels: `text-xs uppercase tracking-wide text-muted-foreground` (KPI labels, "pages" unit label, "Datasource impact" header).

**Class vocabulary (drawn from POC `styles.css`; preserve names where possible to ease POC ↔ implementation comparisons):**

- Layout / surface: `.surface-frame`, `.zone-1`, `.zone-2`, `.zone-3`, `.zone-4`, `.density-compact`, `.density-comfortable`.
- Status bar: `.scan-status`, `.scan-status__segment`, `.scan-status__segment--pending`, `.scan-status__segment--active`, `.scan-status__segment--completed`, `.scan-status__readout`, `.scan-status__cancel`.
- KPI rail: `.kpi-rail`, `.kpi-cell`, `.kpi-cell__label`, `.kpi-cell__value`, `.kpi-cell--emphasize`, `.kpi-cell--clickable`.
- Counter row: `.counter-row`, `.counter-row__count`, `.counter-row__label`, `.counter-row__primary`, `.counter-row__secondary`, `.counter-row__chevron`, `.counter-row--zero`, `.counter-row--missing`.
- Freshness ribbon: `.freshness`, `.freshness--stale`, `.freshness__rescan`.
- Drawer: `.sheet`, `.sheet__section`, `.sheet__page-row`.
- Drawer-open page-switch hint: `.surface-frame[data-drawer-open="true"]`.
- "ⓘ Direct bindings only": `.direct-bindings-info`.

(These names track to the POC's class set. If a class doesn't survive the migration to Blok primitives, that's fine — keep the **structure** and **typography**; the class names are a navigation aid, not a contract.)

**Loading visual:** segmented progress strip (`.scan-status` with three `.scan-status__segment`s for Sites · Pages · Components). Active phase has CSS-only opacity pulse (`@keyframes pulse-active { 0%, 100% { opacity: 0.6 } 50% { opacity: 1 } }`, 1.6s ease-in-out infinite). Numerical readout (`Pages 47 / 312 · 14s elapsed`) in `font-mono tabular-nums text-sm text-muted-foreground` to the right. Cancel button (`@blok/button variant="ghost" size="sm"` with `@blok/icon name="x"`) far right; `aria-label="Cancel scan"`. **CSS-only — no `<canvas>`, no WebGL.** 60fps via `transform`/`opacity` only (DoD-6 / AR-8).

**Key behaviors locked in by v2:**

- 4-zone vertical anatomy on both surfaces; widget keeps Zone 4 (KPI rail), panel suppresses it.
- Density toggle on widget (compact default); `@blok/toggle-group` primary path; native `<button role="radio">` group fallback.
- Drawer = `@blok/sheet`. Two stacked sections separated by `@blok/separator`: "Direct rendering usage" + "Via datasource". Footer: Close button + `@blok/kbd` Esc hint.
- Refresh atlas is a primary `@blok/button` in the freshness ribbon — never buried in a menu.
- Panel paints active page rendering stack BEFORE global scan completes (separate AbortBus — OQ-A5).
- Page-switch on panel re-paints Zone 3 only via 250 ms cross-fade (collapsed under `prefers-reduced-motion`).
- Status bar `aria-live="polite"` announces phase transitions ONCE per phase — not per page.
- Reduced-motion: pulses → static fill; cross-fades → instant; drawer slides → instant open. All CSS-mediated.

**Six v2 POC screens** (per ui-design-v2 § 3 + POC `app.js`):

1. **W1 Cold scan** (widget) — segmented status bar pulses; skeleton table; KPI rail values are `—`; cancel button ready.
2. **W2 Completed warm** (widget) — freshness ribbon; populated table sorted Total ↓; mini-bar visualizes pages-relative; KPI rail populated.
3. **W3 Drawer open** (widget) — `@blok/sheet` with two sections; rendering display name + collision suffix; per-page rows.
4. **W4 Empty result** (widget) — `<EmptyStates>`: "Every component is unique to a page."
5. **W5 No tenant context** (widget) — `<ErrorStates>`: "Atlas needs a tenant connection — please reload the dashboard." No retry button.
6. **P1/P2 Panel cold + page-switch** (panel) — first paint immediate, counters skeleton; page-switch swaps Zone 3 only.

(P3 Drawer open and P4 zero-other-pages are visually similar to W3/W4; the POC covers the high-divergence states.)

### 4c-5. File / module structure and naming conventions

**Canonical app root:** `products/component-usage-atlas/site/` (after T001 + flatten).

```
site/
├── package.json
├── next.config.mjs                          # PNA + CORS headers (T004)
├── tsconfig.json                            # types: vitest/globals + @testing-library/jest-dom (T003)
├── vitest.config.ts                         # T003
├── vitest.setup.ts                          # @testing-library/jest-dom/vitest (T003)
├── tailwind.config.ts                       # font-mono register (T006)
├── scripts/
│   └── check-antimetrics.mjs                # T075 — anti-metric guard
├── app/
│   ├── layout.tsx                           # MarketplaceProvider at root (ADR-0014); never edited after scaffold + T002
│   ├── page.tsx                             # notFound() (T008)
│   ├── widget/
│   │   └── page.tsx                         # WidgetSurface entry (T009)
│   └── panel/
│       └── page.tsx                         # PanelSurface entry (T010)
├── components/
│   ├── providers/
│   │   └── marketplace.tsx                  # scaffold default (lint-fixed by T002); DO NOT modify shape
│   ├── surfaces/
│   │   ├── widget-surface.tsx               # T040
│   │   └── panel-surface.tsx                # T050
│   ├── widget/
│   │   ├── widget-table.tsx                 # T041
│   │   ├── search-input.tsx                 # T042
│   │   ├── kpi-rail.tsx                     # T043
│   │   ├── rendering-name-cell.tsx          # T044
│   │   ├── freshness-ribbon.tsx             # T046
│   │   ├── scope-picker.tsx                 # T047
│   │   └── density-toggle.tsx               # T048
│   ├── panel/
│   │   └── counter-row.tsx                  # T051
│   ├── loading/
│   │   └── scan-status-bar.tsx              # T060
│   ├── drawer/
│   │   ├── usage-drawer.tsx                 # T063
│   │   └── skipped-drawer.tsx               # T064
│   ├── info/
│   │   └── direct-bindings-info.tsx         # T080
│   ├── debug/
│   │   └── debug-panel.tsx                  # T074
│   └── ui/                                  # shadcn / Blok primitives — managed by `npx shadcn@latest add`
├── core/
│   ├── atlas-store.ts                       # T030 — module singleton (ADR-0010)
│   ├── atlas-actions.ts                     # T033
│   ├── atlas-freeze.ts                      # T026
│   ├── use-atlas-slice.ts                   # T031
│   ├── context-resolver.ts                  # T014
│   ├── scan-engine.ts                       # T027
│   ├── scan-state-machine.ts                # T025
│   ├── scan-config.ts                       # T019
│   ├── sites-enumerator.ts                  # T020
│   ├── site-language-resolver.ts            # T021
│   ├── pages-enumerator.ts                  # T022
│   ├── components-fetcher.ts                # T023
│   ├── concurrency-pool.ts                  # T017
│   ├── abort-bus.ts                         # T016
│   ├── error-classifier.ts                  # T018
│   ├── index-builder.ts                     # T024 — pure function
│   ├── telemetry.ts                         # T072
│   └── __tests__/
│       ├── index-builder.test.ts            # T100
│       ├── error-classifier.test.ts         # T101
│       ├── scan-state-machine.test.ts       # T102
│       ├── concurrency-pool.test.ts         # T103
│       ├── with-backoff.test.ts             # T104
│       ├── context-resolver.test.ts         # T105
│       └── scan-engine.test.ts              # T107
└── lib/
    ├── sdk/
    │   ├── client.ts                        # T012 — re-exports
    │   ├── queries.ts                       # T015 — five typed wrappers
    │   └── types.ts                         # T013 — domain types
    ├── collisions.ts                        # T045 — pure utility
    └── __tests__/
        └── collisions.test.ts               # T106
```

**Naming conventions:**

- File names: `kebab-case.tsx` (components), `kebab-case.ts` (modules), `*.test.ts` (tests, co-located in `__tests__/`).
- Component identifiers: `PascalCase` (`<WidgetSurface />`, `<CounterRow />`).
- Type aliases: `PascalCase`.
- Module-scoped constants: `SCREAMING_SNAKE_CASE`.
- React component file = component identifier in kebab-case.
- One component per file (a tightly-coupled helper component may live in the same file if it doesn't deserve a unit test of its own).

**Imports:**

- Use `@/` path alias for `site/`-rooted imports (the scaffold sets this in `tsconfig.json` and `vitest.config.ts`).
- Cross-layer rule: `core/` may import from `lib/sdk/` (types + queries) but not from `components/` or `app/`. `lib/sdk/` may import from `lib/sdk/types.ts` only. `components/` may import anything. Tests mirror their source.
- `'use client'` directive at the top of every file under `app/` and every `components/**` file that uses hooks or browser APIs.

### 4c-6. Integration and API contract notes

This subsection is the developer's reference for every external contact surface. Every `client.query` / `client.mutate` shape used by Atlas appears below with exact key, params, and response shape. (Cross-references: `marketplace-sdk/client.md` § 4 / § 5 / § 6 / § 8b; `marketplace-sdk/xmc.md` § 4 / § 5 / § 6 / § 11; architecture § 5.)

#### 4c-6.1 — `application.context` (initial bootstrap; base map)

```ts
const ctxResult = await client.query('application.context');
// ctxResult.data is ApplicationContext (single-unwrap base-map per client.md § 8b)
const contextId = requireContextId(ctxResult.data);
// contextId is now `string`, never `string | undefined`.
```

`ApplicationContext` shape (relevant slice — see `client.md` § 4):

```ts
{
  id: string;
  resourceAccess?: Array<{
    resourceId: string;
    tenantId: string;
    tenantName?: string;
    context: { live: string; preview: string };  // ← sitecoreContextId
  }>;
  permissions?: { iframe?: { sandbox?: string[]; allow?: string[] } };
}
```

**Policy:** prefer `.live` (delivery context); fall back to `.preview`. Never cast `as string`. (Architecture § 5.1.)

#### 4c-6.2 — `xmc.agent.sitesGetSitesList`

```ts
const result = await client.query('xmc.agent.sitesGetSitesList', {
  params: { query: { sitecoreContextId: contextId } },
});
const sites = result.data?.data ?? [];   // double-unwrap (XMC module)
```

**Response shape (per `Xmapp.*`; verify at T005):** `Array<{ id, name, displayName?, collectionId?, defaultLanguage? }>`. Use `name` for `siteName` keying in subsequent calls. (Architecture § 5.2; `xmc.md` § 6.)

**Errors:** auth/missing-context surfaces as a thrown error; classify via `error-classifier.ts`. No 429/rate-limit retries at this top-level call (single round-trip).

#### 4c-6.3 — `xmc.sites.listCollections` (only when scope is `'collection'`)

```ts
const result = await client.query('xmc.sites.listCollections', {
  params: { query: { sitecoreContextId: contextId } },
});
const collections = result.data?.data ?? [];
```

**Response shape:** `Array<{ id: string; name: string; displayName?: string; siteIds: string[] }>` (verify at T005). Cached for the iframe lifetime in a separate slot (not part of the atlas itself). (Architecture § 5.3.)

#### 4c-6.4 — `xmc.sites.retrieveSite` (per-site default language; IS-13 / FR-1.3)

```ts
const result = await client.query('xmc.sites.retrieveSite', {
  params: {
    path: { siteId },
    query: { sitecoreContextId: contextId },
  },
});
if (!result.data?.data) throw new Error(`retrieveSite returned empty for ${siteId}`);
return result.data.data;   // SiteDetails
```

**Response shape (relevant fields):** `{ id, name, displayName?, defaultLanguage?, collectionId? }`. Cached per-site for scan lifetime in `core/site-language-resolver.ts`. (Architecture § 5.4; `xmc.md` § 4.)

#### 4c-6.5 — `xmc.agent.sitesGetAllPagesBySite`

```ts
const result = await client.query('xmc.agent.sitesGetAllPagesBySite', {
  params: {
    path: { siteName },                    // NOT siteId! (architecture § 5.5)
    query: { language, sitecoreContextId: contextId },
  },
});
if (signal.aborted) throw new DOMException('aborted', 'AbortError');
return result.data?.data ?? [];   // PageStub[]
```

**Response shape (verify at T005 / OQ-A2):** flat `Array<{ pageId, pageName, sitePath, siteId, siteName, language, collectionId? }>` is the expected default; if the SDK paginates, follow the continuation-token pattern (record in friction log). Path key is `siteName`, not `siteId`. (Architecture § 5.5; `xmc.md` § 6.)

**Errors:** classified per `error-classifier.ts`. Per-page failures here would actually be per-site failures; one failed site does NOT abort the scan — log and move on.

#### 4c-6.6 — `xmc.agent.pagesGetComponentsOnPage` (the fan-out frontier)

```ts
const result = await client.query('xmc.agent.pagesGetComponentsOnPage', {
  params: {
    path: { pageId },
    query: { language, sitecoreContextId: contextId },
  },
});
if (signal.aborted) throw new DOMException('aborted', 'AbortError');
return result.data?.data ?? [];   // ComponentRecord[]
```

**Response shape (`ComponentRecord` — local type narrowed from `Xmapp.*`; verified at T005 / OQ-A1):**

```ts
type ComponentRecord = {
  renderingId?: string;        // rendering definition item ID — primary key per ADR-0005
  renderingName?: string;      // display name; fallback chain per ADR-0005
  placeholderKey?: string;     // for synthetic IDs in unknown-rendering case
  datasource?: {
    itemId?: string;           // content item ID — FR-8.1 / ADR-0006 (direct binding)
    displayName?: string;
    path?: string;
  };
  parameters?: Record<string, unknown>;  // for the panel parameter tooltip (AC-2.1)
};
```

**OQ-A1 (Lead Developer task at T005):** if installed SDK names a field differently (e.g. `renderingDefinitionId` vs `renderingId`, `dataSource` vs `datasource`), update `lib/sdk/types.ts` and the index builder. Record the verified version in `marketplace-sdk/CATALOG.md`. **OQ-A4 (deeply-nested layouts):** if the response is shallow (placement-level only, no nested-rendering composition), document the v1 limit in the editor-visible affordance and open a Phase-2 OS entry — the Atlas index will only count placement-level components.

**Concurrency / retry / timeout (ADR-0012):** wrapped by `withBackoff` (T019) and `Promise.race` against `PER_PAGE_TIMEOUT_MS = 12_000`. Pool cap 8. Rate-limit signals trigger exponential backoff (base 250ms, max 4 retries); after exhaustion, page is `skipped` with reason `'network_error'`. Per-page timeout → `'timeout'`. 403 → `'forbidden'`. (FR-7.2.)

**Errors:** `Promise.allSettled` collects results in order. Each `rejected` is classified via `core/error-classifier.ts` and pushed to `Atlas.skipped`. Scan does NOT abort on per-page failures. (FR-1.7, NFR-3.1.)

#### 4c-6.7 — `pages.context` mutate (drawer click-through; FR-6.1)

```ts
await client.mutate('pages.context', {
  params: { itemId: pageRef.pageId },
});
```

**Behavior:** host frame replaces the active page with the targeted item. No URL construction; the SDK is the canonical click-through. Available from BOTH `xmc:dashboardblocks` and `xmc:pages:context-panel` (per `client.md` § 5).

#### 4c-6.8 — `pages.context` query/subscribe (panel only; FR-3.2)

```ts
// PanelSurface mount:
const res = await client.query('pages.context', {
  subscribe: true,
  onSuccess: (data) => {
    // data.pageInfo?.id is the active page ID
    // re-paint Zone 3 with the new active page (D10)
  },
  onError: (err) => track({ kind: 'scan_error', surface: 'panel', cause: err }),
});
const teardown = res.unsubscribe;
useEffect(() => () => teardown?.(), [teardown]);   // cleanup on unmount
```

**Behavior:** subscribe-via-query path A (per `client.md` § 6a). Initial value resolves immediately; subsequent updates fire `onSuccess` whenever the editor navigates pages in the host. The Widget surface NEVER subscribes (per `client.md` § 7 — `xmc:dashboardblocks` doesn't expose `pages.context` subscribe). On panel unmount, call the returned `unsubscribe` AND `client.destroy()` if the surface owns the SDK lifetime.

#### 4c-6.9 — Telemetry events (host-frame postMessage NOT used)

Telemetry stays in-iframe (ADR-0013). Events are emitted via `core/telemetry.ts::track(event)` to a ring buffer + `console.info("[CUA]", event)`. **No `postMessage` to the host frame.** **No external network.** No `fetch` / `XMLHttpRequest` / `sendBeacon` to non-SDK origins anywhere.

Event shape (per ADR-0013):

```ts
type TelemetryEvent = {
  timestamp_ms: number;
  kind: 'scan_started' | 'scan_completed' | 'scan_canceled' | 'scan_error'
       | 'page_skipped' | 'pulse_response' | 'surface_mounted'
       | 'phase_transition' | 'rate_limit_retry';
  surface: 'widget' | 'panel';
  // kind-specific fields — IDs and counts only; NO PII (no display names, paths, editor names, tenant identifiers)
};
```

**Verification (DoD-1, NFR-5.2):** at ship, `grep -RE 'fetch|XMLHttpRequest|sendBeacon' --include='*.ts' --include='*.tsx' core/ lib/ components/ app/` — every match must be inside `client.query/mutate` (which goes through `@sitecore-marketplace-sdk/*`, not raw fetch).

#### 4c-6.10 — Authentication and host frame contract

- **Authentication:** portal-brokered (Mode A) — see `lifecycle.md` § 4a + `client.md` § 2. `target: window.parent` is required in `ClientSDK.init`. **No tokens in client code.** No env vars at the app origin (Mode A apps need no `.env.local`).
- **HTTPS:** **NOT required** for local dev (Mode A — no cookies at app origin). HTTPS for production deploy is automatic on Vercel.
- **Sandbox:** the portal sets the iframe's `sandbox` attribute. Read `appCtx.permissions.iframe.sandbox` at startup; surface unexpected restrictions in friction log. Atlas does NOT require WebGL or `<canvas>` (CSS-only animations per ADR-0011).
- **CORS / PNA:** add four headers to `next.config.mjs` (T004) — see `setup/scaffold.md` § Scaffold 2 step 8. **Never** combine `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`.
- **API access scopes (Cloud Portal registration):** `xmc.agent.read` + `xmc.sites.read`. (Architecture § 6.2.)
- **Required role to register/install:** `Organization Admin` or `Organization Owner` (`lifecycle.md` § 3).

### 4c-7. Parity / rebuild pointers

**N/A — greenfield.** Component Usage Atlas is a brand-new application with no rebuild source. `current-run.json` `source.analysis_mode` is `"greenfield"`; no `assets_bundle` and no `content_dump` exist. The PRD itself is the source of truth, augmented by architecture + ADRs.

---

## 5. Dependencies

### Ordering constraints (prose)

- The **scaffold task (T001)** must come first — every subsequent file lands in `site/`.
- **Lint fix (T002)** is a precondition for any later task that adds files and runs `npm run lint` as part of its acceptance.
- **Test stack (T003)** is a precondition for any test task (T100+).
- **PNA headers (T004)** are not a logical precondition for code, but are required before any real-portal install (T093+).
- **SDK pin + shape verification (T005)** must run **before** types are finalized (T013) — they have a circular relationship; in practice T013 is done first as a strawman, and T005 updates it. Listed here as `T005 depends on T013` (can be revisited for tightening).
- **Domain types (T013)** are imported by every `core/` and `lib/sdk/` module — must come before T014..T024.
- **`atlas-store.ts` (T030)** must exist before the scan-engine orchestrator (T027) wires telemetry + state transitions, and before any surface (T040, T050) subscribes. (`atlas-store.ts` does NOT itself depend on the scan engine — it just holds state.) `runScan` (T027) sets state via `setAtlasState`, so T027 depends on T030.
- **Surfaces (T040, T050)** depend on the engine + state being implementable; they trigger scans via `atlas-actions.ts` (T033).
- **UI primitives** (Blok components — T007) gate every visual task.
- **Tests (T100+)** depend on their target source files.
- **Build/CI (T090)** depends on every implementation task.
- **Real-tenant smoke (T094)** depends on Vercel deploy (T092) and Cloud Portal registration (T093).

### Execution order (numbered list of every Task ID — used by the execution agent to implement in dependency order)

1. T001 — Scaffold the Marketplace Client-Side app
2. T002 — Apply quickstart lint fixes (P-019)
3. T003 — Install test stack + tsconfig types patch
4. T004 — Add Chrome Local Network Access headers
5. T006 — Install Blok theme
6. T007 — Install required Blok components
7. T008 — Create root route → `notFound()`
8. T009 — Scaffold widget route entry
9. T010 — Scaffold panel route entry
10. T011 — Document local smoke-test rule in product README
11. T012 — Create `lib/sdk/client.ts`
12. T013 — Define domain types in `lib/sdk/types.ts`
13. T005 — Pin SDK versions; verify `pagesGetComponentsOnPage` shape (OQ-A1)
14. T014 — Implement `core/context-resolver.ts`
15. T015 — Implement `lib/sdk/queries.ts`
16. T016 — Implement `core/abort-bus.ts`
17. T017 — Implement `core/concurrency-pool.ts`
18. T018 — Implement `core/error-classifier.ts`
19. T072 — Implement `core/telemetry.ts`
20. T019 — Implement `core/scan-config.ts` and `withBackoff`
21. T020 — Implement `core/sites-enumerator.ts`
22. T021 — Implement `core/site-language-resolver.ts`
23. T022 — Implement `core/pages-enumerator.ts`
24. T023 — Implement `core/components-fetcher.ts`
25. T024 — Implement `core/index-builder.ts` (pure)
26. T025 — Implement `core/scan-state-machine.ts`
27. T026 — Implement `core/atlas-freeze.ts`
28. T030 — Implement `core/atlas-store.ts` module singleton
29. T031 — Implement `core/use-atlas-slice.ts`
30. T032 — Add `__resetForTest()` helper
31. T027 — Implement `core/scan-engine.ts::runScan`
32. T033 — Wire scan triggers into atlas-store actions
33. T045 — Implement collision-suffix utility
34. T044 — Implement `<RenderingNameCell />`
35. T060 — Implement `<ScanStatusBar />`
36. T046 — Implement `<FreshnessRibbon />` + Refresh atlas
37. T047 — Implement `<ScopePicker />`
38. T048 — Implement density toggle (with fallback)
39. T080 — "Direct bindings only" affordance
40. T064 — Implement skipped-pages sub-drawer
41. T063 — Implement `<UsageDrawer />`
42. T065 — Implement Empty / Error states
43. T043 — Implement `<KpiRail />`
44. T041 — Implement `<WidgetTable />`
45. T042 — Implement `<SearchInput />`
46. T040 — Implement `<WidgetSurface />`
47. T051 — Implement `<CounterRow />`
48. T050 — Implement `<PanelSurface />`
49. T052 — Active-page rendering stack + Datasource Impact
50. T053 — Panel page-switch handler
51. T054 — Narrow-viewport adjustments for panel
52. T061 — Wire status bar / freshness ribbon swap into Zone 1
53. T062 — Slow-connection hint
54. T081 — Unknown rendering virtual row
55. T082 — Forbidden page click-through prevention
56. T073 — Wire telemetry emission across the engine and surfaces
57. T074 — Implement `<DebugPanel />`
58. T075 — Anti-metric guard script
59. T100 — Unit tests — `index-builder.ts`
60. T101 — Unit tests — `error-classifier.ts`
61. T102 — Unit tests — `scan-state-machine.ts`
62. T103 — Unit tests — `concurrency-pool.ts`
63. T104 — Unit tests — `withBackoff`
64. T105 — Unit tests — `requireContextId`
65. T106 — Unit tests — collisions utility
66. T107 — Integration tests — scan engine with stubbed SDK
67. T108 — UI tests — `<CounterRow />` states
68. T109 — UI tests — `<ScanStatusBar />` accessibility
69. T110 — UI tests — `<RenderingNameCell />` collision rendering
70. T111 — UI tests — Forbidden / disabled drawer rows
71. T112 — UI tests — "Direct bindings only" affordance always visible
72. T090 — All-green gate (typecheck + lint + test + build)
73. T091 — Ship checklist + anti-metric guard run
74. T092 — Configure Vercel project root
75. T093 — Cloud Portal registration paste
76. T094 — Real-tenant smoke test
77. T113 — Manual / E2E test plan documented

### Parallel groups

Within a group, tasks share the same dependency set and may run in parallel (Team Lead may spawn multiple Developer agents). Groups execute in order; a group starts only when ALL prior groups complete.

```
Group 1 (sequential — foundation): T001 → T002 → T003 → T004
Group 2 (parallel — depends on T002): T006, T007, T008, T009, T010, T011, T012, T013
Group 3 (sequential — depends on T013): T005
Group 4 (parallel — depends on T013): T014, T016, T018
Group 5 (sequential — depends on T012, T013, T014): T015
Group 6 (parallel — depends on T013): T017, T026, T072 (T072 depends only on T013)
Group 7 (sequential — depends on T013, T016, T018, T072): T019
Group 8 (parallel — depends on T015): T020, T021, T022, T023
Group 9 (sequential — depends on T013, T018): T024
Group 10 (sequential — depends on T013): T025
Group 11 (sequential — depends on T013): T030 → T032
Group 12 (sequential — depends on T030): T031
Group 13 (sequential — depends on T013, T014, T015, T016, T017, T020, T021, T022, T023, T024, T025, T026, T072): T027
Group 14 (sequential — depends on T027, T030): T033
Group 15 (parallel — depends on T013): T045 (collisions utility — has no other deps)
Group 16 (parallel — depends on T013, T031, T033 + Blok components T007): T044, T060, T046, T047, T048, T080, T065
Group 17 (sequential — depends on T064 deps then T063): T064 → T063
Group 18 (parallel — depends on T044 + T045): T041 (table); T043 (KPI rail) — depends on T031, T064
Group 19 (sequential — depends on T040 deps): T042 → T040
Group 20 (sequential — depends on T031, T051): T051 → T050 → T052 → T053 → T054
Group 21 (parallel — final UI wiring): T061, T062, T081, T082
Group 22 (parallel — telemetry wiring): T073, T074, T075
Group 23 (parallel — unit tests): T100, T101, T102, T103, T104, T105, T106
Group 24 (sequential — integration test): T107
Group 25 (parallel — UI tests): T108, T109, T110, T111, T112
Group 26 (sequential — gates): T090 → T091 → T092 → T093 → T094 → T113
```

The grouping above is a hint to the Team Lead — strictly sequential execution per § 5 numbered list also works and is the safer fallback for a single Developer agent.

---

## 6. Suggested Milestones

| Milestone | Scope | Exit criteria |
|-----------|-------|---------------|
| **M1 — Scaffold + lifecycle hello-world** | T001..T011 | `npm run dev` works; `/widget` and `/panel` show placeholder content; `/` returns 404; PNA headers present; lint + typecheck + build all green. |
| **M2 — Scan engine offline-mockable** | T012..T027 + T030..T033 + T100..T106 | Pure-function and engine tests green with stubbed SDK; engine produces a deterministic atlas from fixtures; cancel & state machine verified. **No UI yet.** |
| **M3 — Widget surface alpha** | T041..T048, T060, T063, T064, T065, T040 + T108..T112 | Widget renders all five v2 screens (W1..W5) against either a stubbed engine or a real test tenant; drawer click-through works; KPI rail interactive. |
| **M4 — Panel surface alpha** | T050..T054 + T051 (cross-listed) | Panel paints active page <1s on mock; cross-tenant counters resolve; page-switch swaps Zone 3 only; missing-datasource warning rendered. |
| **M5 — Edge handling + skipped pages** | T080, T081, T082, T064 (skipped sub-drawer wiring) | "Direct bindings only" badge always visible; "(unknown rendering)" virtual row works; forbidden chips reinforced with text; skipped sub-drawer groups by reason. |
| **M6 — Telemetry + release** | T072..T075, T090..T094, T113 | Anti-metric guard green; smoke on real tenant covers all five user stories; CATALOG row recorded; PR opened. |

---

## 7. Risk Areas

PRD R1..R14 + architect-time OQ-A1..OQ-A4 are the canonical risk set. Highlights for execution:

| ID | Risk | Mitigation in this plan |
|----|------|-------------------------|
| **R1 / OQ-1** | Scan time at 2k+ page tenants exceeds editor patience even with engaging loading. | Concurrency cap 8 (T019), per-page timeout 12s, status bar with honest progress + cancel; if S6 ("felt fast") underperforms post-launch, OS-13 (incremental refresh) opens Phase 2. |
| **R2** | Agent endpoint rate-limits at scale. | Exponential backoff with jitter (T019), max 4 retries; surface backoff state in status bar (T062); telemetry event `rate_limit_retry`. |
| **R3** | Rendering identity mismatch (instance vs definition); datasource cloning across language fallbacks. | ADR-0005 enforces ID-based keying (T024 + T045). Display name is presentation only. |
| **R4** | SDK breaking changes between releases. | Pin SDK versions in `package.json` after T005; record in CATALOG; verify shape at scaffold time (OQ-A1). |
| **R5** | Stale cache misleads editor after a peer publishes. | AC-5.2 stale hint at >15 min (T046); manual refresh always available; in-memory only (no cross-session staleness — ADR-0003). |
| **R6** | Editor cancels long scans habitually. | S4 metric distinguishes cancel-with-act from frustration cancel (T072 + T073 telemetry). Phase 2 may add a "background scan" mode. |
| **R7** | Mini-game distraction backfires. | N/A in v1 — mini-game is OS-12 (out of scope). |
| **R8** | Panel extension point context shape varies between SDK versions. | Pin SDK versions; verify `pages.context` subscribe shape at T005. |
| **R9** | Deep page hierarchies cause `pagesGetComponentsOnPage` to time out. | Per-page timeout 12s (T019/T023); `'timeout'` skip reason classified per FR-7.2. |
| **R10** | Editor expects deletion-blocking modal; pull-only model disappoints. | Lead with "open the panel before you act" UX (Zone 1 freshness ribbon, S5 retention pulse). |
| **R11** | Pulse-based metrics underflow at small install base. | Validity floors (≥30 responses) baked into PRD § 3 — not the developer's concern, but pulse instrument (T072 `pulse_response`) supports it. |
| **R12** | Direct-binding-only scope under-counts impact. | Mandatory affordance with locked copy (T080); promotion to Phase 2 gated on signal. |
| **R13** | Display-name collisions confuse editors. | Tooltip + ID badge + tested at T044/T045/T110. |
| **R14** | Forbidden-page handling silently inflates counts. | Counts framed as "upper bound for visibility"; tooltip explains; Phase 2 may add a "show only pages I can navigate" toggle. |
| **AR-1 / OQ-A1** | `pagesGetComponentsOnPage` field names vary by SDK version. | T005 verifies and updates `ComponentRecord`; CATALOG row captures version. |
| **AR-2** | >50 sites push pre-page-fan-out budget. | Site language resolution runs through the same concurrency pool (T021); status bar shows "Resolving site languages…" phase if the wait is visible. |
| **AR-8** | Branded animation sub-60fps on low-spec laptop. | CSS-only animations using `transform`/`opacity`; reduced-motion fallback; profile early at T060. |
| **AR-9** | Synthetic IDs for unknowns produce hundreds of distinct rows. | Group under one virtual row in widget (T081); index keeps them distinct so totals are correct. |
| **AR-10** | Sandbox restrictions block CSS animations. | Detect sandbox at startup (read `appCtx.permissions.iframe.sandbox`); fall back to stripped progress bar (T060). |
| **AR-11** | Orphan sites missing from collections mapping. | Included only when `scope.kind === 'all-collections'`; never in collection-filtered scans (T020). |

**Architect-time open questions to resolve at scaffold time (Lead Developer at T005, T021):**

- **OQ-A1** — `pagesGetComponentsOnPage` field-name verification. Resolve at T005.
- **OQ-A2** — `sitesGetAllPagesBySite` pagination. Resolve at T005 / T022.
- **OQ-A3** — iframe ancestor lifecycle proxy. Not load-bearing; defer.
- **OQ-A4** — nested-rendering depth. Verify at first real-tenant smoke (T094); document v1 limit if shallow.
- **OQ-V2-1, OQ-V2-2** — Blok mono variant + success/warning semantic tokens. Resolve at T006 by inspecting installed `theme.json`.
- **OQ-V2-3** — Marketplace iframe sandbox allows CSS `@keyframes`. Verify at T094 (real-portal smoke).
- **OQ-V2-4** — Panel drawer slide direction (`side="left"` vs `"right"`). Verify at T094.

**Telemetry size budget (R-ADR-0013):** ring buffer max 500 entries (~50 KB worst case). Bounded by construction; no growth path. Document in T072.

---

## 8. Suggested Team Structure

- **One Developer agent (sequential foundation):** M1 → M2 → M5 prerequisites. The atlas singleton + scan engine + telemetry are foundation; one agent owning end-to-end keeps the state machine + abort-bus + concurrency pool consistent.
- **Two Developer agents in parallel after M2 (optional):** Widget agent (M3) and Panel agent (M4) can run independently against the stable engine + atlas-store. The shared visuals (`<ScanStatusBar />`, `<UsageDrawer />`, `<RenderingNameCell />`, `<EmptyStates>` / `<ErrorStates>`, "Direct bindings only" affordance) are produced first by either agent and consumed by both.
- **Tests (M3/M4 unit + UI):** can be assigned to the same agent that owns the source, OR to a dedicated test agent if QA Specialist (07) decides to enforce TDD by spawning test-first.
- **M5 (edge handling) + M6 (telemetry + release):** sequential, single agent — these stitch across surfaces and need a global view.
- **Real-portal smoke (T094) + CATALOG row + PR (M6):** Team Lead orchestrates; does not need a dedicated Developer agent.

If the QA Specialist (07) restructures to TDD per-task, parallelization within a milestone shifts but the milestone boundaries above stay valid.

---

## 9. TDD and quality contract

*(Populated by **QA Specialist (07)** after Lead Developer (06): non-negotiable RED → GREEN → REFACTOR rules for all applicable layers.)*

---

## 10. Per-task test specifications

*(Populated by **QA Specialist (07)**: meaningful automated/manual tests per Task ID.)*

---

## Handoff Metadata

- **Canonical run manifest:** `products/component-usage-atlas/project-planning/workflow/run-20260427T104955Z.json`
- **Source PRD:** `products/component-usage-atlas/project-planning/PRD/prd-000.md`
- **Source architecture:** `products/component-usage-atlas/project-planning/architecture/architecture-20260427T104955Z.md`
- **Selected UI variant:** `products/component-usage-atlas/project-planning/ui-design/ui-design-20260427T104955Z-v2.md` (v2 — Console Operator)
- **Winning POC clickdummy (visual reference):** `products/component-usage-atlas/pocs/poc-v2/`
- **ADRs honored:** ADR-0001 through ADR-0014 (all locked).
- **Recommended next command:** `/implement` — runs against `prd-minimal-000.md` + this task breakdown after QA Specialist (07) enriches sections 9 and 10.
- **Recommended next input file:** `task-breakdown-20260427T104955Z.md` (this file, after QA enrichment).
- **Branch:** `prd-000`
- **Remote:** `https://github.com/Chris1415/Sitecore.Plugin.Component-Usage-Atlas.git`
