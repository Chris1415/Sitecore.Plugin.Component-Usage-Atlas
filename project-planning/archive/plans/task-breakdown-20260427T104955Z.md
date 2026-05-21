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
  - QA Specialist (07) has enriched this file in place (TDD §§ 9 + 10 added; § 4b expanded; § 5 reordered for test-first); Developer Code Monkey (08) implements from this file + prd-minimal-000.md only
next_input:
  - none — minimal track; no standalone qa-report.md (`canonical_artifacts.qa_report: null` in run manifest). Per /implement contract, Developer (08) reads only this file + prd-minimal-000.md.
qa_enriched_at: 2026-04-27T16:30:00Z
task_breakdown_style: tdd
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
  - **Title:** Implement `core/context-resolver.ts` (`requireContextId`) — GREEN
  - **Description:** Create `site/core/context-resolver.ts` exporting `requireContextId(ctx: ApplicationContext | null): string`. Logic per architecture § 5.1 + `client.md` § 4: prefer `ctx.resourceAccess[0].context.live`, fall back to `.preview`. If neither, throw a typed `AtlasNoContextError extends Error`. Also export the error class. **No `as string` / `as never` / `as any`.** **TDD:** Write code only after T105 (RED tests) is committed and failing on assertion.
  - **Expected Output:** Pure function; throws `AtlasNoContextError` on absence; returns `string` on success. T105 tests turn GREEN.
  - **Depends on:** T013, T105

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
  - **Title:** Implement `core/concurrency-pool.ts` (`runWithConcurrency`) — GREEN
  - **Description:** Create `site/core/concurrency-pool.ts` exporting `runWithConcurrency<T>(jobs: Array<() => Promise<T>>, cap: number, signal: AbortSignal): Promise<PromiseSettledResult<T>[]>`. Worker-pool pattern: at most `cap` jobs in-flight; preserves output order matching input order; honors `AbortSignal` (any subsequent jobs not yet started are not started; in-flight jobs are NOT aborted by this helper — they should respond to the same signal via their own AbortController-aware logic). Returns `Promise.allSettled`-shaped results. **TDD:** T103 (RED) committed first.
  - **Expected Output:** Generic helper; no SDK coupling; deterministic output ordering. T103 tests turn GREEN.
  - **Depends on:** T013, T016, T103

- **Task ID:** T018
  - **Title:** Implement `core/error-classifier.ts` — GREEN
  - **Description:** Create `site/core/error-classifier.ts` exporting `classifyError(err: unknown): SkipReason` mapping to `'forbidden' | 'timeout' | 'not_found' | 'network_error' | 'other'`. Recognize at minimum: 403 → `'forbidden'`, 404 → `'not_found'`, `DOMException name='AbortError'` if NOT a user cancel → `'timeout'`, network/fetch errors → `'network_error'`, else `'other'`. Handle the SDK error envelope shape from `client.md` § 8f when surfaced. **The 429 / rate-limit path is handled at the call-site retry layer** (T019); only after `maxRetries` is exhausted does the page get classified — and the classification at that point is `'network_error'` per ADR-0012. **TDD:** T101 (RED) committed first.
  - **Expected Output:** Pure function; deterministic classification; `'other'` is the catch-all. T101 tests turn GREEN.
  - **Depends on:** T013, T101

- **Task ID:** T019
  - **Title:** Implement `core/scan-config.ts` and rate-limit retry helper
  - **Description:** Create `site/core/scan-config.ts` exporting:
    ```ts
    export const SCAN_CONCURRENCY = 8;
    export const PER_PAGE_TIMEOUT_MS = 12_000;
    export const RATE_LIMIT_BACKOFF = { baseMs: 250, maxRetries: 4, jitterPercent: 20 } as const;
    ```
    Also implement `withBackoff<T>(fn: () => Promise<T>, isRateLimit: (err: unknown) => boolean, signal: AbortSignal): Promise<T>` that retries `fn` with exponential backoff + jitter on rate-limit errors, up to `maxRetries`. After exhaustion, throws the last error. Logs each retry via `core/telemetry.ts` (T072). (ADR-0012.)
  - **Expected Output:** Constants module + retry helper with deterministic backoff math. T104 tests turn GREEN. **TDD:** T104 (RED) committed first.
  - **Depends on:** T013, T016, T018, T072, T104

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
  - **Expected Output:** Pure function returning the four-field result; unit-testable in isolation. T100 tests turn GREEN. **TDD:** T100 (RED) committed first.
  - **Depends on:** T013, T018, T100

- **Task ID:** T025
  - **Title:** Implement `core/scan-state-machine.ts`
  - **Description:** Create `site/core/scan-state-machine.ts` documenting the allowed state transitions (per architecture § 4.1):
    ```
    idle → scanning
    scanning → completed | canceled | error
    completed | canceled | error → scanning
    (any) → idle (only via resetAtlas)
    ```
    Export `transitionTo(prev: AtlasState, next: AtlasState): AtlasState` that throws on disallowed transitions; export an `ALLOWED_TRANSITIONS` table for tests. **TDD:** T102 (RED) committed first.
  - **Expected Output:** State-machine helper + transition table; tests can assert the disallowed paths. T102 tests turn GREEN.
  - **Depends on:** T013, T102

- **Task ID:** T026
  - **Title:** Implement `core/atlas-freeze.ts`
  - **Description:** Create `site/core/atlas-freeze.ts` exporting `freezeAtlas(atlas: Atlas): Atlas`. Wraps the two `Map`s as `ReadonlyMap` (`Object.freeze` after construction — Maps freeze imperfectly, so the wrapper is a thin facade that throws on mutation in dev). `Object.freeze(atlas)` at root.
  - **Expected Output:** Helper; UI selectors must not mutate.
  - **Depends on:** T013

- **Task ID:** T027
  - **Title:** Implement `core/scan-engine.ts::runScan` — GREEN
  - **Description:** Create `site/core/scan-engine.ts` exporting `runScan(input: ScanInput): ScanHandle` where `ScanInput = { client: ClientSDK; contextId: string; scope: AtlasScope }` and `ScanHandle = { cancel: () => void; donePromise: Promise<void> }`. Steps:
    1. Set state to `scanning` (phase `'sites'`).
    2. `enumerateSites(client, contextId, scope)`.
    3. Phase `'sites'` complete; resolve site languages via `resolveSiteLanguage` (concurrency-pool, cap 8).
    4. Phase `'pages'`. For each site, `enumeratePages(client, contextId, site, language, signal)`. Flatten to `pageRefs[]`.
    5. Phase `'components'`. `runWithConcurrency(jobs = pageRefs.map(p => () => fetchComponents(client, contextId, p, signal)), cap = 8, signal)`.
    6. `buildIndices(pageRefs, results)`.
    7. `freezeAtlas(...)`. Set state to `completed` (or `canceled` if `signal.aborted` — partial atlas with `isPartial: true`).
    Use one shared `AbortBus` (T016) for the whole scan. On error in step 2 (sites fetch failed), set state to `error` with `{ kind: 'sites-fetch-failed', cause }`. Per-page failures are normal (`Promise.allSettled`) and end up in `skipped[]`. Emit telemetry events (T072) at every transition + start + complete + cancel + error.
  - **Expected Output:** `runScan` returns a `ScanHandle`; calling `cancel()` aborts; `donePromise` resolves once state is `completed | canceled | error`. T107 tests turn GREEN. **TDD:** T107 (RED integration tests) committed first.
  - **Depends on:** T013, T014, T015, T016, T017, T020, T021, T022, T023, T024, T025, T026, T072, T107

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
  - **Title:** Implement `<RenderingNameCell />` — GREEN
  - **Description:** Create `site/components/widget/rendering-name-cell.tsx`. Composes `@blok/badge` (for `· <last-7-of-id>` collision suffix) + `@blok/tooltip` (full ID on hover). Layout: display name + (when collision) badge + (small ID-copy `@blok/button variant="ghost" size="icon"` with copy icon). For unknown renderings, label is `(unknown rendering)` per ADR-0005. **TDD:** T110 (RED) committed first.
  - **Expected Output:** Cell renders names cleanly; collision suffix appears only when needed; ID is copyable. T110 tests turn GREEN.
  - **Depends on:** T013, T110

- **Task ID:** T045
  - **Title:** Implement collision-suffix utility (FR-9, ADR-0005) — GREEN
  - **Description:** Create `site/lib/collisions.ts` exporting `computeCollisions(renderings: ReadonlyArray<RenderingUsage>): Map<RenderingId, { suffix: string | null }>`. For each rendering, check whether any other rendering in the visible set shares the same display name. If yes, set `suffix = '· ' + lastN(renderingId, 7)`. Pure function; memoizable. **TDD:** T106 (RED) committed first.
  - **Expected Output:** Pure utility; unit-testable. T106 tests turn GREEN.
  - **Depends on:** T013, T106

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
  - **Title:** Implement `<CounterRow />` + states — GREEN
  - **Description:** Create `site/components/panel/counter-row.tsx`. States per v2 § 4.2: `loading`, `default`, `zero`, `missing`, `focused`, `hovered`. Counter typography:
    - `loading` → `@blok/skeleton`, 3ch wide.
    - `≥1` → `text-3xl font-bold tabular-nums text-primary`.
    - `0` → `text-3xl font-bold tabular-nums text-muted-foreground`; row `aria-disabled`.
    - `missing` → `<Icon name="alert-triangle" />` in `text-warning` + word `missing` in `text-xs uppercase tracking-wide text-warning`.
    Click opens drawer (when `count >= 1`). `aria-label="12 other pages use HeroV2"`.
  - **Expected Output:** Row component renders all states; states reinforce text where color is used (NFR-4.3). T108 tests turn GREEN. **TDD:** T108 (RED) committed first.
  - **Depends on:** T013, T031, T108

- **Task ID:** T052
  - **Title:** Active-page rendering stack + Datasource Impact group
  - **Description:** In `<PanelSurface />`, compose two `<CounterRow />` lists: (1) **Rendering stack** — one row per component on the active page (from per-page fetch). Counter shows skeleton until atlas resolves; resolves to "+N other pages" per `renderingIndex.get(renderingId).pages.length - 1`. (2) **Datasource impact** — one row per unique datasource bound on the active page; counter is "+N pages" via `datasourceIndex.get(dsId).pages.length`; missing datasources (per AC-2.5) show the warning glyph.
  - **Expected Output:** Two grouped lists with cross-tenant counters; missing datasources warned.
  - **Depends on:** T050, T051
  - **Reshape post-smoke (S22/S23, 2026-04-29 → 2026-04-30):** the standalone "Datasource impact" list (item 2) is **no longer mounted on the panel surface**. Each rendering row is now expandable and reveals the bound datasource inline with its own cross-tenant counter and a click-through to the per-datasource drawer. `<DatasourceImpactGroup />` remains in the codebase for potential widget-side reuse but `<PanelSurface />` only renders `<RenderingImpactList onSelectDatasource={…}>`. See `docs/architecture.md` § Page Context Panel and `components/atlas/rendering-impact-list.tsx` (S23 inline detail block). PRD AC-2.4 / FR-3.5 superseded notes track this in `project-planning/PRD/prd-000.md`.

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
  - **Title:** Implement `<ScanStatusBar />` — GREEN
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
  - **Expected Output:** Status bar renders all 6 states (`pending`, `scanning-sites`, `scanning-pages`, `scanning-components`, `completed`, `canceled`, `error`); cancel works; reduced-motion respected. T109 tests turn GREEN. **TDD:** T109 (RED) committed first.
  - **Depends on:** T013, T031, T033, T109

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
  - **Title:** "ⓘ Direct bindings only" affordance (FR-8.3, ADR-0006) — GREEN
  - **Description:** Create `site/components/info/direct-bindings-info.tsx`. Always-visible `@blok/badge` (icon ⓘ + text "Direct bindings only") with `@blok/tooltip` (or `@blok/popover` on narrow panels) revealing the lock copy from ADR-0006: *"Counts include datasources bound directly on the page's layout. Inherited (page designs), personalized, A/B variant, and token-resolved bindings are not counted in this version."* Mounted in Zone 2 of both surfaces. **The copy is locked** — do not paraphrase. **TDD:** T112 (RED) committed first; assertion is verbatim string equality with the ADR copy.
  - **Expected Output:** Badge always visible on both surfaces; tooltip / popover renders the locked copy verbatim. T112 tests turn GREEN.
  - **Depends on:** T007, T112

- **Task ID:** T081
  - **Title:** "(unknown rendering)" virtual row (AR-9)
  - **Description:** In `<WidgetTable />`, group all `RenderingUsage` entries with `isUnknown: true` under one virtual row labeled "(unknown rendering)". The drawer for this row expands to show per-page-with-placeholder breakdown (because each unknown placement was indexed under a synthetic ID `unknown:<page-id>:<placeholder>:<index>`).
  - **Expected Output:** Single virtual row in the table; drawer reveals per-page detail.
  - **Depends on:** T041, T063

- **Task ID:** T082
  - **Title:** Forbidden page handling at click-through (US-1 AC-1.5) — GREEN
  - **Description:** In page rows inside `<UsageDrawer />`, the `pages.context` mutate is the click-through. If the current `Atlas.skipped` contains the same `pageId` with reason `forbidden`, render the row as `aria-disabled` with a small "no access" tooltip and prevent the click handler from firing. Pages itself otherwise enforces permissions if a click slips through. (Belt and suspenders for IS-17 / NFR-3.) **TDD:** T111 (RED) committed first.
  - **Expected Output:** Forbidden pages don't navigate; rest navigate normally. T111 tests turn GREEN.
  - **Depends on:** T063, T111

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

### Tests (RED-first — see § 9.1; QA Specialist reordered these to come BEFORE implementations)

> **QA Specialist (07) reordering note.** Tasks T100–T112 are now **RED-write-failing-test** tasks. Each is the dependency of the corresponding GREEN implementation task in § 4 (T024 dep T100, T018 dep T101, T025 dep T102, T017 dep T103, T019 dep T104, T014 dep T105, T045 dep T106, T027 dep T107, T051 dep T108, T060 dep T109, T044 dep T110, T082 dep T111, T080 dep T112). Stable Task IDs preserved. Per-scenario detail lives in § 10.

- **Task ID:** T100
  - **Title:** RED — Unit tests for `index-builder.ts` (write failing tests BEFORE T024)
  - **Description:** Create `site/core/__tests__/index-builder.test.ts`. Per § 10 T024 scenarios (10 cases): (a) one rendering on N pages → `renderingIndex.pages.length === N`; (b) datasource bound on rendering → both indices populated and cross-referenced; (c) per-page rejected promise → `skipped[]` with classified reason; (d) unknown rendering → synthetic ID + `isUnknown: true`; (e) multiple unknowns on one page in different placeholders → distinct synthetic IDs; (f) inherited / token / personalized bindings absent (fixture with `parameters: { datasource: '{Tokenized}' }` must NOT appear in `datasourceIndex`); (g) totals computed; (h) deterministic ordering; (i) empty input → all-empty atlas; (j) pure function regression — no SDK imports / React / `console.*`. Stub `index-builder` if it doesn't yet exist with `throw new Error('not implemented')` so tests fail on assertion, not module resolution.
  - **Expected Output:** Vitest suite committed in failing state (RED). Deterministic, no SDK imports, fast (<200ms total). Implementation (T024) lifts these to GREEN.
  - **Depends on:** T013, T003

- **Task ID:** T101
  - **Title:** RED — Unit tests for `error-classifier.ts` (BEFORE T018)
  - **Description:** Create `site/core/__tests__/error-classifier.test.ts`. Per § 10 T018: cover all five reasons (`forbidden` 403, `not_found` 404, `timeout` AbortError-not-cancel, `network_error`, `other`) + SDK envelope shape from `client.md` § 8f + null/undefined inputs. Stub `classifyError` to throw initially.
  - **Expected Output:** Vitest suite committed in failing state (RED).
  - **Depends on:** T013, T003

- **Task ID:** T102
  - **Title:** RED — Unit tests for `scan-state-machine.ts` (BEFORE T025)
  - **Description:** Create `site/core/__tests__/scan-state-machine.test.ts`. Per § 10 T025: every cell in the state machine table from architecture § 4.1; allowed transitions succeed, disallowed throw with named `prev`/`next`; reset is the only path to `idle` from non-idle; `ALLOWED_TRANSITIONS` table exhaustive. Stub `transitionTo` to throw initially.
  - **Expected Output:** Vitest suite RED.
  - **Depends on:** T013, T003

- **Task ID:** T103
  - **Title:** RED — Unit tests for `concurrency-pool.ts` (BEFORE T017)
  - **Description:** Create `site/core/__tests__/concurrency-pool.test.ts`. Per § 10 T017: (a) cap=8 in-flight max (instrument via timestamp recording); (b) order preservation; (c) abort signal stops new jobs; (d) empty jobs → `[]`; (e) `cap > jobs.length` → all parallel.
  - **Expected Output:** Vitest suite RED.
  - **Depends on:** T013, T003, T016

- **Task ID:** T104
  - **Title:** RED — Unit tests for `withBackoff` retry helper (BEFORE T019)
  - **Description:** Create `site/core/__tests__/with-backoff.test.ts` AND `site/core/__tests__/components-fetcher.test.ts` (timeout case). Per § 10 T019: (a) zero rate-limit → fn invoked once; (b) one rate-limit → fn invoked twice; (c) maxRetries+1 → throws last error; (d) jitter empirical bounds; (e) abort during backoff cancels next retry; (f) constants exported correctly. Use vitest fake timers throughout.
  - **Expected Output:** Vitest suite RED.
  - **Depends on:** T013, T003, T016, T018

- **Task ID:** T105
  - **Title:** RED — Unit tests for `requireContextId` / `AtlasNoContextError` (BEFORE T014)
  - **Description:** Create `site/core/__tests__/context-resolver.test.ts`. Per § 10 T014: (a) `.live` present → returns it; (b) `.live` absent, `.preview` present → returns `.preview`; (c) both absent → throws `AtlasNoContextError`; (d) `ctx === null` → throws; (e) `ctx.resourceAccess` empty array → throws. Stub `requireContextId` to throw `'not implemented'` initially.
  - **Expected Output:** Vitest suite RED.
  - **Depends on:** T013, T003

- **Task ID:** T106
  - **Title:** RED — Unit tests for `computeCollisions` (BEFORE T045)
  - **Description:** Create `site/lib/__tests__/collisions.test.ts`. Per § 10 T045: distinct names → no suffix; two same name → both suffixed; three same name → all three suffixed; one rendering → no suffix; empty input → empty Map; purity (calling twice → same output).
  - **Expected Output:** Vitest suite RED.
  - **Depends on:** T013, T003

- **Task ID:** T107
  - **Title:** RED — Integration tests for scan engine with stubbed SDK (BEFORE T027)
  - **Description:** Create `site/core/__tests__/scan-engine.test.ts` using the typed stub pattern from `client.md` § 9 (`Mock<QueryFn>` etc.). Per § 10 T027 (8 scenarios): happy path; one site fails; cancel during components; all 403; rate-limit then success; strict-mode double-mount; `donePromise` resolves on terminal states; `donePromise` does not reject on error. Telemetry event-sequence assertions live in this file too (extends T073).
  - **Expected Output:** Vitest integration suite RED. Deterministic mocks; no real network.
  - **Depends on:** T013, T003, T032

- **Task ID:** T108
  - **Title:** RED — UI tests for `<CounterRow />` states (BEFORE T051)
  - **Description:** Create `site/components/panel/__tests__/counter-row.test.tsx` using `@testing-library/react`. Per § 10 T051: all six states (`loading`, `default`, `zero`, `missing`, `focused`, `hovered`); typography classes; `aria-disabled`/`aria-label`; reduced-motion collapses cross-fade.
  - **Expected Output:** Vitest+RTL suite RED.
  - **Depends on:** T013, T003

- **Task ID:** T109
  - **Title:** RED — UI tests for `<ScanStatusBar />` accessibility (BEFORE T060)
  - **Description:** Create `site/components/loading/__tests__/scan-status-bar.test.tsx`. Per § 10 T060: `role="status" aria-live="polite" aria-atomic="true"`; phase transitions announced once per phase (not per page); `aria-label="Cancel scan"`; reduced-motion collapses pulse to static fill.
  - **Expected Output:** Vitest+RTL suite RED.
  - **Depends on:** T013, T003

- **Task ID:** T110
  - **Title:** RED — UI tests for `<RenderingNameCell />` collision rendering (BEFORE T044)
  - **Description:** Create `site/components/widget/__tests__/rendering-name-cell.test.tsx`. Per § 10 T044: distinct names → no suffix; two distinct rendering IDs sharing a name → both render with suffix; tooltip exposes full ID; unknown rendering → label `(unknown rendering)`; ID copy writes FULL ID. Note: collision logic comes from T045 (T044 calls `computeCollisions`); test should mock the collision result OR depend on T106's RED helper having shipped.
  - **Expected Output:** Vitest+RTL suite RED.
  - **Depends on:** T013, T003, T106

- **Task ID:** T111
  - **Title:** RED — UI tests for forbidden / disabled drawer rows (BEFORE T082)
  - **Description:** Create `site/components/drawer/__tests__/forbidden-rows.test.tsx`. Per § 10 T082: `Atlas.skipped` containing pageId with reason `forbidden` → drawer row `aria-disabled="true"` + no-access tooltip; click does NOT call `client.mutate('pages.context')`. Note: this test depends on `<UsageDrawer />` (T063) being implementable — for RED, mock its dependencies and assert the row component contract.
  - **Expected Output:** Vitest+RTL suite RED.
  - **Depends on:** T013, T003

- **Task ID:** T112
  - **Title:** RED — UI tests for "Direct bindings only" affordance always-visible (BEFORE T080)
  - **Description:** Create `site/components/info/__tests__/direct-bindings-info.test.tsx`. Per § 10 T080: rendered in DOM in all four primary states (`idle`, `scanning`, `completed`, `error`) on BOTH surfaces. Tooltip / popover copy matches ADR-0006 § Decision verbatim — string equality, NOT "contains".
  - **Expected Output:** Vitest+RTL suite RED.
  - **Depends on:** T013, T003

- **Task ID:** T113
  - **Title:** Manual / E2E (real-portal) test plan
  - **Description:** Document the manual smoke test set in `site/docs/manual-tests.md` (or wherever lifelong runbooks live for the project) so QA can re-run after each release. Cases: scan completion at thousands-of-pages scale; cancel-with-act; collision suffix; "Direct bindings only" copy; in-memory only (no localStorage entries after scan); datasource impact pre-change; permission-denied skipped reasoning; search filtering; cross-tenant counter accuracy. (No Cypress/Playwright in v1 — DoD doesn't require it; real portal smoke is the integration test per `lifecycle.md` § 9a; host-frame visual testing recipe lives in `.agent/skills/sitecore/marketplace-sdk/host-frame-testing.md`.)
  - **Expected Output:** A short manual-test runbook the dogfood team can follow.
  - **Depends on:** T094

---

## 4b. Important Test Cases (by epic / feature)

> **QA Specialist (07) note:** This section is the **traceable behavioral test catalog**. Every case below is a test users can perceive — no trivial identity checks ("expect true"), no "it renders without crashing," no tautologies. Each row names: scenario, test type (`unit | integration | UI | E2E | host-frame | regression | a11y | CI`), and the Task ID(s) it traces to (per-task spec in § 10). Cases marked `host-frame` follow `.agent/skills/sitecore/marketplace-sdk/host-frame-testing.md` — the canonical visual test target is the **clipped iframe inside the live host**, NOT a standalone `localhost:3000` render. Items the v1 architecture cannot test deterministically (e.g., S6 "felt fast" pulse, real-tenant rate-limit pressure) are flagged at § 9 with proposed paths.

### E1 — Marketplace scaffold + lifecycle wiring

| # | Scenario | Type | Traces to |
|---|----------|------|-----------|
| E1-T1 | `/widget` URL resolves to widget surface in production deploy via real portal install (cold smoke) | host-frame + manual | T009, T093, T094 |
| E1-T2 | `/panel` URL resolves to panel surface in production deploy via real portal install (cold smoke) | host-frame + manual | T010, T093, T094 |
| E1-T3 | `/` returns Next.js 404 — local AND deploy (ADR-0014 enforcement; regression against accidental edits to `app/page.tsx`) | regression + UI | T008 |
| E1-T4 | All four PNA / CORS headers present on every Next response; `Access-Control-Allow-Credentials` is NOT combined with `Origin: *` (browser would reject) | integration + manual | T004 |
| E1-T5 | `npm run typecheck && npm run lint && npm run test && npm run build` exit 0 on a clean scaffold post-T002 (so § 4 task additions don't silently break the green baseline) | CI | T002, T003, T090 |
| E1-T6 | Lint fixes preserve scaffold shape — `marketplace.tsx` retains `MarketplaceProvider` export with same call signature; only the typo + apostrophe escape changed (regression — Lead Developer signoff) | regression | T002 |
| E1-T7 | Vitest setup loads `@testing-library/jest-dom` matchers; sample `expect(el).toBeInTheDocument()` compiles AND runs | integration | T003 |

### E2 — Scan engine (load-bearing)

| # | Scenario | Type | Traces to |
|---|----------|------|-----------|
| E2-T1 | **Scan completion at thousands-of-pages scale (NFR-1.1, S3):** stubbed-SDK fixture of 2,000 pages across 20 sites completes within a wall-clock budget consistent with NFR-1.1 (≤30s on real broadband; budget for the unit-test stub is "no per-page work outside the engine takes >5ms"); concurrency cap 8 is observed throughout (no >8 in-flight at any sample). | integration | T103, T107 |
| E2-T2 | **Cancel-with-act behavior (PRD F-3 / S4):** mid-scan `cancelScan()` aborts in-flight; state transitions to `canceled` with `isPartial: true`; partial atlas exposes the renderings/datasources collected so far AND the pages that were never reached. User then clicks a result row → `client.mutate('pages.context', { params: { itemId } })` fires with the correct itemId. | integration + UI | T107, T111 |
| E2-T3 | **Display-name collision suffix (ADR-0005, FR-9):** two distinct `RenderingId`s share display name `HeroV2` → both rows in `<WidgetTable />` render `HeroV2 · <last-7-of-id>` suffix; tooltip on each badge contains the full distinct rendering ID; index keys are by rendering ID (NOT display name). | unit + UI | T106, T110 |
| E2-T4 | **Direct bindings only affordance (ADR-0006, FR-8.3):** `<DirectBindingsInfo />` is in DOM on **both** surfaces in **all four** primary states (`idle`, `scanning`, `completed`, `error`); tooltip / popover copy matches ADR-0006 § Decision verbatim (string equality, not "contains"). | UI + regression | T112, T080 |
| E2-T5 | **In-memory only / no persistence (ADR-0003):** after a full scan run via `<WidgetSurface />` mount → `localStorage.length === 0`, `sessionStorage.length === 0`, `document.cookie` unchanged from baseline, no IndexedDB databases created; verified by a regression hand-audit at ship via `grep -RE 'localStorage\\.|sessionStorage\\.|indexedDB\\.|document\\.cookie' core/ lib/ components/ app/` returning zero matches outside test files. | regression + integration | T091 (extended), T030, T040, T050 |
| E2-T6 | **Datasource impact pre-change (G3):** editor on a page with rendering `HeroV2` bound to datasource `/.../Heroes/X` → panel datasource impact group shows row for `Heroes/X` with skeleton; once global scan resolves the row reads "+N pages"; clicking the counter opens `<UsageDrawer />` with a "Via datasource" section listing the cross-tenant page list ordered by site. | integration + host-frame | T052, T063 |
| E2-T7 | **Permission-denied skipped pages reasoning (FR-7.2):** stubbed tenant returning 403 on N specific pageIds → `Atlas.skipped` has exactly N entries each with reason `'forbidden'` and the matching pageId; the renderings on those pages are NOT counted in `renderingIndex`; KPI cell SKIPPED shows `N`; clicking SKIPPED opens `<SkippedDrawer />` grouped by reason with `forbidden` chips in `text-destructive` AND the word `forbidden` (color is not the only signal — NFR-4.3). | unit + UI | T101, T064 |
| E2-T8 | **Search filtering (FR-2.3):** typing partial display name in `<SearchInput />` post-scan → table rows filter client-side; no `client.query` calls fire (assert via spy on `useMarketplaceClient` mock); 80ms debounce respected (consecutive typing within 80ms causes a single filter pass). | UI | T042 |
| E2-T9 | **Cross-tenant counter accuracy (US-2 AC-2.2):** for any rendering `R` present on the active page `P`, `<CounterRow />` for `R` reads the value `renderingIndex.get(R).pages.length - 1` (the active page itself excluded from the "+N other pages" count); when `R` is unique to `P`, counter reads `0` and the row renders the `zero` state with `aria-disabled`. | unit + UI | T108, T052 |
| E2-T10 | **Backoff on rate-limit (ADR-0012):** stubbed `pagesGetComponentsOnPage` throws a 429-shaped error twice then succeeds → `withBackoff` retries with delays roughly matching `250 * 2^n ± 20% jitter`; after success, atlas contains the components from that page; one `rate_limit_retry` telemetry event per retry. After `maxRetries` (4) exhaustion, page lands in `skipped[]` with reason `'network_error'`. | unit | T104 |
| E2-T11 | **Per-page timeout (ADR-0012):** stubbed `pagesGetComponentsOnPage` never resolves → after `PER_PAGE_TIMEOUT_MS = 12_000` (use vitest fake timers), the page rejects with timeout; classified as `'timeout'` reason in skipped; in-flight is properly cancelled (no dangling promise warnings). | unit | T104, T103 |
| E2-T12 | **State machine — disallowed transition guard:** attempting `idle → completed` (without going through `scanning`) throws; allowed transitions per architecture § 4.1 succeed; reset via `resetAtlas()` is the ONLY path to `idle` from any non-idle state. | unit | T102 |
| E2-T13 | **Concurrency-pool order preservation:** input job order `[j0, j1, ..., j99]` with random per-job latencies → output `PromiseSettledResult[]` index positions match input positions (so callers can zip pageRefs to results without re-sorting). | unit | T103 |
| E2-T14 | **Abort propagation across scan steps:** `cancel()` invoked during `'pages'` phase aborts site-language resolution AND prevents any new `pagesGetComponentsOnPage` calls; in-flight calls (already started) honor the same `signal`. | integration | T107 |

### E3 — Atlas state model

| # | Scenario | Type | Traces to |
|---|----------|------|-----------|
| E3-T1 | **Module singleton survives React 18 strict-mode double-mount:** mounting `<WidgetSurface />` under `<React.StrictMode>` triggers two effects but `runScan` fires only once (`scanInFlight` guard). | integration | T030 |
| E3-T2 | **`useAtlasSlice` referential stability:** with state unchanged, repeated `getSnapshot()` calls return `===` value; selector returning a stable projection causes React's `useSyncExternalStore` to bail out of re-render. | unit + UI | T031 |
| E3-T3 | **`__resetForTest()` throws outside `NODE_ENV === 'test'`:** importing the module under non-test env and calling `__resetForTest()` throws `'__resetForTest may only be called in tests'`. | unit | T032 |
| E3-T4 | **Frozen atlas — mutation throws in dev:** attempting to set a key on the returned `renderingIndex` Map throws (in dev), preserving the immutable contract (ADR-0010). | unit | T026 |

### E4 — Widget surface

| # | Scenario | Type | Traces to |
|---|----------|------|-----------|
| E4-T1 | **Sortable Total column:** default sort is `desc`; clicking the header toggles to `asc`; second click toggles back; both sorts are stable (rows with equal totals retain prior order — important for collision suffix readability). | UI | T108-WIDGET (see § 10) |
| E4-T2 | **Keyboard navigation (NFR-4.1):** focus enters table on Tab; arrow Down moves focus to next row; arrow Up to previous; Enter opens `<UsageDrawer />`; Esc closes drawer and returns focus to the row that opened it. | UI + a11y | T108-KBD (see § 10) |
| E4-T3 | **KPI SKIPPED cell click → opens skipped sub-drawer (T064):** click target has `role="button"` (or is a `<button>`); `aria-label="Skipped pages: <N>"`; click opens `<SkippedDrawer />` with the same focus-trap pattern. | UI + a11y | T043, T064 |
| E4-T4 | **Mini-bar `aria-hidden="true"`** so screen readers don't read the decorative ratio bar; the numerical "Pages" column carries the data. | a11y | T041 |
| E4-T5 | **Density toggle persists per tab (no localStorage — ADR-0003):** changing density in widget #1 does NOT affect a second tab/iframe; refreshing the tab resets to default `compact`. | UI + regression | T048 |
| E4-T6 | **Scope picker (US-3 AC-3.4 / 3.5 / 3.6):** one-collection tenant → picker `disabled` with helper text; zero-collection tenant → picker hidden; collection with zero sites → option absent from dropdown. | UI | T047 |
| E4-T7 | **Refresh atlas keeps prior result visible (FR-2.5 / AC-3.2):** during the new scan, table still renders previous data; replaced atomically when new scan completes. | UI + integration | T046, T033 |
| E4-T8 | **`<RenderingNameCell />` ID copy:** copy button writes the FULL rendering ID to clipboard (mock `navigator.clipboard.writeText`); not the truncated suffix. | UI | T044 |
| E4-T9 | **Visual fidelity vs POC (host-frame):** clipped widget iframe screenshot in real portal vs `pocs/poc-v2/` rendered at the iframe's clip width — PASS on layout, typography, color, anatomy, state per `host-frame-testing.md` § 6 five axes. | host-frame | T094 |

### E5 — Panel surface

| # | Scenario | Type | Traces to |
|---|----------|------|-----------|
| E5-T1 | **First paint <1s on a 5k-page mock tenant (OQ-A5 / FR-3.3):** panel issues per-page `pagesGetComponentsOnPage` on a separate `AbortBus`; rendering stack rendered before global scan completes; counters render skeleton until atlas resolves. Time budget asserted via vitest fake timers + spy. | integration | T050 |
| E5-T2 | **Page-switch via `pages.context` subscribe (D10 / AR-5):** simulated subscription notification with new pageId → Zone 3 re-paints; Zone 1 (status bar) and Zone 2 (disclosure strip) unchanged; global scan handle is NOT cancelled. | integration + UI | T053 |
| E5-T3 | **Cross-fade collapses under `prefers-reduced-motion`:** with the media query mocked to `reduce`, page-switch swap is instant (no opacity transition). | UI + a11y | T053 |
| E5-T4 | **Missing datasource (AC-2.5):** datasource bound on a page is missing from `datasourceIndex` because no other page references it AND no metadata returned → row renders `<Icon name="alert-triangle" />` in `text-warning` + word `missing` + `referenced by N pages` text. Color is NOT the only signal (NFR-4.3). | UI + a11y | T051, T052 |
| E5-T5 | **Narrow viewport (<420 px) reflow:** scope picker collapses behind kebab; status bar wraps to 2 lines; counter typography drops one tier (`text-2xl` instead of `text-3xl`); drawer takes 90% width. | UI | T054 |
| E5-T6 | **Panel error boundary isolation (architecture § 7):** throwing inside `<PanelSurface />` shows panel error state but does NOT unmount `<WidgetSurface />` if both surfaces happen to be mounted (in tests via separate render trees). | integration | T040, T050 |

### E6 — Loading visual + drawer

| # | Scenario | Type | Traces to |
|---|----------|------|-----------|
| E6-T1 | **Status bar `aria-live="polite" aria-atomic="true"`** announces phase transitions ONCE per phase, NOT per page (FR-5 / AC-4.x / NFR-4.2). | a11y + UI | T109 |
| E6-T2 | **Cancel button labeled `aria-label="Cancel scan"`** and triggers `cancelScan` which calls `currentHandle.cancel()`. | UI + a11y | T109, T060 |
| E6-T3 | **Slow-connection hint at >5s with no progress (AC-4.4):** instrument `progress.current` unchanged for 5 seconds → small hint "Slow connection — retrying" + "Try again" button rendered below the bar; hint disappears on next progress tick. | UI | T062 |
| E6-T4 | **CSS animation uses `transform`/`opacity` only (DoD-6 / AR-8):** computed style on the active segment shows pulse via `opacity` keyframe; `prefers-reduced-motion: reduce` collapses pulse to static fill (`animation: none`). | UI + a11y | T060 |
| E6-T5 | **`<UsageDrawer />` two sections separated by `<Separator />`** with headers "Direct rendering usage" and "Via datasource"; each renders its page rows; "Via datasource" only shows if any datasources exist for the rendering. | UI | T063 |
| E6-T6 | **Drawer click-through (FR-6.1):** clicking a page row inside Direct usage section calls `client.mutate('pages.context', { params: { itemId: pageRef.pageId } })` exactly once with the right itemId; the drawer closes after the mutate resolves. | integration + UI | T063 |
| E6-T7 | **Drawer Esc closes + focus return (NFR-4.1):** press `Esc` while drawer open → drawer closes; focus returns to the row that opened it; `@blok/kbd` Esc hint visible in footer. | UI + a11y | T063 |
| E6-T8 | **Skipped sub-drawer reinforces text on color (NFR-4.3):** `forbidden` chips render in destructive AND with the word `forbidden`; `timeout` chips in warning AND with the word `timeout`. | UI + a11y | T064 |
| E6-T9 | **Empty / error states (PRD § 11.3):** all four copy strings render verbatim — W4, W5/P5, empty tenant, search zero matches. | UI | T065 |

### E7 — Telemetry + observability

| # | Scenario | Type | Traces to |
|---|----------|------|-----------|
| E7-T1 | **Event sequence determinism:** every successful scan emits in order: `surface_mounted` → `scan_started` → `phase_transition` (sites) → `phase_transition` (pages) → `phase_transition` (components) → `scan_completed`. Cancel mid-scan replaces `scan_completed` with `scan_canceled`. Error replaces with `scan_error`. | integration | T072, T073 |
| E7-T2 | **No-PII contract (NFR-5.3, ADR-0013):** every emitted `TelemetryEvent` JSON-stringified contains NO `displayName`, no `sitePath`, no datasource path, no editor names, no tenant identifiers — schema enforced by a hand-audit unit test that walks all event kinds with representative fixtures. | regression + unit | T073 |
| E7-T3 | **Anti-metric guard (DoD-4):** introducing the literal string `scans_per_minute` to any file under `core/`, `lib/`, `components/`, `app/` causes `npm run check:antimetrics` to exit non-zero AND print the offending file:line. Three forbidden strings: `scans_per_minute`, `api_calls_served`, `session_count`. | CI | T075, T091 |
| E7-T4 | **Ring buffer cap 500:** emit 600 events → buffer length is exactly 500; oldest 100 dropped (FIFO). | unit | T072 |
| E7-T5 | **`console.info` mirror:** every `track()` call also fires `console.info("[CUA]", event)`. Asserted via `vi.spyOn(console, 'info')`. | unit | T072 |
| E7-T6 | **`<DebugPanel />` gated by `?debug=1`:** absent → no DOM; present → buffer rendered; copy-to-clipboard writes JSON.stringify(buffer) to `navigator.clipboard.writeText`. | UI | T074 |

### E8 — Edge handling

| # | Scenario | Type | Traces to |
|---|----------|------|-----------|
| E8-T1 | **(unknown rendering) virtual row (AR-9):** page with a rendering missing `renderingId` → synthetic ID `unknown:<page-id>:<placeholder>:<index>`; widget table renders ONE virtual row labeled `(unknown rendering)` with a count equal to the number of synthetic entries; drawer expands per-page-with-placeholder breakdown. | unit + UI | T100, T081 |
| E8-T2 | **Forbidden drawer rows (US-1 AC-1.5 / NFR-3 belt-and-suspenders):** when `Atlas.skipped` contains a pageId with reason `forbidden`, the corresponding `<UsageDrawer />` row renders `aria-disabled="true"` with tooltip "no access"; clicking the row does NOT call `client.mutate('pages.context', ...)`. | UI + a11y | T111, T082 |
| E8-T3 | **No tenant context (PRD § 11.3, OQ-A6):** `requireContextId` throws → root `<ErrorStates>` renders the locked copy "Atlas needs a tenant connection — please reload the dashboard." with NO retry button. | UI | T065, T014 |
| E8-T4 | **Inherited / personalized / token-resolved bindings excluded (FR-8.2 / ADR-0006):** fixture page with `parameters` containing a token expression (e.g., `{Datasource}`) NOT counted in `datasourceIndex`; only direct `datasource.itemId` from `pagesGetComponentsOnPage` is counted. | unit | T100 |

### E9 — Build / CI / release

| # | Scenario | Type | Traces to |
|---|----------|------|-----------|
| E9-T1 | **All-green gate:** `npm run typecheck && npm run lint && npm run test && npm run build` exits 0 on every PR push to `prd-000`; no warnings in `tsc --noEmit` other than scaffold-default. | CI | T090 |
| E9-T2 | **Anti-metric guard (DoD-4):** `npm run check:antimetrics` exits 0 on every PR. | CI | T091 |
| E9-T3 | **No raw external network (NFR-5.2 / DoD-1):** `grep -RE 'fetch\\(|XMLHttpRequest|sendBeacon' --include='*.ts' --include='*.tsx' core/ lib/ components/ app/` matches only entries inside `client.query/mutate` (which routes through `@sitecore-marketplace-sdk/*`). Manual hand-audit at ship; ideally codified as a script in T091. | CI + manual | T091 |
| E9-T4 | **Real-portal smoke covers all five user stories (DoD-2):** test tenant ≥500 pages, ≥2 sites, ≥1 collection; capture clipped iframe screenshots per `host-frame-testing.md`; compare against `pocs/poc-v2/` on five axes; record in friction log. | host-frame + manual | T094 |
| E9-T5 | **CATALOG row recorded:** `.agent/skills/sitecore/marketplace-sdk/CATALOG.md` has a new run-row capturing the SDK versions + Blok components installed for this run. | manual | T005, T094 |

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

### Ordering constraints (prose) — **REWRITTEN BY QA SPECIALIST FOR TEST-FIRST**

- The **scaffold task (T001)** must come first — every subsequent file lands in `site/`.
- **Lint fix (T002)** is a precondition for any later task that adds files and runs `npm run lint` as part of its acceptance.
- **Test stack (T003)** is a precondition for **every** RED test task (T100–T112). It now sits at the head of the order with T002, before any test or implementation work.
- **PNA headers (T004)** are not a logical precondition for code, but are required before any real-portal install (T093+).
- **SDK pin + shape verification (T005)** must run **before** types are finalized (T013) — they have a circular relationship; in practice T013 is done first as a strawman, and T005 updates it. Listed here as `T005 depends on T013` (can be revisited for tightening).
- **Domain types (T013)** are imported by every `core/`, `lib/sdk/`, and **test** module — must come before T014..T024 AND before T100..T112.
- **TDD ordering (NEW):** every RED test task (T100..T112) must precede its corresponding GREEN implementation task. The implementation Depends-on the RED task. RED tests are committed in failing state — the only way they go GREEN is via the implementation.
- **`atlas-store.ts` (T030)** must exist before the scan-engine orchestrator (T027) wires telemetry + state transitions, and before any surface (T040, T050) subscribes. `runScan` (T027) sets state via `setAtlasState`, so T027 depends on T030.
- **Surfaces (T040, T050)** depend on the engine + state being implementable; they trigger scans via `atlas-actions.ts` (T033).
- **UI primitives** (Blok components — T007) gate every visual task; UI RED tests can use mocked Blok components or test-utility wrappers, so they need not depend on T007.
- **Build/CI (T090)** depends on every implementation task.
- **Real-tenant smoke (T094)** depends on Vercel deploy (T092) and Cloud Portal registration (T093).

### Execution order (numbered list of every Task ID — RED-first, used by the execution agent to implement in dependency order)

> **TDD shape (per § 9.1):** RED tests are committed BEFORE their corresponding implementations. Steps labeled `[RED]` write a failing test; `[GREEN]` lifts it to passing; `[NON-CODE]` is install / scaffold / docs. Stable Task IDs preserved.

1. T001 — Scaffold the Marketplace Client-Side app `[NON-CODE]`
2. T002 — Apply quickstart lint fixes (P-019) `[NON-CODE]`
3. T003 — Install test stack + tsconfig types patch `[NON-CODE]` (precondition for every RED test)
4. T004 — Add Chrome Local Network Access headers `[NON-CODE]`
5. T006 — Install Blok theme `[NON-CODE]`
6. T007 — Install required Blok components `[NON-CODE]`
7. T008 — Create root route → `notFound()` `[GREEN]` (regression-tested manually)
8. T009 — Scaffold widget route entry `[NON-CODE]` (placeholder; T040 fills)
9. T010 — Scaffold panel route entry `[NON-CODE]` (placeholder; T050 fills)
10. T011 — Document local smoke-test rule in product README `[NON-CODE]`
11. T012 — Create `lib/sdk/client.ts` (re-exports) `[GREEN]`
12. T013 — Define domain types in `lib/sdk/types.ts` `[NON-CODE]` (types only)
13. T005 — Pin SDK versions; verify shapes (OQ-A1, OQ-A2) `[NON-CODE]`
14. **T100 [RED]** — Unit tests for `index-builder.ts`
15. **T101 [RED]** — Unit tests for `error-classifier.ts`
16. **T102 [RED]** — Unit tests for `scan-state-machine.ts`
17. **T105 [RED]** — Unit tests for `requireContextId` / `AtlasNoContextError`
18. **T106 [RED]** — Unit tests for `computeCollisions`
19. T016 — Implement `core/abort-bus.ts` `[GREEN]` (no RED predecessor — utility under T013; tests in T103 cover via integration)
20. **T103 [RED]** — Unit tests for `concurrency-pool.ts`
21. **T104 [RED]** — Unit tests for `withBackoff` retry helper
22. T014 — Implement `core/context-resolver.ts` `[GREEN]` (lifts T105 RED → GREEN)
23. T017 — Implement `core/concurrency-pool.ts` `[GREEN]` (lifts T103)
24. T018 — Implement `core/error-classifier.ts` `[GREEN]` (lifts T101)
25. T072 — Implement `core/telemetry.ts` `[GREEN]` (own unit tests in § 10 T072 — write inline RED+GREEN as part of this task)
26. T019 — Implement `core/scan-config.ts` and `withBackoff` `[GREEN]` (lifts T104)
27. T015 — Implement `lib/sdk/queries.ts` `[GREEN]`
28. T020 — Implement `core/sites-enumerator.ts` `[GREEN]`
29. T021 — Implement `core/site-language-resolver.ts` `[GREEN]`
30. T022 — Implement `core/pages-enumerator.ts` `[GREEN]`
31. T023 — Implement `core/components-fetcher.ts` `[GREEN]`
32. T024 — Implement `core/index-builder.ts` (pure) `[GREEN]` (lifts T100)
33. T025 — Implement `core/scan-state-machine.ts` `[GREEN]` (lifts T102)
34. T026 — Implement `core/atlas-freeze.ts` `[GREEN]` (own RED+GREEN inline)
35. T030 — Implement `core/atlas-store.ts` module singleton `[GREEN]` (own RED+GREEN inline; per § 10 T030)
36. T032 — Add `__resetForTest()` helper `[GREEN]` (within T030's test file)
37. T031 — Implement `core/use-atlas-slice.ts` `[GREEN]`
38. **T107 [RED]** — Integration tests for scan engine with stubbed SDK
39. T027 — Implement `core/scan-engine.ts::runScan` `[GREEN]` (lifts T107)
40. T033 — Wire scan triggers into atlas-store actions `[GREEN]`
41. T045 — Implement collision-suffix utility `[GREEN]` (lifts T106)
42. **T108 [RED]** — UI tests for `<CounterRow />` states
43. **T109 [RED]** — UI tests for `<ScanStatusBar />` accessibility
44. **T110 [RED]** — UI tests for `<RenderingNameCell />` collision rendering
45. **T111 [RED]** — UI tests for forbidden / disabled drawer rows
46. **T112 [RED]** — UI tests for "Direct bindings only" affordance always-visible
47. T044 — Implement `<RenderingNameCell />` `[GREEN]` (lifts T110)
48. T060 — Implement `<ScanStatusBar />` `[GREEN]` (lifts T109)
49. T046 — Implement `<FreshnessRibbon />` + Refresh atlas `[GREEN]`
50. T047 — Implement `<ScopePicker />` `[GREEN]`
51. T048 — Implement density toggle (with fallback) `[GREEN]`
52. T080 — "Direct bindings only" affordance `[GREEN]` (lifts T112)
53. T063 — Implement `<UsageDrawer />` `[GREEN]`
54. T064 — Implement skipped-pages sub-drawer `[GREEN]`
55. T065 — Implement Empty / Error states `[GREEN]`
56. T043 — Implement `<KpiRail />` `[GREEN]`
57. T041 — Implement `<WidgetTable />` `[GREEN]`
58. T042 — Implement `<SearchInput />` `[GREEN]`
59. T040 — Implement `<WidgetSurface />` `[GREEN]`
60. T051 — Implement `<CounterRow />` `[GREEN]` (lifts T108)
61. T050 — Implement `<PanelSurface />` `[GREEN]`
62. T052 — Active-page rendering stack + Datasource Impact `[GREEN]`
63. T053 — Panel page-switch handler `[GREEN]`
64. T054 — Narrow-viewport adjustments for panel `[GREEN]`
65. T061 — Wire status bar / freshness ribbon swap into Zone 1 `[GREEN]`
66. T062 — Slow-connection hint `[GREEN]`
67. T081 — Unknown rendering virtual row `[GREEN]`
68. T082 — Forbidden page click-through prevention `[GREEN]` (lifts T111)
69. T073 — Wire telemetry emission across the engine and surfaces `[GREEN]`
70. T074 — Implement `<DebugPanel />` `[GREEN]`
71. T075 — Anti-metric guard script `[GREEN]`
72. T090 — All-green gate (typecheck + lint + test + build) `[CI]`
73. T091 — Ship checklist + anti-metric guard run `[CI + manual]`
74. T092 — Configure Vercel project root `[NON-CODE]`
75. T093 — Cloud Portal registration paste `[NON-CODE]`
76. T094 — Real-tenant smoke test `[host-frame + manual]`
77. T113 — Manual / E2E test plan documented `[NON-CODE]`

### Parallel groups (RED-first)

Within a group, tasks share the same dependency set and may run in parallel (Team Lead may spawn multiple Developer agents). Groups execute in order; a group starts only when ALL prior groups complete.

```
Group 1  (sequential — foundation):                 T001 → T002 → T003 → T004
Group 2  (parallel — non-code post-scaffold):       T006, T008, T009, T010, T011, T012, T013
Group 3  (sequential — depends on T013):            T005
Group 4  (parallel — non-code, depends on T006):    T007
Group 5  (parallel — RED unit tests, depends on T013, T003):
            T100 (index-builder), T101 (error-classifier), T102 (state-machine),
            T105 (context-resolver), T106 (collisions)
Group 6  (parallel — utilities, depends on T013):   T016 (abort-bus), T026 (atlas-freeze)
Group 7  (parallel — RED tests with extra deps):    T103 (concurrency-pool, deps T016), T104 (withBackoff, deps T016, T018)
Group 8  (parallel — GREEN, lifts RED tests):       T014 (lifts T105), T018 (lifts T101), T072 (telemetry)
Group 9  (sequential — depends on T013, T016, T018, T072, T104): T019 (withBackoff)
Group 10 (parallel — GREEN, lifts RED + new):       T017 (lifts T103), T015 (queries; deps T012, T013, T014)
Group 11 (parallel — GREEN, depends on T015):       T020, T021, T022, T023
Group 12 (parallel — GREEN, lifts RED):             T024 (lifts T100), T025 (lifts T102)
Group 13 (sequential — depends on T013):            T030 → T031, T032 (within T030 file)
Group 14 (sequential — RED integration test, depends on T013, T003, T032): T107
Group 15 (sequential — GREEN, lifts T107):          T027 (deps T013..T026, T072, T107)
Group 16 (sequential — depends on T027, T030):      T033
Group 17 (parallel — RED UI tests, depend on T013, T003 +/- a peer): T108, T109, T110 (deps T106), T111, T112
Group 18 (sequential — GREEN, lifts RED UI tests):  T045 (lifts T106), then T044 (lifts T110)
Group 19 (parallel — GREEN UI primitives, depends on T013, T031, T033, T007):
            T060 (lifts T109), T046, T047, T048, T080 (lifts T112), T065
Group 20 (sequential — drawer chain):               T063 → T064
Group 21 (parallel — depends on T031, T064):        T043 (KPI rail)
Group 22 (parallel — depends on T044, T045):        T041 (widget table)
Group 23 (sequential — widget surface):             T042 → T040
Group 24 (sequential — panel surface):              T051 (lifts T108) → T050 → T052 → T053 → T054
Group 25 (parallel — final UI wiring):              T061, T062, T081, T082 (lifts T111)
Group 26 (parallel — telemetry wiring):             T073, T074, T075
Group 27 (sequential — gates):                      T090 → T091 → T092 → T093 → T094 → T113
```

The grouping above is a hint to the Team Lead — strictly sequential execution per § 5 numbered list also works and is the safer fallback for a single Developer agent. **The TDD invariant is enforced by Depends-on, not by group structure** — a Developer agent that picks up a `[GREEN]` task without first checking that the corresponding `[RED]` task is committed has violated the contract.

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

> **QA Specialist (07) — non-negotiable.** Component Usage Atlas implementation runs **test-first**: RED → GREEN → REFACTOR at every layer where automated tests apply. The Developer (08) does NOT write production code for a behavior before a failing test for that behavior exists. Where a task's nature is documentation, scaffolding, configuration, or a third-party install (e.g., T001 scaffold, T006 Blok theme install, T091 build pipeline config), the task is **labeled "no test debt — non-code task"** in § 10 and the Developer skips the RED step explicitly, NOT silently.

### 9.1 — RED → GREEN → REFACTOR mandate

For every implementation task that ships TypeScript, TSX, or test-relevant configuration:

1. **RED.** Write the failing test(s) for the behavior named in § 10 first. The test must fail for the **right reason** — i.e., because the behavior is not yet implemented, not because the import doesn't exist. (If the import doesn't exist, write a stub returning `throw new Error('not implemented')` so the test fails on assertion, not module resolution.)
2. **GREEN.** Implement the minimum code that makes the test pass. Do NOT generalize beyond the test's scope. If a sibling case isn't covered by the current test, leave it for the next RED cycle.
3. **REFACTOR.** With tests green, clean up: rename, deduplicate, extract helpers, remove dead branches. Tests must remain green after every refactor step.

**The test task is the dependency, not the consequence.** § 5 Execution order has been rewritten so that for every implementation task that has a unit/integration/UI test in § 10, the test task appears BEFORE the implementation task and the implementation `Depends on` the test task. (See T100–T112 — they are now RED-write-failing-test tasks scheduled before their corresponding implementations.)

### 9.2 — Layers covered

| Layer | Runner | Files / patterns | What gets tested |
|-------|--------|------------------|------------------|
| **Unit** | Vitest (`vitest run`) under `jsdom` | `core/**/*.test.ts`, `lib/**/*.test.ts` | Pure functions: scan-state machine transitions, atlas-store singleton (`__resetForTest()` between cases), identity resolution (`requireContextId`), backoff math (`withBackoff`), error classifier (`classifyError`), formatter / collision utility (`computeCollisions`), index-builder (the pure-function spine — FR-1.5 + FR-7.2 surface), telemetry ring buffer + console mirror. |
| **Integration** | Vitest under `jsdom` + typed SDK stubs (`Mock<QueryFn>` per `client.md` § 9) | `core/__tests__/scan-engine.test.ts`, atlas-store consistency tests, page-context subscribe tests | Scan engine end-to-end with stubbed SDK fixtures (no live calls); state singleton consistency under concurrent walk + strict-mode double mount; abort propagation across phases; subscribe-via-query (`pages.context`) callback wiring + cleanup on unmount. |
| **UI / component** | Vitest + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` | `components/**/*.test.tsx` co-located OR under `components/__tests__/` | Blok-composed components rendered with provider stubs: counters (`<CounterRow />`), search results (`<WidgetTable />` filtered), drawer open/close + focus trap (`<UsageDrawer />`), "Direct bindings only" affordance always-visible, "Skipped N pages" link presence with reason chips, cancel-with-act jump (cancel + click on visible row → `pages.context` mutate), keyboard navigation (arrow keys, Enter, Esc), `aria-live` announcements, `prefers-reduced-motion` collapses. |
| **E2E / host-frame** | Playwright MCP (interactive only) per `.agent/skills/sitecore/marketplace-sdk/host-frame-testing.md` | `test-evidence/<state>-host.png` + `<state>-poc.png` | Marketplace canonical visual test target is the **clipped iframe inside the live host** captured via the user-supplied host URL. Standalone-`localhost:3000` rendering is **NOT** a substitute (Marketplace apps depend on `XMC.host`/`XMC.context`/theme/locale/auth coming from the parent frame — they render blank or in error state outside of the host). The POC clickdummy at `pocs/poc-v2/` is the first-run ground truth (per `host-frame-testing.md` § 6). Comparison on five axes: layout & spacing, typography, color & contrast, component anatomy, state fidelity. |

### 9.3 — Marketplace-specific testing rules

- **Inputs are mandatory and user-supplied.** Host URL + app origin must come from the user. Do not guess; do not fall back to a localhost render. If either is missing at `/test` time, record visual testing as `deferred — host URL not supplied` with **WARN** verdict, NOT a silent skip.
- **Auth is interactive only.** Open the browser at the host URL, ask the user to log in, wait for `READY`. Never script SSO; never persist storage state across runs.
- **POC clickdummy is first-run ground truth.** Resolve `ui_design.selected_poc_path` from the run manifest (`products/component-usage-atlas/pocs/poc-v2`). Compare clipped host-frame screenshots side-by-side against the POC.
- **Do NOT silently promote host-frame screenshots to baselines.** If the design has changed and the POC is stale, raise a finding ("POC drift") and route it back through `/architect` step 3 — do not invent a new baseline.
- **Cross-origin iframe DOM read is restricted.** When state coverage requires reading the frame's DOM (e.g., computed styles), fall back to visual diff against the POC rather than working around the cross-origin barrier.
- **Standalone-localhost smoke (`/widget` or `/panel` directly) is acceptable as a build-passes sanity check ONLY** — it never substitutes for host-frame testing. The provider sits on the loader forever outside the portal (per § 4c-5 + ADR-0014); that is expected, not a bug.

### 9.4 — Anti-metric guard (special test class)

Per ADR-0013 + DoD-4. The implementation MUST include a guard test that fails if forbidden-strings (`scans_per_minute`, `api_calls_served`, `session_count`) are introduced anywhere under `core/`, `lib/`, `components/`, `app/`. Lives as `scripts/check-antimetrics.mjs` (T075) wired into `npm run check:antimetrics` AND surfaced in CI per E9-T2 / E9-T3.

**Anti-metric guard test (RED, must exist before T075's implementation passes):** create a tmpdir fixture with a file containing `scans_per_minute`, run the script, assert exit code !== 0 and stderr includes the offending path:line.

### 9.5 — Coverage gap call-outs (behaviors with no clean automated test path)

The following PRD behaviors have NO clean unit/integration/UI test path in v1; they ship with a documented manual verification step OR are explicitly deferred:

| Behavior | Why no automated test | Path |
|----------|----------------------|------|
| **S6 — "felt fast" pulse (PRD § 3 metric, OQ-2)** | Subjective signal from real editors; no synthetic timing measures perception. | Track via post-launch pulse instrument (T072 telemetry `pulse_response`); validity floor ≥30 responses (PRD § 3 R11). Document in T094 smoke report. |
| **NFR-1.1 — 30s on 1k pages on real broadband** | Test environment ≠ real broadband; synthetic harness can't model rate-limit response from real XMC. | T094 real-tenant smoke captures wall-clock time on the test tenant; flag if >30s; ≥10 samples per tenant size bucket per S3 floor. |
| **R2 — Real rate-limit response** | Stub fixtures simulate 429s; real endpoint behavior under sustained load is not modeled. | T094 smoke; if 429s observed, log as friction-log entry; revisit `RATE_LIMIT_BACKOFF` constants in T019. |
| **AR-8 — 60fps on low-spec laptop (DoD-6)** | Vitest+jsdom doesn't drive a real renderer. | T094 smoke; manual frame-rate check via Chrome devtools Performance panel; flag if jank visible. |
| **OQ-V2-3 — Marketplace iframe sandbox allows CSS keyframes** | Sandbox attribute set by host; only verifiable in real portal. | T094 smoke; if pulse animation absent, fall back to stripped progress bar (T060 already supports this). |
| **OQ-V2-4 — Panel drawer slide direction** | Pages-host layout determines which side `@blok/sheet` should slide from; no offline test. | T094 smoke; record in friction log; default `side="right"` and revisit if user feedback negative. |
| **AR-1 / OQ-A1 — `pagesGetComponentsOnPage` field-name verification** | SDK type names vary by version; offline tests use whatever the local SDK install ships. | T005 verifies at scaffold time; CATALOG row records the verified version (E9-T5). |

### 9.6 — Test naming + location conventions

- File naming: `<source-name>.test.ts` (or `.test.tsx` for UI), co-located in `__tests__/` directory next to the source folder.
- `describe` blocks scoped per public exported function or component identifier; `it` titles read as behavioral assertions: `it('builds renderingIndex with one entry per distinct rendering ID', ...)`.
- Setup: `beforeEach(__resetForTest)` for any test that imports `core/atlas-store.ts` directly. No shared mutable state across tests.
- Mocks: typed SDK stubs per `client.md` § 9 — `as never` is permitted ONLY on `vi.fn(...)` resolved values; `as unknown as ClientSDK` is permitted ONLY on the assembled stub object.
- No real network. No `@sitecore-marketplace-sdk/*` real init in unit / integration tests — always stub the SDK at the `lib/sdk/queries.ts` boundary or use the typed `client.query` mock.
- Vitest fake timers: use for backoff-math, per-page-timeout, and slow-connection-hint tests. Never `setTimeout` real waits in tests.

---

## 10. Per-task test specifications

> **QA Specialist (07).** One row per Task ID. **Test type** is one of: `unit | integration | UI | E2E | host-frame | regression | a11y | CI | manual | non-code`. `non-code` tasks (scaffolding, install, manual portal config) are labeled explicitly so the Developer knows there is no test debt — NOT a silent skip. **File location** suggests where the test lives in the repo; the Developer may rename if a clearer convention emerges. **Scenarios** name behavior, NOT implementation detail. Each implementation task with a unit/UI test now Depends-on the corresponding RED test task per § 5.
>
> **Reading order for Developer (08):** (1) read the test scenarios for the task you're about to implement; (2) write the test file (RED); (3) confirm the test fails on assertion (not import); (4) implement the minimum to GREEN; (5) refactor; (6) move on.

### Epic E1 — Marketplace scaffold + lifecycle wiring

#### T001 — Scaffold the Marketplace Client-Side app under `site/`
- **Test type:** `non-code` (scaffold via official command).
- **Acceptance verification:** post-scaffold, `site/package.json` exists at top level, `site/next-app/` does NOT exist (flatten succeeded), `app/layout.tsx` wraps `<MarketplaceProvider>`. Verified by visual inspection + `ls`.
- **No test debt** — scaffolding is the install, not a behavior we own.

#### T002 — Apply quickstart lint fixes (P-019)
- **Test type:** `CI`.
- **Scenario:** `npm run lint` exits 0 from `site/`. Verifies typo fix + apostrophe escape.
- **File location:** none — CI gate.
- **Failure mode to avoid:** suppressing the lint rule rather than fixing the typo. The fix is content-level, not config-level.

#### T003 — Install test stack + tsconfig types patch
- **Test type:** `CI` + `integration`.
- **Scenarios:**
  1. `npm run test` exits 0 (zero tests is acceptable but stack must load).
  2. `npm run typecheck` exits 0 (types resolution for `vitest/globals` + `@testing-library/jest-dom` must be in place).
  3. Sample smoke test (`site/__tests__/smoke.test.tsx`): `expect(true).toBe(true)` plus `import '@testing-library/jest-dom'` matcher import — confirms loader works.
- **File location:** `site/__tests__/smoke.test.tsx` (delete after T100+ tests exist if it feels like clutter).

#### T004 — Add Chrome PNA / CORS headers to `next.config.mjs`
- **Test type:** `integration` + `manual`.
- **Scenario (integration):** unit test for the `next.config.mjs` headers function (if exported as a function) that asserts the four exact headers; if non-exportable, fall back to `manual` per `host-frame-testing.md`.
- **Scenario (manual):** in browser devtools, hit `localhost:3000`, inspect a sample response — confirm all four headers; confirm `Access-Control-Allow-Credentials` is NOT combined with `Origin: *`.
- **File location:** `site/__tests__/next-config.test.ts` if testable in isolation, else manual at T094.

#### T005 — Pin SDK versions; verify shapes (OQ-A1, OQ-A2)
- **Test type:** `manual` + `non-code`.
- **Scenario:** SDK type inspection happens at scaffold time; results recorded in friction log + CATALOG row. The SDK shape verification is operational, not a runtime behavior — there's no test that says "the SDK has the right field names" because that's part of the type system, not the application.
- **No automated test debt** — verification is type-system-mediated; if `lib/sdk/types.ts` (T013) is wrong, T100 (index-builder unit tests) will fail because fixtures won't match the production code's expectations. T100 IS the regression for T005.

#### T006 — Install Blok theme via shadcn registry
- **Test type:** `non-code` + `integration`.
- **Scenario:** post-install, `tailwind.config.ts` registers `font-mono`; tailwind utility `bg-background` resolves to a CSS custom property; OQ-V2-1 / OQ-V2-2 results recorded in friction log.
- **No automated test** — visual-token presence is a build-time concern, not a behavioral one. Validation comes from any UI test that uses these tokens (e.g., T108 `<CounterRow />` test renders with `text-primary` — a missing token would surface as an unstyled component).

#### T007 — Install required Blok components
- **Test type:** `non-code` + `CI`.
- **Scenario:** all listed `@blok/*` components exist under `site/components/ui/`; `npm run build` exits 0 post-install.
- **No automated test** — install correctness is a build-pipeline concern, not a behavioral one. UI tests T108–T112 will fail if components are missing.

#### T008 — Create root route → `notFound()` (ADR-0014)
- **Test type:** `regression` + `manual`.
- **Scenario (regression):** `app/page.tsx` content matches the locked block from § 4 T008 verbatim; ADR-0014 comment present.
- **Scenario (manual):** `http://localhost:3000/` returns Next.js 404; `app/layout.tsx` still wraps `<MarketplaceProvider>`.
- **File location:** `site/__tests__/root-route.test.tsx` (regression — render `RootPage` from a route handler test, assert it throws the `NEXT_NOT_FOUND` sentinel).

#### T009 — Scaffold widget route entry `app/widget/page.tsx`
- **Test type:** `non-code` (placeholder until T040).
- **Scenario:** route resolves; placeholder text `Widget surface — pending implementation` rendered; `npm run build` succeeds.
- **No test debt at this stage** — the surface implementation comes in T040; UI tests for the surface are T108+.

#### T010 — Scaffold panel route entry `app/panel/page.tsx`
- **Test type:** `non-code` (placeholder until T050). Same shape as T009.

#### T011 — Document local smoke-test rule in product README
- **Test type:** `non-code` (docs).

### Epic E2 — Scan engine

#### T012 — Create `lib/sdk/client.ts` (re-export scaffold's hooks)
- **Test type:** `unit` (trivial — re-export integrity).
- **Scenarios:**
  1. All three named re-exports (`useMarketplaceClient`, `useAppContext`, `MarketplaceProvider`) are defined and reference the original module.
  2. No additional logic in the re-export module (regression — guards against accidental patching).
- **File location:** `site/lib/sdk/__tests__/client.test.ts`.

#### T013 — Define domain types in `lib/sdk/types.ts`
- **Test type:** `non-code` (types only — `tsc --noEmit` is the test).
- **Scenario:** `npm run typecheck` passes. No `any`. `renderingIndex` typed as `ReadonlyMap<…>`. Type tests via `expectTypeOf` (vitest's type-level assertion API) optional but recommended for `Atlas.skipped: ReadonlyArray<Skipped>`.
- **File location (optional):** `site/lib/sdk/__tests__/types.test-d.ts` (vitest type-level test using `expectTypeOf`).

#### T014 — Implement `core/context-resolver.ts` (`requireContextId`)
- **RED → GREEN → REFACTOR.**
- **Test type:** `unit`.
- **Scenarios (test before code — task ID T105 below has been retitled to "RED tests for context-resolver"):**
  1. `.live` present → returns `.live` (string).
  2. `.live` absent, `.preview` present → returns `.preview`.
  3. Both absent → throws `AtlasNoContextError` (named, instance-of-Error).
  4. `ctx === null` → throws `AtlasNoContextError`.
  5. `ctx.resourceAccess` is empty array → throws `AtlasNoContextError`.
- **File location:** `site/core/__tests__/context-resolver.test.ts` (per T105).

#### T015 — Implement `lib/sdk/queries.ts` — five typed wrappers
- **Test type:** `integration` (covered indirectly by T107 scan-engine integration tests; direct unit tests optional).
- **Scenarios:**
  1. `querySitesList(client, contextId)` calls `client.query('xmc.agent.sitesGetSitesList', { params: { query: { sitecoreContextId } } })` exactly once with the right key/params.
  2. Double-unwrap: when `client.query` resolves to `{ data: { data: [...] } }`, wrapper returns the inner `[...]`.
  3. `queryAllPagesBySite` path key is `siteName` (not `siteId`).
  4. `queryComponentsOnPage` throws `DOMException('aborted', 'AbortError')` when signal already aborted on resolution.
  5. No `as any` / `as never` at call sites in production code.
- **File location:** `site/lib/sdk/__tests__/queries.test.ts` (optional standalone) + covered by T107.

#### T016 — Implement `core/abort-bus.ts`
- **RED test:** see new task T016-RED below in § 5.
- **Test type:** `unit`.
- **Scenarios:**
  1. `signal` is an `AbortSignal`; before `abort()` is called, `aborted()` returns `false` and `signal.aborted === false`.
  2. `abort()` flips `aborted()` to `true` AND `signal.aborted === true`.
  3. Calling `abort()` a second time is a no-op (does not throw, does not double-fire `abort` event listeners).
  4. Listeners attached via `signal.addEventListener('abort', ...)` fire exactly once.
- **File location:** `site/core/__tests__/abort-bus.test.ts`.

#### T017 — Implement `core/concurrency-pool.ts` (`runWithConcurrency`)
- **Test type:** `unit` — see T103.
- **Scenarios (per T103):**
  1. `cap=8` means at most 8 in-flight at any time (instrument via mocked job that records start/end timestamps; assert `max(concurrent) <= 8`).
  2. Order preservation — output positions match input positions (input[5] result corresponds to job[5]).
  3. Abort signal stops new jobs from starting; in-flight jobs complete or reject according to their own behavior.
  4. Empty `jobs` array → resolves to `[]` immediately.
  5. `cap > jobs.length` → all jobs run in parallel without crashing.

#### T018 — Implement `core/error-classifier.ts`
- **Test type:** `unit` — see T101.
- **Scenarios (per T101):**
  1. 403 → `'forbidden'`.
  2. 404 → `'not_found'`.
  3. `DOMException` with `name === 'AbortError'` AND NOT a user cancel (i.e., abort came from timeout) → `'timeout'`.
  4. Network error (e.g., `TypeError: Failed to fetch`) → `'network_error'`.
  5. Any other Error → `'other'`.
  6. SDK error envelope shape per `client.md` § 8f — classify based on the envelope's status code.
  7. `null` / `undefined` input → `'other'` (not crash).

#### T019 — Implement `core/scan-config.ts` and rate-limit retry helper
- **Test type:** `unit` — see T104.
- **Scenarios (per T104):**
  1. Zero rate-limit errors → fn invoked once, returns the resolved value.
  2. One rate-limit error → fn invoked twice, succeeds on retry.
  3. `maxRetries + 1` rate-limit errors → throws the last error (NOT the first).
  4. Jitter: empirical delay distribution roughly `base * 2^n ± jitterPercent%` (run 100 retries, assert delays stay within bounds — vitest fake timers).
  5. Abort signal during backoff cancels next retry (signal.aborted → throw `AbortError` immediately, do not invoke fn again).
  6. Constants exported correctly: `SCAN_CONCURRENCY === 8`, `PER_PAGE_TIMEOUT_MS === 12_000`, `RATE_LIMIT_BACKOFF.maxRetries === 4`.

#### T020 — Implement `core/sites-enumerator.ts`
- **Test type:** `unit` (extension of T107 scan-engine integration).
- **Scenarios:**
  1. Scope `'all-collections'` → calls `querySitesList` once; returns full site list.
  2. Scope `'collection'` → calls `querySitesList` AND `queryListCollections`; filters sites whose `collectionId` matches.
  3. Empty collection (no sites match) → returns `[]`.
  4. `siteName` field preserved in returned `Site` objects (needed by `queryAllPagesBySite`).
- **File location:** `site/core/__tests__/sites-enumerator.test.ts`.

#### T021 — Implement `core/site-language-resolver.ts`
- **Test type:** `unit`.
- **Scenarios:**
  1. Site declares `defaultLanguage: 'de'` → returns `'de'`.
  2. Site does NOT declare `defaultLanguage` → returns tenant default; for v1 hardcoded fallback `'en'`; friction-log entry written.
  3. Per-site cache: calling twice for the same `siteId` calls `queryRetrieveSite` only once.
  4. `queryRetrieveSite` throws → wrapper throws (does not silently fallback to `'en'` — error propagates so the engine can decide).
- **File location:** `site/core/__tests__/site-language-resolver.test.ts`.

#### T022 — Implement `core/pages-enumerator.ts`
- **Test type:** `unit` (extension of T107).
- **Scenarios:**
  1. `queryAllPagesBySite` returns flat array → `enumeratePages` returns `PageStub[]` with `siteName` and `language` propagated.
  2. Aborted signal post-fetch → throws `DOMException('aborted', 'AbortError')`.
  3. Empty page list → returns `[]`.
  4. **OQ-A2 — pagination:** if T005 found pagination, this test exercises the continuation-token path; otherwise this row is labeled "OQ-A2 deferred — flat list assumption".
- **File location:** `site/core/__tests__/pages-enumerator.test.ts`.

#### T023 — Implement `core/components-fetcher.ts`
- **Test type:** `unit` (covered by T104 backoff tests + T107 integration).
- **Scenarios:**
  1. Wraps `queryComponentsOnPage` with `withBackoff`; rate-limit retries observed.
  2. Per-page timeout: stub never resolves → after `PER_PAGE_TIMEOUT_MS`, rejects with timeout error (use vitest fake timers).
  3. Successful response within timeout → returns `ComponentRecord[]`.
  4. Aborted signal mid-fetch → rejects with `AbortError`.
- **File location:** `site/core/__tests__/components-fetcher.test.ts`.

#### T024 — Implement `core/index-builder.ts` (pure function)
- **Test type:** `unit` — see T100.
- **Scenarios (per T100, expanded):**
  1. One rendering on N pages → `renderingIndex` has it once with `pages.length === N`, `totalUsages === N`.
  2. Datasource bound on rendering → both indices populated and cross-referenced (`renderingUsage.datasources` has the dsId; `datasourceUsage.renderings` has the renderingId).
  3. Per-page rejected promise → `skipped[]` entry with classified reason; renderings on that page NOT counted.
  4. Unknown rendering (no `renderingId`) → synthetic ID `unknown:<page-id>:<placeholder>:<index>` and `isUnknown: true`.
  5. Multiple unknowns on one page in different placeholders → distinct synthetic IDs.
  6. Inherited / token / personalized bindings absent: fixture with `parameters: { datasource: '{Tokenized}' }` does NOT contribute to `datasourceIndex` (FR-8.2 / E8-T4).
  7. Totals computed correctly: `totals.sites`, `totals.pages` (counted excluding skipped if appropriate per architecture), `totals.renderings === renderingIndex.size`, `totals.datasources === datasourceIndex.size`.
  8. Deterministic ordering: same input twice yields `===`-equivalent output structure (Map iteration order matches input order).
  9. Empty input → all-empty atlas, `totals.pages === 0`.
  10. Pure function — no SDK imports, no React, no `console.*` (verify via grep on the source file in a regression test).

#### T025 — Implement `core/scan-state-machine.ts`
- **Test type:** `unit` — see T102.
- **Scenarios (per T102):**
  1. Allowed transition `idle → scanning` succeeds; returns the new state.
  2. Allowed transition `scanning → completed` / `scanning → canceled` / `scanning → error` succeed.
  3. `completed → scanning` (re-scan) succeeds; `canceled → scanning` succeeds; `error → scanning` succeeds.
  4. `(any) → idle` ONLY via a designated `resetAtlas`-style helper (assert that `transitionTo(prev, 'idle')` throws unless explicit override is passed).
  5. Disallowed transitions throw with a clear error message naming `prev` and `next`.
  6. `ALLOWED_TRANSITIONS` table exported and exhaustive (test enumerates every cell).

#### T026 — Implement `core/atlas-freeze.ts`
- **Test type:** `unit`.
- **Scenarios:**
  1. `freezeAtlas(atlas)` returns the same atlas reference (or a frozen clone — implementation choice; assert behavior).
  2. Attempting to set a key on the returned `renderingIndex` throws (in dev / when the wrapper enforces).
  3. `Object.freeze` applied at root: `Object.isFrozen(result) === true`.
- **File location:** `site/core/__tests__/atlas-freeze.test.ts`.

#### T027 — Implement `core/scan-engine.ts::runScan`
- **Test type:** `integration` — see T107.
- **Scenarios (per T107, expanded):**
  1. **Happy path:** 2 sites × 5 pages each → atlas with 10 pages, all renderings indexed; `scan_started` + 3 `phase_transition` + `scan_completed` events emitted in order.
  2. **One site fails on `retrieveSite`:** site language resolution falls back; scan still completes for OTHER sites; failed site's pages are absent (NOT skipped — site-level failure is different from page-level).
  3. **Cancel during components phase:** call `cancel()` after first 3 pages complete → state transitions to `canceled` with `partial: true`; `scan_canceled` emitted; remaining pages NOT in `skipped[]` (they were never attempted; out-of-scope per scan-engine design).
  4. **All pages return 403:** `Atlas.skipped.length === 10`, all reason `forbidden`; `renderingIndex` empty; `datasourceIndex` empty; atlas is otherwise complete.
  5. **Rate-limit then success:** stubbed page returns 429 once, then 200; no skip; one `rate_limit_retry` telemetry event; `withBackoff` invoked.
  6. **Strict-mode double-mount:** invoke `runScan` twice synchronously → second invocation no-ops (returns the existing `ScanHandle` or a no-op handle); only ONE network sequence fires.
  7. **`donePromise` resolves on completed/canceled/error**, not pending forever.
  8. **`donePromise` does not reject** even on error state — error is reflected in atlas state, not promise rejection.
- **File location:** `site/core/__tests__/scan-engine.test.ts`.

### Epic E3 — Atlas state model

#### T030 — Implement `core/atlas-store.ts` module singleton
- **Test type:** `unit` + `integration`.
- **Scenarios:**
  1. `getAtlasSnapshot()` returns the current state; calling twice without mutation returns `===`-equal value (referential stability).
  2. `setAtlasState(next)` notifies all subscribers; `subscribeAtlas(listener)` returns an unsubscribe function that removes the listener.
  3. `setAtlasState(same)` (no-op when reference equals current) does NOT notify.
  4. `resetAtlas()` sets to `{ kind: 'idle' }` AND clears the strict-mode guard.
  5. Module-scoped state — importing from a fresh test module (via `vi.resetModules`) gets a fresh `idle` state; importing twice in the same test sees the singleton.
  6. **Strict-mode guard (`scanInFlight`):** invoking `startScan` twice within a render double-mount → only ONE scan starts; second invocation no-ops.
  7. **No `window` use:** assert `state` is module-scoped (regression — grep `window.` in the source file should match nothing inside this module).
- **File location:** `site/core/__tests__/atlas-store.test.ts`.

#### T031 — Implement `core/use-atlas-slice.ts` selector hook
- **Test type:** `UI` (uses `@testing-library/react` to mount a tiny component).
- **Scenarios:**
  1. Component subscribed via `useAtlasSlice(s => s.kind)` re-renders on state transition.
  2. Selector returning a stable projection (e.g., the same primitive) does NOT cause re-render after a state mutation that doesn't affect the slice (React's `useSyncExternalStore` bail-out).
  3. Component unmount calls the unsubscribe (no leaked listeners — assert via store's listener count after unmount).
  4. **Infinite loop guard:** if a buggy selector returns a fresh object each call, document the failure mode in a separate test (mark as known limitation; the fix is at the call-site memoization, not in the hook).
- **File location:** `site/core/__tests__/use-atlas-slice.test.tsx`.

#### T032 — Add `__resetForTest()` test helper
- **Test type:** `unit`.
- **Scenarios:**
  1. In `NODE_ENV === 'test'` (vitest default), `__resetForTest()` sets state to `idle` and clears `scanInFlight`.
  2. With `NODE_ENV === 'production'` (set via `vi.stubEnv`), throws `'__resetForTest may only be called in tests'`.
- **File location:** within `site/core/__tests__/atlas-store.test.ts`.

#### T033 — Wire scan triggers into atlas-store actions
- **Test type:** `integration` (uses scan-engine stubs).
- **Scenarios:**
  1. `startScan(client, contextId, scope)` when state is `idle` → calls `runScan` with the right args; stores returned handle; state transitions to `scanning`.
  2. `startScan` when state is `scanning` → no-op (strict-mode guard); does NOT call `runScan` again.
  3. `cancelScan()` → calls `currentHandle.cancel()`; state eventually becomes `canceled`.
  4. `refreshAtlas` / `setScope` keep prior atlas visible during the new scan (do NOT call `resetAtlas` between cancel and start).
  5. Error in `runScan` → state transitions to `error` with the cause; subsequent `startScan` is allowed (recoverable).
- **File location:** `site/core/__tests__/atlas-actions.test.ts`.

### Epic E4 — Widget surface

#### T040 — Implement `<WidgetSurface />`
- **Test type:** `UI` + `integration`.
- **Scenarios:**
  1. First mount with `atlas.kind === 'idle'` → calls `startScan(client, contextId, { kind: 'all-collections' })`.
  2. Renders 4-zone anatomy: Zone 1 (status bar OR freshness ribbon), Zone 2 (disclosure strip + skipped link), Zone 3 (table), Zone 4 (KPI rail).
  3. Wrapped in React error boundary — throwing inside `<WidgetTable />` shows fallback UI but does NOT propagate to root.
  4. Error boundary independent from panel boundary (if a test renders both, panel keeps rendering when widget crashes).
- **File location:** `site/components/__tests__/widget-surface.test.tsx`.

#### T041 — Implement `<WidgetTable />`
- **Test type:** `UI` + `a11y`.
- **Scenarios:**
  1. Renders one row per `RenderingUsage` from atlas; columns Rendering / Total / Pages / Mini-bar / Datasources / (Last seen at ≥1024 px).
  2. Default sort: Total `desc`. Click header toggles to `asc`. Stable sort.
  3. Mini-bar `aria-hidden="true"`.
  4. Row chrome `bg-card`; hover applies `bg-muted/50`; focus applies `ring-ring`.
  5. Click row opens `<UsageDrawer />`.
  6. Keyboard: focus enters via Tab; ArrowDown / ArrowUp move focus; Enter opens drawer; Esc closes.
  7. Display-name disambiguation memoized — re-rendering with same row set does NOT recompute `computeCollisions`.
- **File location:** `site/components/widget/__tests__/widget-table.test.tsx`.

#### T042 — Implement `<SearchInput />` + filter logic
- **Test type:** `UI`.
- **Scenarios:**
  1. Disabled while atlas state is `scanning`; helper text "Search will activate when scan completes." rendered.
  2. After scan completes, input enabled.
  3. Typing `Hero` filters table rows; case-insensitive substring match on display name.
  4. 80ms debounce — typing 4 keystrokes within 80ms triggers ONE filter pass (use vitest fake timers).
  5. No `client.query` call fired by typing (assert via spy).
  6. Clearing input restores full table.
- **File location:** `site/components/widget/__tests__/search-input.test.tsx`.

#### T043 — Implement `<KpiRail />`
- **Test type:** `UI` + `a11y`.
- **Scenarios:**
  1. Renders 3-4 cells: TOTAL RENDERINGS / TOTAL DATASOURCES / PAGES SCANNED / SKIPPED.
  2. Each cell has `aria-label="<label>: <value>"` (e.g., `aria-label="Total renderings: 124"`).
  3. SKIPPED is a `<button>` (or `role="button"`); click opens `<SkippedDrawer />`.
  4. Typography classes match v2 spec: label `text-xs uppercase tracking-wide text-muted-foreground`, value `text-2xl font-semibold tabular-nums`.
  5. At 800–1024 px viewport, SKIPPED collapses into a Zone 2 link instead of a KPI cell.
- **File location:** `site/components/widget/__tests__/kpi-rail.test.tsx`.

#### T044 — Implement `<RenderingNameCell />`
- **Test type:** `UI` — see T110.
- **Scenarios (per T110):**
  1. No collision → display name only; no badge.
  2. Collision → display name + `· <last-7-of-id>` badge; tooltip on hover shows full ID.
  3. Unknown rendering → label `(unknown rendering)`.
  4. ID copy button writes the FULL rendering ID to clipboard (mock `navigator.clipboard.writeText`).
  5. Layout preserves keyboard focusability: badge + button are in the focus order; tooltip dismisses on Esc.

#### T045 — Implement collision-suffix utility (`computeCollisions`)
- **Test type:** `unit` — see T106.
- **Scenarios (per T106):**
  1. Distinct names → no suffixes (all `null`).
  2. Two same name → both rows get `· <last-7>` suffix.
  3. Three same name → all three suffixed.
  4. One rendering → no suffix.
  5. Empty input → empty Map.
  6. Pure function — no side effects; calling twice with same input returns `===`-equivalent Map (or at least `.entries()` are equal).

#### T046 — Implement `<FreshnessRibbon />` + Refresh atlas action
- **Test type:** `UI`.
- **Scenarios:**
  1. State `completed` with `scannedAt < 15min ago` → ribbon `variant="default"`; copy "Last scanned HH:MM · whole tenant (3 collections, 8 sites, 312 pages)".
  2. State `completed` with `scannedAt > 15min ago` → ribbon `variant="warning"`; `Stale?` text in `text-warning`; reinforces color with text (NFR-4.3).
  3. State `canceled` → ribbon shows partial-results indicator.
  4. State `scanning` → ribbon NOT rendered (status bar takes its place — wired via T061).
  5. Refresh button → calls `refreshAtlas`; primary `@blok/button` styling.
- **File location:** `site/components/widget/__tests__/freshness-ribbon.test.tsx`.

#### T047 — Implement `<ScopePicker />`
- **Test type:** `UI`.
- **Scenarios:**
  1. Multiple collections → renders `@blok/select` with "All collections" + one option per collection.
  2. Change → calls `setScope` with the selected scope.
  3. One collection → `disabled` with helper text "Only one collection in this tenant".
  4. Zero collections → component returns `null` (hidden).
  5. Collections with zero sites → option absent from dropdown.
- **File location:** `site/components/widget/__tests__/scope-picker.test.tsx`.

#### T048 — Implement density toggle (with fallback)
- **Test type:** `UI`.
- **Scenarios:**
  1. Primary path (`@blok/toggle-group` available) → renders toggle-group with Compact/Comfortable; default Compact.
  2. Fallback path (`@blok/toggle-group` failed install) → renders native `<button role="radio">` group; same default.
  3. Selection persists per tab (in-memory state); reload resets to default.
  4. Selected density carried through to table row height (test by inspecting the density prop passed to `<WidgetTable />`).
- **File location:** `site/components/widget/__tests__/density-toggle.test.tsx`.

### Epic E5 — Panel surface

#### T050 — Implement `<PanelSurface />`
- **Test type:** `UI` + `integration`.
- **Scenarios:**
  1. First mount → issues per-page `queryComponentsOnPage` on a SEPARATE `AbortBus`; rendering stack rendered before global scan completes (E5-T1).
  2. First mount → also calls `startScan` if atlas is `idle`.
  3. Subscribes to `pages.context` via `client.query('pages.context', { subscribe: true, onSuccess })`.
  4. On unmount, calls the subscription's `unsubscribe`.
  5. 4-zone anatomy minus Zone 4 (no KPI rail on panel).
  6. Wrapped in React error boundary, independent from widget boundary.
- **File location:** `site/components/__tests__/panel-surface.test.tsx`.

#### T051 — Implement `<CounterRow />` + states
- **Test type:** `UI` + `a11y` — see T108.
- **Scenarios (per T108):**
  1. State `loading` → `@blok/skeleton` rendered, 3ch wide; no count visible.
  2. State `default` (count ≥ 1) → `text-3xl font-bold tabular-nums text-primary`; click opens drawer.
  3. State `zero` (count === 0) → `text-3xl font-bold tabular-nums text-muted-foreground`; row `aria-disabled="true"`; click does NOT open drawer.
  4. State `missing` → `<Icon name="alert-triangle" />` in `text-warning` + word `missing` in `text-xs uppercase tracking-wide text-warning`. Color is NOT the only signal.
  5. `aria-label="<count> other pages use <renderingName>"` (or appropriate template per state).
  6. Reduced-motion: cross-fade collapses to instant swap.

#### T052 — Active-page rendering stack + Datasource Impact group
- **Test type:** `UI` + `integration`.
- **Scenarios:**
  1. Rendering stack: one `<CounterRow />` per component on the active page from the per-page fetch; counter shows skeleton until atlas resolves.
  2. Once atlas resolves: counter reads `renderingIndex.get(rid).pages.length - 1` (active page excluded — E2-T9).
  3. Datasource impact: one row per unique datasource; counter is `datasourceIndex.get(dsId).pages.length`; missing datasources show warning glyph + `missing` text.
  4. Counter click opens `<UsageDrawer />` with the right rendering / datasource focus.
- **File location:** `site/components/__tests__/panel-surface.test.tsx` (extends the T050 file).

#### T053 — Implement panel page-switch handler (D10, AR-5)
- **Test type:** `integration` + `UI`.
- **Scenarios:**
  1. `pages.context` callback fires with new pageId → Zone 3 re-paints; Zone 1 + Zone 2 unchanged.
  2. CSS-only 250 ms cross-fade applied on the rendering stack swap.
  3. `prefers-reduced-motion: reduce` collapses cross-fade to instant.
  4. Global scan handle is NOT cancelled (assert `currentHandle.cancel` was not called).
  5. New per-page fetch issued with the new pageId on the SEPARATE `AbortBus` (does not abort global scan).
- **File location:** `site/components/__tests__/panel-page-switch.test.tsx`.

#### T054 — Narrow-viewport adjustments for panel (<420 px)
- **Test type:** `UI`.
- **Scenarios:**
  1. At width 360 px → scope picker hidden behind `@blok/dropdown-menu` kebab.
  2. Status bar wraps to two lines.
  3. Counter typography drops to `text-2xl` (from `text-3xl`).
  4. Drawer takes 90% width.
  5. Verified at 360 / 420 / 800 px.
- **File location:** `site/components/__tests__/panel-narrow.test.tsx` (use `@testing-library/react` with viewport mock or visual diff at T094).

### Epic E6 — Loading visual + drawer

#### T060 — Implement `<ScanStatusBar />`
- **Test type:** `UI` + `a11y` — see T109.
- **Scenarios (per T109):**
  1. Outer container has `role="status" aria-live="polite" aria-atomic="true"`.
  2. Three segments: pending = `bg-muted`, active = `bg-primary` with pulse, completed = `bg-success` (or fallback per T006 friction).
  3. Pulse animation uses `transform`/`opacity` only; verified by computed style inspection.
  4. `prefers-reduced-motion: reduce` → pulse becomes static fill (`animation: none`).
  5. Phase transitions announced via `aria-live` ONCE per transition (not per page); assert by spying on the live-region content updates.
  6. Numerical readout: `Pages 47 / 312 · 14s elapsed` in `font-mono tabular-nums text-sm text-muted-foreground`.
  7. Cancel button: `aria-label="Cancel scan"`; click calls `onCancel`.

#### T061 — Wire status bar / freshness ribbon into Zone 1 swap
- **Test type:** `UI`.
- **Scenarios:**
  1. State `scanning` → `<ScanStatusBar />` rendered; `<FreshnessRibbon />` not rendered.
  2. State `completed` / `canceled` → `<FreshnessRibbon />` rendered; `<ScanStatusBar />` not rendered.
  3. State `error` → `<ErrorStates>` chip rendered.
  4. Never both visible at once (regression).
- **File location:** `site/components/__tests__/zone-1-swap.test.tsx`.

#### T062 — Implement slow-connection hint (AC-4.4)
- **Test type:** `UI`.
- **Scenarios:**
  1. `progress.current` unchanged for 5 seconds (vitest fake timers) → "Slow connection — retrying" + "Try again" affordance rendered below status bar.
  2. Next progress tick → hint disappears.
  3. "Try again" click → calls `cancelScan` then `startScan` with the same scope.
  4. Backoff retry from T019 active → hint also surfaces with retry counter.
- **File location:** `site/components/loading/__tests__/slow-connection-hint.test.tsx`.

#### T063 — Implement `<UsageDrawer />`
- **Test type:** `UI` + `a11y` + `integration`.
- **Scenarios:**
  1. Opens as `@blok/sheet` anchored right (widget) or side-opposite-host (panel).
  2. Two-section layout via `@blok/separator`: "Direct rendering usage" + "Via datasource".
  3. Header: rendering display name + `· <last-7-of-id>` suffix + ID-copy button.
  4. Page row click → `client.mutate('pages.context', { params: { itemId: pageRef.pageId } })` (E6-T6).
  5. Footer: Close button + `@blok/kbd` Esc hint.
  6. Body uses `@blok/scroll-area` for the page list.
  7. Focus trap: tabbing past the last focusable element returns focus to the first.
  8. Esc → drawer closes; focus returns to opener.
- **File location:** `site/components/drawer/__tests__/usage-drawer.test.tsx`.

#### T064 — Implement skipped-pages sub-drawer (FR-7.2)
- **Test type:** `UI` + `a11y`.
- **Scenarios:**
  1. Opens from KPI SKIPPED click OR Zone 2 link.
  2. Lists `Skipped` entries grouped by reason: `forbidden`, `timeout`, `not_found`, `network_error`, `other`.
  3. `forbidden` chips: `text-destructive` + word `forbidden`.
  4. `timeout` chips: `text-warning` + word `timeout`.
  5. (Etc. — every reason reinforces color with text per NFR-4.3.)
  6. Click on a page chip is DISABLED — does NOT call `pages.context` mutate (we don't navigate to pages we couldn't read).
- **File location:** `site/components/drawer/__tests__/skipped-drawer.test.tsx`.

#### T065 — Implement `<EmptyStates>` and `<ErrorStates>` integrations
- **Test type:** `UI`.
- **Scenarios:**
  1. W5 / P5 (no tenant context): renders "Atlas needs a tenant connection — please reload the dashboard." NO retry button (per OQ-A6).
  2. W4 (no shared usage): "Every component is unique to a page" — body "This tenant has no shared renderings. Datasources are still indexed below."
  3. Empty tenant: "This tenant has no published pages yet."
  4. Search zero matches: "No renderings match `<term>`. Try a partial name." — `<term>` is the active search query.
  5. Copy strings match PRD § 11.3 verbatim (string equality).
- **File location:** `site/components/__tests__/empty-error-states.test.tsx`.

### Epic E7 — Telemetry + observability

#### T072 — Implement `core/telemetry.ts`
- **Test type:** `unit`.
- **Scenarios:**
  1. `track(event)` appends to ring buffer; `getBuffer()` returns the appended event.
  2. Ring buffer cap 500 — emit 600 events; buffer length is exactly 500; oldest 100 dropped (FIFO).
  3. `clearBuffer()` empties the buffer.
  4. `track` also calls `console.info("[CUA]", event)` (assert via `vi.spyOn(console, 'info')`).
  5. `TelemetryEvent` shape matches the union: `kind`, `surface`, `timestamp_ms`, plus event-specific fields.
  6. **No PII enforcement (regression):** for each `kind` enumerate representative fixtures and assert `JSON.stringify(event)` does NOT contain `displayName`, `sitePath`, `editor`, tenant identifiers, datasource paths.
- **File location:** `site/core/__tests__/telemetry.test.ts`.

#### T073 — Wire telemetry emission across the engine
- **Test type:** `integration` (extends T107).
- **Scenarios:**
  1. Successful scan → events in order: `surface_mounted`, `scan_started`, `phase_transition` × 3, `scan_completed`.
  2. Cancelled scan → ends with `scan_canceled` (NOT `scan_completed`).
  3. Errored scan → ends with `scan_error`; `cause` field present (sanitized).
  4. Each rate-limit retry → `rate_limit_retry` event; counter field accurate.
  5. Each skipped page → `page_skipped` event; in production builds `pageId` is NOT included (only `reason` + counter); behind `?debug=1` `pageId` IS included.
  6. `surface_mounted` fires once per mount of `<WidgetSurface />` and once per mount of `<PanelSurface />`.
- **File location:** within `site/core/__tests__/scan-engine.test.ts` (T107 file extended).

#### T074 — Implement `<DebugPanel />`
- **Test type:** `UI`.
- **Scenarios:**
  1. Without `?debug=1` → component returns `null` (no DOM).
  2. With `?debug=1` → renders buffer as a list.
  3. Copy-to-clipboard button calls `navigator.clipboard.writeText(JSON.stringify(buffer))`.
- **File location:** `site/components/debug/__tests__/debug-panel.test.tsx`.

#### T075 — Anti-metric guard (DoD-4)
- **Test type:** `CI` + `unit` (script test).
- **Scenarios:**
  1. Tmpdir fixture file with `scans_per_minute` → `node scripts/check-antimetrics.mjs` exits non-zero; stderr contains the offending path:line.
  2. Same for `api_calls_served` and `session_count`.
  3. Tmpdir fixture without forbidden strings → exits 0.
  4. Searches `core/`, `lib/`, `components/`, `app/` (not test files — exclude `__tests__/` directories).
- **File location:** `site/scripts/__tests__/check-antimetrics.test.mjs`.

### Epic E8 — Edge handling

#### T080 — "ⓘ Direct bindings only" affordance (FR-8.3, ADR-0006)
- **Test type:** `UI` — see T112.
- **Scenarios (per T112):**
  1. `<DirectBindingsInfo />` always rendered in DOM in all four primary states (`idle`, `scanning`, `completed`, `error`) on BOTH surfaces.
  2. Tooltip / popover copy matches ADR-0006 § Decision verbatim — string equality, NOT "contains": *"Counts include datasources bound directly on the page's layout. Inherited (page designs), personalized, A/B variant, and token-resolved bindings are not counted in this version."*
  3. Mounted in Zone 2.

#### T081 — "(unknown rendering)" virtual row (AR-9)
- **Test type:** `UI`.
- **Scenarios:**
  1. Atlas with one rendering missing definition reference → widget table renders ONE virtual row labeled `(unknown rendering)` with count = number of synthetic entries.
  2. Drawer for this row: per-page-with-placeholder breakdown (each unknown placement was indexed under synthetic ID `unknown:<page-id>:<placeholder>:<index>`).
  3. Multiple unknown renderings on same page in different placeholders → rendered as distinct entries inside the drawer.
- **File location:** `site/components/widget/__tests__/unknown-rendering.test.tsx`.

#### T082 — Forbidden page handling at click-through (US-1 AC-1.5)
- **Test type:** `UI` + `a11y` — see T111.
- **Scenarios (per T111):**
  1. `Atlas.skipped` contains pageId `P1` with reason `forbidden` → drawer row for `P1` renders `aria-disabled="true"` + tooltip "no access".
  2. Click on the row does NOT call `client.mutate('pages.context', ...)`.
  3. Non-forbidden rows still navigate normally.

### Epic E9 — Build / CI / release

#### T090 — All-green gate
- **Test type:** `CI`.
- **Scenarios:**
  1. `npm run typecheck` exits 0.
  2. `npm run lint` exits 0.
  3. `npm run test` exits 0 with at least the unit + integration + UI test count from T100–T112 RED tasks (≥ 12 test files).
  4. `npm run build` exits 0.
- **No new test file** — the gate IS the test.

#### T091 — Ship checklist + anti-metric guard run
- **Test type:** `CI` + `manual`.
- **Scenarios:**
  1. `npm run check:antimetrics` exits 0.
  2. Hand-audit grep `'fetch\\(|XMLHttpRequest|sendBeacon'` under `core/`, `lib/`, `components/`, `app/` — every match is inside a `client.query/mutate` call.
  3. Hand-audit grep `'localStorage\\.|sessionStorage\\.|indexedDB\\.|document\\.cookie'` returns zero matches outside test files (E2-T5 regression).

#### T092 — Configure Vercel project root
- **Test type:** `manual` + `non-code`.
- **Scenario:** Vercel preview deploy succeeds for any branch push to `prd-000`.

#### T093 — Cloud Portal registration paste
- **Test type:** `manual` + `non-code`.
- **Scenario:** App is installable to a test tenant; routes `/widget` and `/panel` resolve from the portal iframe.

#### T094 — Real-tenant smoke test (host-frame)
- **Test type:** `host-frame` + `manual`.
- **Scenarios (per `host-frame-testing.md`):**
  1. Inputs supplied: host URL + app origin; auth interactive; if either missing, record `deferred — host URL not supplied` with WARN verdict.
  2. Walk all five user stories (US-1..US-5) on a tenant with ≥500 pages, ≥2 sites, ≥1 collection (DoD-2).
  3. Capture clipped iframe screenshots for: W1 cold scan, W2 completed warm, W3 drawer open, W4 empty result, W5 no context, P1/P2 panel cold + page-switch.
  4. Compare each clipped screenshot against `pocs/poc-v2/` rendered at the iframe's clip width — five-axis scoring (layout, typography, color, anatomy, state).
  5. Verify: (a) widget cold scan completes <30s on ~1k pages (NFR-1.1, S3); (b) widget warm re-mount <200ms (NFR-1.3); (c) cancel-with-act flow works; (d) collision suffix; (e) Direct bindings only affordance visible; (f) skipped pages forbidden vs timeout reasons distinct.
  6. POC drift: if design diverged from POC, raise as finding and route through `/architect` step 3 — do NOT silently update baseline.
- **File location:** `products/component-usage-atlas/test-evidence/<state>-{host,poc}.png` + `project-planning/plans/test-report-<timestamp>.md`.

### Tests (RED-first — these run BEFORE the implementations they validate)

> **Reordering note (per § 9.1).** T100–T112 have been recharacterized as RED-write-failing-test tasks. Each implementation task that has a corresponding T1XX test now lists the T1XX as a Depends-on (see § 5 reordered execution order). Per § 4 task descriptions, the original T1XX tests already covered the behavior — the QA Specialist is reordering, NOT renumbering.

#### T100 — RED: Unit tests for `index-builder.ts` (write failing tests BEFORE T024)
- See test scenarios above under T024 (10 scenarios). Tests live at `site/core/__tests__/index-builder.test.ts`. Implementation (T024) Depends-on T100.

#### T101 — RED: Unit tests for `error-classifier.ts` (BEFORE T018)
- See scenarios under T018. Tests at `site/core/__tests__/error-classifier.test.ts`. T018 Depends-on T101.

#### T102 — RED: Unit tests for `scan-state-machine.ts` (BEFORE T025)
- See scenarios under T025. Tests at `site/core/__tests__/scan-state-machine.test.ts`. T025 Depends-on T102.

#### T103 — RED: Unit tests for `concurrency-pool.ts` (BEFORE T017)
- See scenarios under T017. Tests at `site/core/__tests__/concurrency-pool.test.ts`. T017 Depends-on T103.

#### T104 — RED: Unit tests for `withBackoff` retry helper (BEFORE T019)
- See scenarios under T019. Tests at `site/core/__tests__/with-backoff.test.ts`. T019 Depends-on T104.

#### T105 — RED: Unit tests for `requireContextId` / `AtlasNoContextError` (BEFORE T014)
- See scenarios under T014. Tests at `site/core/__tests__/context-resolver.test.ts`. T014 Depends-on T105.

#### T106 — RED: Unit tests for `computeCollisions` (BEFORE T045)
- See scenarios under T045. Tests at `site/lib/__tests__/collisions.test.ts`. T045 Depends-on T106.

#### T107 — RED: Integration tests for scan engine with stubbed SDK (BEFORE T027)
- See scenarios under T027 (8 scenarios). Tests at `site/core/__tests__/scan-engine.test.ts`. T027 Depends-on T107.

#### T108 — RED: UI tests for `<CounterRow />` states (BEFORE T051)
- See scenarios under T051. Tests at `site/components/panel/__tests__/counter-row.test.tsx`. T051 Depends-on T108.

#### T109 — RED: UI tests for `<ScanStatusBar />` accessibility (BEFORE T060)
- See scenarios under T060. Tests at `site/components/loading/__tests__/scan-status-bar.test.tsx`. T060 Depends-on T109.

#### T110 — RED: UI tests for `<RenderingNameCell />` collision rendering (BEFORE T044)
- See scenarios under T044. Tests at `site/components/widget/__tests__/rendering-name-cell.test.tsx`. T044 Depends-on T110.

#### T111 — RED: UI tests for forbidden / disabled drawer rows (BEFORE T082)
- See scenarios under T082. Tests at `site/components/drawer/__tests__/forbidden-rows.test.tsx`. T082 Depends-on T111.

#### T112 — RED: UI tests for "Direct bindings only" affordance always-visible (BEFORE T080)
- See scenarios under T080. Tests at `site/components/info/__tests__/direct-bindings-info.test.tsx`. T080 Depends-on T112.

#### T113 — Manual / E2E test plan (post-implementation runbook)
- **Test type:** `manual` (docs).
- **Scenario:** Document the manual smoke set in `site/docs/manual-tests.md` so QA can re-run after each release. Cases enumerated in § 4 task description. No automated path in v1 — `host-frame-testing.md` covers the "what runs in the real portal" recipe.

---

## Handoff Metadata

- **Canonical run manifest:** `products/component-usage-atlas/project-planning/workflow/run-20260427T104955Z.json`
- **Source PRD:** `products/component-usage-atlas/project-planning/PRD/prd-000.md`
- **Source architecture:** `products/component-usage-atlas/project-planning/architecture/architecture-20260427T104955Z.md`
- **Selected UI variant:** `products/component-usage-atlas/project-planning/ui-design/ui-design-20260427T104955Z-v2.md` (v2 — Console Operator)
- **Winning POC clickdummy (visual reference):** `products/component-usage-atlas/pocs/poc-v2/`
- **ADRs honored:** ADR-0001 through ADR-0014 (all locked).
- **Recommended next command:** `/implement` — runs against `prd-minimal-000.md` + this task breakdown. QA Specialist (07) enrichment is complete (§§ 9 + 10 populated; § 4b expanded with traceable cases; § 5 reordered for test-first; T100–T112 are now RED-first predecessors of their GREEN implementations).
- **Recommended next input file:** `task-breakdown-20260427T104955Z.md` (this file — TDD-enriched).
- **Task breakdown style:** `tdd` (per `current-run.json` + `run-20260427T104955Z.json` — flipped from `standard` by QA Specialist (07)).
- **Branch:** `prd-000`
- **Remote:** `https://github.com/Chris1415/Sitecore.Plugin.Component-Usage-Atlas.git`
