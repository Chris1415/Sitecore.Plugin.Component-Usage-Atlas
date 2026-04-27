# ADR-0002: Mode A iframe-only — no backend, no Mode B

## Status

Accepted

## Context

Component Usage Atlas needs to read tenant-wide page and component data (sites, pages, components per page) from XM Cloud and display it on two Marketplace extension points (Dashboard Widget + Page Context Panel).

The Marketplace SDK exposes two execution modes (per `.agent/skills/sitecore/marketplace-sdk/xmc.md` § 2):
- **Mode A** — iframe app via `ClientSDK.init({ modules: [XMC] })`. Auth and `sitecoreContextId` are brokered by the Cloud Portal via postMessage. No tokens or secrets in client code.
- **Mode B** — `experimental_createXMCClient` for server-to-server use (cron, microservices, server routes). Requires Auth0 token handling in our infrastructure.

The PRD (`prd-000.md` § 9.2, IS-10, NFR-7, G5) has a load-bearing **zero-infra** non-negotiable: the Marketplace install must require only the app registration. No external DB, no scheduled function, no server.

A live, on-demand scan from the iframe is feasible because the editor explicitly opts in by opening the widget/panel — the cost is paid when value is delivered.

## Decision

**Use Mode A only.** All XMC calls are made through `client.query(...)` / `client.mutate(...)` from the iframe SDK. No backend service exists in v1. No `experimental_createXMCClient` usage. No server-side route makes XMC calls.

Concretely:
- The deployable artifact is a static SPA bundle that mounts into `xmc:dashboardblocks` and `xmc:pages:context-panel` extension points.
- Auth tokens are never present in our code; the portal supplies context via `application.context`.
- `sitecoreContextId` is captured per the `requireContextId()` guard pattern documented in `xmc.md` § 12a — never `as string`.

## Consequences

**Easier:**
- Zero infrastructure to manage. The Marketplace registration *is* the deployment.
- Auth complexity is eliminated; no Auth0 wiring.
- Security boundary is simple — no secrets to leak.
- Aligns with the PRD's no-backend non-negotiable (DoD-1).

**Harder:**
- All scans are user-triggered and run in the iframe's JS heap. There is no place to pre-compute, schedule, or persist results across users.
- A scan re-runs from cold every time a tab is opened (until persistence is added in Phase 3 — see ADR-0003).
- Rate limits and concurrency tuning matter more, because every editor session pays the full scan cost.
- Cross-tenant umbrella aggregation is impossible — the extension points used here are tenant-scoped (per `xmc.md` § 2c). That's deliberately out of scope (Phase 3).
- If Sitecore restricts agent-endpoint access from iframe contexts in a future SDK version, this app must move to Mode B and acquire a backend — would supersede this ADR.

**Forbidden in this ADR:**
- Mixing Mode A and Mode B in the same module.
- Casting `sitecoreContextId` with `as string`.
- Any call path that requires a server route to function.

## Date

2026-04-27
