# Component Usage Atlas

Tenant-wide live atlas of where renderings and their bound datasources are used
across a Sitecore tenant — a Marketplace app for content editors. Two surfaces
ship from one app registration: a **Dashboard Widget** for component-centric
search, and a **Page Context Panel** for page-centric impact analysis. The atlas
is built fresh in the iframe heap on demand, cached for the tab's lifetime, and
discarded on tab close. No backend, no persisted index, no scheduled jobs.

> Screenshot pending real-tenant smoke (clipped iframe inside Cloud Portal vs
> the `pocs/poc-v2/` clickdummy). The image at the link below will be added
> post-deploy. Visual ground truth until then is the POC reference at
> [pocs/poc-v2/](pocs/poc-v2/).

![Component Usage Atlas — Page Context Panel](docs/images/screenshot-panel.png)

## What this does

Sitecore content editors regularly hit the same blind spot: *"if I publish,
modify, or delete this rendering — or this datasource — what else breaks?"*
Native Pages does not surface cross-page rendering and datasource usage in a
fast, in-context way. Component Usage Atlas closes that gap by walking the
tenant's `xmc.agent.*` endpoints on demand and aggregating the results into
two views:

- **Dashboard Widget** (`xmc:dashboardblocks`) — search any rendering, see
  every page that uses it, drill into per-page detail with a side drawer.
- **Page Context Panel** (`xmc:pages:context-panel`) — for the active page,
  list its renderings with `+N other pages` counters, plus a Datasource Impact
  group that does the same for every datasource referenced from this page.

The app is **pull-only** by design (the Marketplace SDK does not allow apps to
intercept publish or delete actions in Pages) and the atlas is **fully live in
the iframe** — installed once, no infrastructure to maintain.

## Tech stack

- **Next.js 16.1.7** (App Router, Turbopack)
- **React 19.2**
- **TypeScript** (strict)
- **Tailwind CSS v4** + **Blok** semantic-token registry (Sitecore design system)
- **`@sitecore-marketplace-sdk/client@0.3.2`** + **`@sitecore-marketplace-sdk/xmc@0.4.1`** (pinned)
- **Vitest 4.1.5** + **@testing-library/react** + **jsdom**
- **Mode A iframe-only** — no backend, no persistence, no external network egress

## Getting started

Prerequisites: Node 22+ and a working `npm`. From the product root:

```bash
cd site
npm install
```

### Run locally

```bash
npm run dev
```

Then open one of the surface routes directly:

- `http://localhost:3000/widget` — Dashboard Widget surface
- `http://localhost:3000/panel` — Page Context Panel surface

## Local smoke-test rule

Always hit one of the surface routes directly. The application root `/` returns
Next.js `notFound()` by design (see `docs/decisions.md` ADR-0014); a 404 there
is correct, not a bug.

```bash
cd products/component-usage-atlas/site
npm run dev
# then open ONE of:
#   http://localhost:3000/widget   ← Dashboard Widget surface
#   http://localhost:3000/panel    ← Page Context Panel surface
# DO NOT open http://localhost:3000/  — it is unreachable on purpose.
```

Outside the Cloud Portal iframe the `MarketplaceProvider` shows its connecting
loader and never resolves — that is expected. To exercise the real handshake,
install the app into a Cloud Portal tenant and load the surface from inside the
portal.

### Tests, lint, build, audits

```bash
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # Vitest, 219 passing across 32 files
npm run build          # Next.js production build (4 static routes)
npm run audit:network  # Grep gate — no raw fetch / XHR / sendBeacon outside SDK
npm run audit:anti-metric
                       # Grep gate — no forbidden vanity-KPI strings
npm run ci             # Composite gate: lint + typecheck + test + build + both audits
```

## Project structure

```
products/component-usage-atlas/
├── site/                          # Implementation — Next.js app
│   ├── app/
│   │   ├── widget/page.tsx        # Dashboard Widget route entry (thin)
│   │   ├── panel/page.tsx         # Page Context Panel route entry (thin)
│   │   ├── page.tsx               # Root → notFound() by design
│   │   └── layout.tsx
│   ├── components/
│   │   ├── atlas/                 # 18 composed atlas primitives (widget-surface,
│   │   │                          #   panel-surface, scan-status-bar,
│   │   │                          #   counter-row/-rail, rendering-name-cell,
│   │   │                          #   drawer-row, usage-drawer, skipped-drawer,
│   │   │                          #   density-toggle, page-context-card,
│   │   │                          #   rendering-impact-list, datasource-impact-group,
│   │   │                          #   missing-datasource-warning,
│   │   │                          #   direct-bindings-affordance,
│   │   │                          #   widget-table, empty-state, debug-panel)
│   │   ├── ui/                    # Blok primitives (shadcn registry-installed)
│   │   ├── providers/             # MarketplaceProvider + SDK hooks
│   │   └── theme-provider.tsx
│   ├── core/                      # Framework-free engine modules
│   │   ├── scan-engine.ts         # Orchestrates sites → pages → components fan-out
│   │   ├── scan-state-machine.ts  # idle → scanning → completed | canceled | error
│   │   ├── scan-config.ts         # Concurrency cap + withBackoff helper
│   │   ├── concurrency-pool.ts    # Bounded parallelism with AbortSignal
│   │   ├── abort-bus.ts           # Shared cancel bus across in-flight requests
│   │   ├── atlas-store.ts         # Module-singleton state + pub/sub
│   │   ├── atlas-actions.ts       # triggerScan / refreshAtlas / setScope
│   │   ├── atlas-freeze.ts        # Deep-freeze on completed atlas
│   │   ├── use-atlas-slice.ts     # useSyncExternalStore hook
│   │   ├── context-resolver.ts    # requireContextId guard (no `as string`)
│   │   ├── error-classifier.ts    # XMC error → Skipped.reason mapping
│   │   ├── index-builder.ts       # Pure: raw scan → renderingIndex + datasourceIndex
│   │   ├── sites-enumerator.ts
│   │   ├── pages-enumerator.ts
│   │   ├── components-fetcher.ts
│   │   ├── site-language-resolver.ts
│   │   └── telemetry.ts           # In-iframe ring buffer + console.info
│   ├── lib/
│   │   ├── sdk/
│   │   │   ├── client.ts          # ClientSDK init + typed query wrappers
│   │   │   ├── types.ts           # Two-layer types: Sdk* raws + Atlas-shaped domain
│   │   │   └── queries.ts         # Envelope-unwrapping per `xmc.md` § 8b
│   │   ├── collisions.ts          # Display-name disambiguation
│   │   └── utils.ts
│   ├── scripts/
│   │   ├── audit-network.mjs      # CI guard — no raw fetch outside SDK
│   │   └── check-antimetrics.mjs  # CI guard — no forbidden vanity-KPI strings
│   └── package.json
├── pocs/poc-v2/                   # Winning UI variant clickdummy (visual ground truth)
├── project-planning/              # PRD, ADRs, architecture, runbooks
│   ├── PRD/
│   ├── ADR/                       # 14 ADRs (see docs/decisions.md)
│   ├── architecture/
│   ├── ui-design/
│   ├── plans/
│   └── workflow/
├── docs/                          # Generated: architecture.md, decisions.md
├── README.md                      # This file
└── CHANGELOG.md
```

The `project-planning/` tree is documentation of the build process — not
shipped to users, but kept in the repo for traceability.

## Architecture summary

Atlas is a single Next.js app that ships **two iframe entries** from one
Marketplace app registration. Both entries import the same shared scan engine
and atlas singleton; each iframe runs its own JS heap, so a scan running in
the widget tab does not (and cannot) feed the panel tab and vice versa.

The scan engine fans out across the tenant via three SDK calls in sequence:
`xmc.agent.sitesGetSitesList → sitesGetAllPagesBySite → pagesGetComponentsOnPage`.
The components-fan-out runs at concurrency 8 with exponential backoff on
rate-limit errors (see ADR-0012). Per-page failures land in a typed
`skipped[]` array with reasons `forbidden | timeout | not_found | network_error
| other`; a single page failure never aborts the scan. A shared `AbortBus`
threads cancel through every in-flight request so the user can stop a scan and
keep whatever was gathered so far.

State is held in a module-singleton (`core/atlas-store.ts`) wired up via
`useSyncExternalStore`, so the atlas survives mount/unmount cycles inside the
same iframe lifetime. The completed atlas is deep-frozen before the UI sees it.
Telemetry is in-iframe only — a 500-event ring buffer plus
`console.info("[CUA]", …)` mirrors. There is no `postMessage` to the host
frame, no `fetch`, no `XHR`, no `sendBeacon`. CI enforces this with
`npm run audit:network` (grep gate over `core/`, `lib/`, `components/`, `app/`)
and an anti-metric guard test that fires inside the regular test suite.

The branded loading visualization — the *Console Operator* aesthetic from the
v2 POC — paints a 3-segment progress strip (sites / pages / components) with
a numeric readout and a cancel-with-act affordance that preserves the partial
atlas. CSS-only animations keep the surface at 60fps.

For the full narrative, see [`docs/architecture.md`](docs/architecture.md).

## Decisions

Every load-bearing decision is captured as an ADR in `project-planning/ADR/`.
A curated, themed table of all 14 ADRs is in
[`docs/decisions.md`](docs/decisions.md) — start there if you want the "why
did we do it this way?" view.

## Cloud Portal registration

When registering the app in **Cloud Portal → App Studio**, paste these surface
paths into the corresponding extension-point configuration:

| Extension point | Path |
|-----------------|------|
| `xmc:dashboardblocks` (Dashboard Widget) | `/widget` |
| `xmc:pages:context-panel` (Page Context Panel) | `/panel` |

A single Marketplace app registration covers both surfaces (ADR-0004).

### Required API access scopes

Request the following XMC scopes at registration time:

- `xmc.agent.read` — read access to the agent endpoints (`sitesGetSitesList`,
  `sitesGetAllPagesBySite`, `pagesGetComponentsOnPage`).
- `xmc.sites.read` — read access to site / collection metadata
  (`listCollections`, `retrieveSite`).

No write scopes are needed. The atlas is pull-only by design.

### Required role to install

Installing the app at the organization level requires **Organization Admin** or
**Organization Owner** role on the Sitecore tenant. Editors do not need elevated
rights to use the surfaces once the app is installed.

### Smoke-test status

Real-tenant smoke (deploy → register → clipped-iframe screenshot vs poc-v2 on
five host-frame-testing axes) is the final verification gate before this app
is considered shipped end-to-end. Status is recorded in
[`project-planning/workflow/current-run.json`](project-planning/workflow/current-run.json)
under `smoke_outcomes` (`T092_vercel_deploy`, `T093_cloud_portal_registration`,
`T094_real_tenant_smoke`, `T113_manual_test_plan`).

## License / contact

License: **TBD** (no license selected yet).

Maintainer: see git log for current owners.
