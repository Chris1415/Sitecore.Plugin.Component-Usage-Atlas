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

## How to add a new ADR

1. Copy `project-planning/ADR/template.md` to a new file
   `adr-NNNN-<short-slug>.md`. Use the next available number (current
   highest is 0014).
2. Fill in **Status**, **Context**, **Decision**, **Consequences**, and
   **Follow-ups**.
3. Add a row to this file under the appropriate theme group with a
   one-line rationale and a link.
4. If the new decision supersedes an older ADR, mark the older ADR's
   **Status** as `Superseded by ADR-NNNN` and leave it in place — ADRs are
   append-only history.
