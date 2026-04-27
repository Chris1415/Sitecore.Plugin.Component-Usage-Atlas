// T012 — Single import surface for the Marketplace provider hooks.
//
// This module is intentionally a thin re-export of the scaffold's
// `components/providers/marketplace.tsx`. Consumers in `core/`, `lib/sdk/`,
// and `components/` should import from `@/lib/sdk/client` rather than reach
// into the provider file directly. This keeps the SDK-touching surface
// confined to a single import path so future provider refactors only need
// to update this re-export.
//
// DO NOT add behavior here. The scaffold's provider is the canonical wiring
// (see § 4c-5 / ADR-0014). Patching it would require an architecture change.

export {
  MarketplaceProvider,
  useAppContext,
  useMarketplaceClient,
} from '@/components/providers/marketplace';
