# ADR-0003: No persistence in v1 — live in-memory atlas

## Status

Accepted

## Context

The atlas requires aggregating sites → pages → components for an entire tenant (potentially thousands of pages). The naïve question is: where does the resulting index live?

Options considered:
1. **External store** (Vercel KV, Postgres, Supabase) — fast warm reads, requires backend infrastructure (violates ADR-0002 / DoD-1).
2. **Browser IndexedDB** — persistent across tabs, no backend needed, but introduces a non-trivial schema-migration burden and stale-data risk.
3. **Sitecore item-bucket as storage** — keep the index in Sitecore itself; sidesteps external infra but couples the app to write authority and complicates permissions.
4. **Ephemeral on-demand** — no persistence at all; rebuild the atlas live from agent endpoints whenever the editor opens a surface.
5. **Push-on-publish webhook** — would require backend; rejected for the same reason as (1).

Discovery confirmed editors are willing to wait for a live scan if the wait is well-paced (PRD § 4 A-PERS-3, S6 metric). The marketplace-app-ideas backlog tags this app as the **first to exercise multi-step tenant graph fetching** — making the live path the load-bearing experiment, not a workaround.

## Decision

**No persistence layer of any kind in v1.** The atlas is built fresh in the iframe's JS heap on demand, cached for the lifetime of the browser tab, and discarded when the tab closes.

Concretely:
- Atlas state is held in a module-singleton (per ADR-0004's two-surface app, the singleton is shared across both extension-point mounts within the same iframe).
- Cache invalidation triggers: explicit "Refresh atlas" action, scope change (collection filter), root unmount.
- Cross-tab sync is **not** in v1 (per IS-14): two open tabs = two independent scans.
- IndexedDB, localStorage, sessionStorage, cookies, external KV/DB, and item-bucket storage are all forbidden as persistence mechanisms in v1.
- Refresh is **always full** (no incremental refresh — IS-15). Editors are warned via tooltip.

## Consequences

**Easier:**
- No schema migration; no stale-data reconciliation; no eviction policy beyond "tab closes."
- The data the editor sees is always current as of the moment the scan started — there is no "but the index is X minutes old" question.
- Trivially testable — index-building logic is a pure function from raw agent responses to `Atlas`.
- Honors the zero-infra non-negotiable (DoD-1).

**Harder:**
- First-load on a new tab pays full scan cost. NFR-1.1 sets <30s on ~1k pages as the contract; tenants beyond 5k pages may exceed editor patience (R1, OQ-1).
- Two open tabs duplicate the work and the API load. Acceptable for v1 dogfood scale; revisit if S5 retention shows multi-tab editors are a meaningful cohort.
- No "what changed since last scan" diff is possible without persistence (OQ-8 — explicitly Phase 2).
- If a customer with a 10k-page tenant adopts the app, their first-load wait may be unacceptable; we have no compensating mechanism in v1 except cancel-with-partial-results (US-1 AC-1.2).
- Loss of long-lived analytics (e.g., "rendering X went from 50 to 5 usages over Q2") — explicitly Phase 2.

**Phase-3 escape hatch:** when persistence becomes necessary, the planned path is the **Standalone extension point** with an external store (per `xmc.md` § 2c). That would supersede this ADR and require ADR-0002 to be revisited.

**Forbidden in this ADR:**
- Any code path that writes to IndexedDB/localStorage/cookies/external store as part of the scan flow.
- Any "background scan" / "scan on idle" mechanism — scans are always editor-initiated.
- Any "warm cache from another user's scan" mechanism — there are no shared caches in v1.

## Date

2026-04-27
