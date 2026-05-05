# Architectural Decisions — Component Usage Atlas

> Curated, themed summary of every load-bearing architectural decision, with a
> one-line rationale and a link to the full ADR. The ADRs themselves live in
> `project-planning/ADR/` and capture context, alternatives, decision,
> consequences, and follow-ups.

All ADRs below are **Accepted** (effective for v1).

## Foundational

| ADR | Title | Rationale | Link |
|-----|-------|-----------|------|
| **ADR-0001** | Use ADRs as the architecture backbone | One decision per file, append-only history; the architecture blueprint is a snapshot — the ADRs are the truth. | [adr-0001](../project-planning/ADR/adr-0001-use-adrs-as-architecture-backbone.md) |

## Mode and persistence

| ADR | Title | Rationale | Link |
|-----|-------|-----------|------|
| **ADR-0002** | Mode A iframe-only — no backend, no Mode B | Portal-brokered auth in the iframe; no `experimental_createXMCClient`; no server. Removes a deployment, a secret store, and a fleet of failure modes for a v1 that does not need them. | [adr-0002](../project-planning/ADR/adr-0002-mode-a-iframe-only-no-backend.md) |
| **ADR-0003** | No persistence in v1 — live in-memory atlas | The atlas dies with the tab. No IndexedDB, no localStorage, no external store. Trades cold-scan latency for zero infra and zero stale-cache reasoning. | [adr-0003](../project-planning/ADR/adr-0003-no-persistence-live-in-memory-atlas.md) |

## Surfaces and identity

| ADR | Title | Rationale | Link |
|-----|-------|-----------|------|
| **ADR-0004** | Two surfaces in one Marketplace app | One app registration covers `xmc:dashboardblocks` (widget) and `xmc:pages:context-panel` (panel). Single bundle, single auth, two iframe entry points. | [adr-0004](../project-planning/ADR/adr-0004-two-surfaces-single-app.md) |
| **ADR-0005** | Identity model — rendering = definition ID, datasource = item ID | Editors see display names; collisions get a `· <last-7-of-id>` suffix with the full ID in tooltip. Item IDs never appear as primary identifiers. | [adr-0005](../project-planning/ADR/adr-0005-rendering-and-datasource-identity-model.md) |
| **ADR-0006** | Direct datasource bindings only in v1 | v1 counts only datasources returned directly by `pagesGetComponentsOnPage`. Inherited (page designs / partial designs), personalized, A/B-variant, and token-resolved bindings are NOT counted. Editor-visible "Direct bindings only" affordance is mandatory on both surfaces. | [adr-0006](../project-planning/ADR/adr-0006-direct-datasource-bindings-only.md) |

## Stack and tooling

| ADR | Title | Rationale | Link |
|-----|-------|-----------|------|
| **ADR-0007** | Use Marketplace Client-Side scaffold (Scaffold 2) | Start from the Sitecore-maintained Next.js + Radix + Nova preset scaffold rather than rolling our own; `MarketplaceProvider` is wired correctly out of the box. | [adr-0007](../project-planning/ADR/adr-0007-scaffold-marketplace-client-side.md) |
| **ADR-0008** | Stay on Next.js + Turbopack — do not switch to Vite | The scaffold's Next.js 16 default is sufficient; switching would burn a half-day for zero behavior delta and lose Turbopack's fast HMR. | [adr-0008](../project-planning/ADR/adr-0008-bundler-stay-on-nextjs.md) |
| **ADR-0009** | Blok (Sitecore design system) as the UI layer; semantic tokens via registry | Blok primitives via the shadcn registry — no copied tokens, native parity with Pages dark/light, theme drift handled upstream. | [adr-0009](../project-planning/ADR/adr-0009-blok-as-ui-layer.md) |
| **ADR-0010** | Atlas state via module-level singleton + `useSyncExternalStore` | No Zustand, no Redux, no Context. A 100-line tiny pub/sub plus React's external-store hook keeps state survival across mount/unmount cheap and portable. | [adr-0010](../project-planning/ADR/adr-0010-state-module-singleton.md) |

## Scan engine and UX

| ADR | Title | Rationale | Link |
|-----|-------|-----------|------|
| **ADR-0011** | Loading visualization in v1 — branded animation; generative bloom and mini-game deferred | The v2 *Console Operator* CSS-only animated progress strip ships in v1; the generative-art bloom and the mini-game are gated on Phase 2 if the "felt fast" pulse underperforms. | [adr-0011](../project-planning/ADR/adr-0011-loading-visual-branded-animation.md) |
| **ADR-0012** | Scan concurrency = 8; exponential backoff with jitter on rate-limit; 12s per-page timeout | Default concurrency 8 balances throughput against agent-endpoint rate limits; `withBackoff` keeps retries bounded; per-page timeout drops a stuck request without aborting the scan. | [adr-0012](../project-planning/ADR/adr-0012-scan-concurrency-and-backoff.md) |

## Observability

| ADR | Title | Rationale | Link |
|-----|-------|-----------|------|
| **ADR-0013** | Telemetry stays in-iframe — `console.info` markers + in-memory ring buffer; zero external egress | No `postMessage` to host, no `fetch` outside the SDK, no `sendBeacon`, no PII or tenant identifiers. CI grep gate plus a Vitest conformance test enforce both rules. | [adr-0013](../project-planning/ADR/adr-0013-telemetry-in-iframe-only.md) |

## Routing

| ADR | Title | Rationale | Link |
|-----|-------|-----------|------|
| **ADR-0014** | Root route `/` returns `notFound()` | Outside the Cloud Portal iframe, `<MarketplaceProvider>` never resolves; a public root would be a UX trap. Smoke-test rule: always hit `/widget` or `/panel` directly. | [adr-0014](../project-planning/ADR/adr-0014-root-route-notfound.md) |

## Snapshot Export (PRD-001 — 2026-05-05)

| ADR | Title | Rationale | Link |
|-----|-------|-----------|------|
| **ADR-0015** | Export as v1 feature — supersedes PRD-000 OS-15 | Discovery reframed export from an IA / dev secondary nicety into a first-class editor-driven job (snapshot-over-time, share-with-stakeholder). PRD-001 ships JSON + CSV + HTML from both surfaces in v1. | [adr-0015](../project-planning/ADR/adr-0015-export-as-v1-feature-supersedes-prd000-os15.md) |
| **ADR-0016** | Atlas export construction is a pure function; `surfaceContext` is a click-time clone | `buildExport(atlas, scope, surface, format, surfaceContext) → Blob` reads no module singletons, no React context, no `window` globals beyond `Blob` / `URL`. Callers deep-clone surface state at click time so AC-2.7 mid-navigation behavior is a contract, not a TOCTOU bug. | [adr-0016](../project-planning/ADR/adr-0016-export-construction-pure-surfacecontext-clone.md) |
| **ADR-0017** | Iframe download mechanism + fallback hierarchy *(superseded in part by ADR-0021)* | Specifies the canonical Save mechanism (`Blob` + `URL.createObjectURL` + synthetic `<a download>` + click + revoke). § Amendment 1 records the T001 spike outcome (2026-05-04 — silent_block on both extension points) and points at ADR-0021 for the new posture. The Save mechanism specification is preserved; the F1/F2/F3 fallback cascade is replaced. | [adr-0017](../project-planning/ADR/adr-0017-iframe-download-mechanism-and-fallback-hierarchy.md) |
| **ADR-0018** | No client-side PDF library in v1; HTML + browser print is the only PDF route | `jsPDF` / `pdfmake` / `pdf-lib` blow the 20 KB bundle cap by 4–15× and fight the browser's native typography on long tables. HTML output's print stylesheet hands pagination + repeated headers + font fallback to the browser for free. | [adr-0018](../project-planning/ADR/adr-0018-no-clientside-pdf-library-html-print-only.md) |
| **ADR-0019** | Atlas export schema versioning policy | `ATLAS_EXPORT_SCHEMA_VERSION` constant lives in **one** file (`core/atlas/export/schema-version.ts`); CI audit (`npm run check:schema-version`) enforces. Exhaustive bump rules: adding optional top-level fields = no bump; removing / renaming / changing semantics / reordering = MAJOR bump. | [adr-0019](../project-planning/ADR/adr-0019-export-schema-versioning-policy.md) |
| **ADR-0020** | Tenant identity for exports resolves via `application.context.resourceAccess[0]` | The PRD's shorthand `application.context.tenantName` doesn't match the SDK shape. Verified against `node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79`. New `requireTenantIdentity()` resolver returns `{ tenantId, tenantName: string \| null }`; the filename builder synthesizes the `tenant-<last-7>` fallback so the resolver stays semantically honest. | [adr-0020](../project-planning/ADR/adr-0020-tenant-identity-resolution-via-resourceaccess.md) |
| **ADR-0021** | Three-action egress (Save + Open + Copy) per pageshot precedent | Adopts the proven pattern from the sibling Pageshot product after the T001 spike confirmed the iframe sandbox blocks the canonical Save path. Save renders disabled and stays in code as future-proof; Open (`window.open`) and Copy (`navigator.clipboard`) ship as primary user-visible actions. The HTML format adds `text/html` + `text/plain` ClipboardItem peers so receivers paste either formatted or raw markup. | [adr-0021](../project-planning/ADR/adr-0021-three-action-egress-pageshot-pattern.md) |

## Sitecore

The Sitecore-specific decisions are spread across themes above:

- **Scaffold** — ADR-0007 (Marketplace Client-Side scaffold).
- **Architecture variant** — ADR-0002 (Mode A iframe-only).
- **Design system** — ADR-0009 (Blok via shadcn registry).
- **Extension points** — ADR-0004 (two surfaces, one app registration).
- **SDK contract corrections** — ADR-0020 (tenant identity), ADR-0017 § Amendment 1 (silent_block in iframe sandbox), ADR-0021 (three-action egress).

If you're rebuilding this app from scratch, read those seven ADRs first, then
follow the `sitecore:setup-marketplace-client-side` skill.

## How to add a new ADR

1. Copy `project-planning/ADR/template.md` to a new file
   `adr-NNNN-<short-slug>.md`. Use the next available number (current
   highest is 0021).
2. Fill in **Status**, **Context**, **Decision**, **Consequences**, and
   **Follow-ups**.
3. Add a row to this file under the appropriate theme group with a
   one-line rationale and a link.
4. If the new decision supersedes an older ADR, mark the older ADR's
   **Status** as `Superseded by ADR-NNNN` (or `Superseded in part by ADR-NNNN`
   if only some aspects shift) and leave it in place — ADRs are append-only
   history.
