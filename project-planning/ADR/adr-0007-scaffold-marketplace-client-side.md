# ADR-0007: Use Marketplace Client-Side scaffold (Scaffold 2)

## Status

Accepted

## Context

Component Usage Atlas needs a starting codebase. `.agent/skills/sitecore/setup/scaffold.md` defines three sanctioned scaffolds:

1. **Scaffold 1 — Sitecore Content SDK CLI** (`create-content-sdk-app`) — for headless rendering hosts on top of XM Cloud. Not applicable: this is a Marketplace app, not a head app (PRD § 9.3 explicitly opts out of the CLAUDE.md `create-content-sdk-app` rule).
2. **Scaffold 2 — Marketplace Client-Side** — a Next.js 16 + Radix + Nova preset app that ships `MarketplaceProvider`, the `xmc` SDK module wired in, and shadcn/Blok-ready primitives. Mode A only (iframe + portal-brokered auth).
3. **Scaffold 3 — Marketplace Full-Stack** — adds Auth0, server actions, and `experimental_createXMCClient` for Mode B / backend integration. Adds an Auth0 tenant + secret-handling responsibility.

ADR-0002 already locks Mode A iframe-only, with no backend. ADR-0003 forbids persistence. The scan engine runs entirely in the iframe via `client.query('xmc.agent.*')`. Scaffold 3's Auth0 wiring and API routes are dead weight here — and worse, they'd violate ADR-0002 if accidentally used.

## Decision

**Use the Marketplace Client-Side scaffold (Scaffold 2).** Concretely:

- Bootstrap with the scaffold command documented in `setup/scaffold.md` for Scaffold 2 (Next.js 16 + Turbopack default, Radix primitives, Nova preset).
- Keep the scaffold's `MarketplaceProvider` wiring intact at the app root.
- Do **not** install `@auth0/nextjs-auth0`, `experimental_createXMCClient`, or any server-action paths from Scaffold 3.
- Do **not** add `/api` routes. Mode A means all data calls flow through `client.query(...)` from the iframe.
- The single Marketplace registration covers both extension points (per ADR-0004) — the scaffold's two iframe entries (`/widget` and `/panel`) live as Next.js App Router routes.

## Consequences

**Easier:**
- Zero server infra to operate. Static-hostable bundle satisfies DoD-1.
- `MarketplaceProvider` and the `xmc` module are pre-wired — the scan engine only adds business logic.
- Blok integration path (ADR-0009) maps cleanly to the scaffold's shadcn registry pattern.
- Aligns with the agent skill catalog's verified scaffold runs (Run 7+ for Standalone, Scaffold 2 lineage).

**Harder:**
- Cannot pre-compute, schedule, or persist results outside the iframe — ADR-0003 already accepts this.
- If a Phase-3 persistence requirement materializes, this ADR must be revisited and likely superseded by an ADR that introduces a separate companion app on Scaffold 3 (the standalone extension point pattern from `xmc.md` § 2c).
- Cross-tenant umbrella aggregation is not possible from this scaffold's tenant-scoped extension points — explicitly Phase 3.

**Forbidden in this ADR:**
- Adding Auth0 / API routes / server actions to this codebase.
- Importing `experimental_createXMCClient` anywhere.
- Switching to a different starter (e.g., a custom Vite scaffold) — that's a separate decision (ADR-0008 keeps Next.js).

## Date

2026-04-27
