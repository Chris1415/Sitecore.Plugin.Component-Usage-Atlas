# ADR-0008: Stay on Next.js + Turbopack — do not switch to Vite

## Status

Accepted

## Context

PRD § 9.3 left the bundler/build-stack decision open: Vite + React vs the Marketplace starter's default. The Marketplace Client-Side scaffold (ADR-0007) ships with **Next.js 16 + Turbopack**.

Considerations:

- **Bundle weight:** the app has two leaf routes (`/widget`, `/panel`) per ADR-0004. Each iframe entry should load only what its surface needs. Both Next.js App Router and Vite can produce per-route splits at acceptable bundle sizes for two short routes.
- **Integration cost:** switching off Next.js means re-implementing `MarketplaceProvider` wiring, re-integrating the shadcn/Blok registry path (Blok's components are imported via shadcn-style commands that resolve into the `app/`-rooted path), and re-establishing the per-route code split.
- **Dev experience:** the scaffold ships with a working `npm run dev` and host-frame test harness; replicating those on Vite is non-trivial and yields no measurable gain for a 2-route app with no SSR requirement.
- **SSR / SSG:** not used. The iframes render client-side after `MarketplaceProvider` resolves the portal context. Next.js routes use `'use client'` at the top-level of the route file and are effectively SPA pages.
- **Ecosystem signal:** every documented Marketplace dogfood run (PageShot, QuickCopy, prior runs in `marketplace-sdk/CATALOG.md`) uses the scaffold's bundler default.

There is no concrete bottleneck that would justify the integration cost of swapping bundlers.

## Decision

**Stay on the Marketplace Client-Side scaffold's bundler default — Next.js 16 + Turbopack.** Do not introduce Vite. Code-splitting is per Next.js App Router route (one chunk per `app/<route>/page.tsx`).

Concretely:
- `app/widget/page.tsx` — entry for the Dashboard Widget surface.
- `app/panel/page.tsx` — entry for the Page Context Panel surface.
- `app/page.tsx` — root route returns `notFound()` (per ADR-0014).
- Shared modules (`core/atlas-store.ts`, `lib/sdk/*`, UI primitives) live in app-relative folders and are tree-shaken into each route's chunk by Next.js.
- Build target is the scaffold's static-hostable output (no Node server in production).

## Consequences

**Easier:**
- Zero divergence from the scaffold's working baseline. `npm run dev` and the host-frame harness work out of the box.
- Documented and reproducible against `marketplace-sdk/CATALOG.md` runs.
- Per-route code split is automatic; no manual chunking.
- Future Blok / shadcn registry adds (per ADR-0009) follow standard scaffold paths.

**Harder:**
- Inheriting any future Next.js bundler decisions (e.g., Turbopack stability transitions). Mitigation: pin scaffold version in `package.json`; record the pinned version in `marketplace-sdk/CATALOG.md` per the "record resolved version" convention.
- The two-route static export still ships Next.js's runtime overhead. Acceptable for the iframe model — the iframe only loads the route it needs; the runtime is a one-time cost per iframe load.

**Forbidden in this ADR:**
- Introducing Vite / esbuild / Parcel as the primary bundler.
- Adding SSR or SSG paths — the iframe content renders client-side; do not add server-rendered routes that would require a Node runtime.
- Manually splitting chunks; rely on Next.js App Router route boundaries.

## Date

2026-04-27
