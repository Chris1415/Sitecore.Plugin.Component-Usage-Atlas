# ADR-0014: Root route `/` returns `notFound()`; smoke-test rule = always hit `/widget` or `/panel`

## Status

Accepted

## Context

The Marketplace Client-Side scaffold (ADR-0007) ships with Next.js App Router. The two iframe entries live at `/widget` (Dashboard Widget) and `/panel` (Page Context Panel).

`.agent/skills/sitecore/marketplace-sdk/extension-routes.md` § 5c-bis documents a known trap: the Marketplace `MarketplaceProvider`'s portal handshake **hangs** when the page is loaded outside the Cloud Portal iframe context (e.g., a developer hitting `http://localhost:3000/` directly during local dev). The provider is designed to listen for a `postMessage` from the parent portal frame; with no parent, it never resolves.

Two ways to handle this on the root route:

1. **Per-extension layout:** wrap each extension entry in its own `MarketplaceProvider` within the route's `layout.tsx`, leaving the app root layout unwrapped. Local dev on `/` works because no provider runs there.
2. **Root-level provider + `notFound()` on `/`:** keep `MarketplaceProvider` at the app root layout (one wrapping, simple to maintain), and have `app/page.tsx` return `notFound()`. Local dev on `/` shows a 404, not a hang. Cloud Portal never points at `/` — it always loads `/widget` or `/panel` with the postMessage parent in place.

Option (2) is simpler and matches the "extensions are leaves; root is closed" mental model. Option (1) is more flexible but doubles the provider wiring.

## Decision

**Adopt option (2): keep `MarketplaceProvider` at the app root layout; `app/page.tsx` returns `notFound()`.**

Concretely:

- `app/layout.tsx` wraps `<MarketplaceProvider>{children}</MarketplaceProvider>` once at the root.
- `app/page.tsx` is:
  ```tsx
  import { notFound } from 'next/navigation';
  export default function RootPage() {
    notFound();
  }
  ```
- Cloud Portal Route URLs in the Marketplace registration point only at `/widget` and `/panel`. The `/` route is unreachable from the portal.
- **Local smoke-test rule:** developers test by navigating directly to `http://localhost:3000/widget` or `http://localhost:3000/panel`. They **never** hit `http://localhost:3000/` during dev.
- The `README.md` in the product root and the Lead Developer's task breakdown § 4c-1 must call out this rule explicitly so future developers are not surprised by the hang on `/`.

## Consequences

**Easier:**
- One `MarketplaceProvider` wrapping. Simple maintenance; no per-route layout boilerplate.
- Future extension points added to this app (e.g., a custom field surface in Phase 3) inherit the provider without re-wrapping.
- The hang trap is replaced by a clean `404 Not Found` on `/` — observable, debuggable.

**Harder:**
- Developers who type `http://localhost:3000/` (the default in Next.js dev) see a 404. The trap moves from "silently hangs" to "obviously not the right URL." Mitigation: README + task breakdown call-out; consider a `redirect('/widget')` if the 404 confuses dogfood developers, but that risks masking the trap when the Cloud Portal handshake genuinely fails.
- Tooling that auto-opens `/` after `npm run dev` (some IDEs) lands on the 404. Acceptable; the hang is worse.

**Forbidden in this ADR:**
- Wrapping `MarketplaceProvider` per-route in a way that double-wraps when both surfaces mount.
- Pointing the Cloud Portal Route URL at `/` for any extension point.
- Removing the `notFound()` and serving real content on `/` — this is the one path that does NOT have a portal parent and would re-introduce the hang.

**Phase-3 considerations:** if the app gains a Standalone extension point (cross-tenant umbrella), that extension point may want its own picker UI which could legitimately live elsewhere. At that time, this ADR is revisited to decide whether the Standalone surface lives at `/standalone` (with provider wrapping) or whether the per-extension layout pattern (option 1) is adopted.

## Date

2026-04-27
