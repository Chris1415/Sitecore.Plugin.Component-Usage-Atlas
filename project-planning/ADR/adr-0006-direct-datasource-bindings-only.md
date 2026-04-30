# ADR-0006: Direct datasource bindings only in v1

## Status

Accepted

## Context

The PRD declares that datasource references count as usage (IS-6). But "datasource binding" is not one thing in Sitecore. A datasource can reach a page via several paths:

1. **Direct binding** — the datasource is set on the rendering's `Datasource` property at the page's layout level.
2. **Inherited from a page design / partial design** — the rendering is placed in a shared design and the datasource is set there; the page inherits the binding.
3. **Personalization rule binding** — a personalized variant of the rendering swaps the datasource for a specific audience.
4. **A/B variant binding** — variant-level binding for experiments.
5. **Token / parameter resolution** — the datasource is computed at render time from a token or parameter expression rather than a static binding.

The Round-1 critical review flagged the risk of silent under-counting (or over-counting) if the v1 scope is ambiguous: "the count shown to the editor must match their mental model — undercounting silently is worse than not shipping the feature."

Investigating the SDK surface (per `xmc.md` § 6 — `xmc.agent.pagesGetComponentsOnPage`), the response shape exposes the directly-bound datasource on the page's layout. Inherited / personalized / variant / token bindings are not surfaced in a single agent call; resolving them would require either (a) layered calls into the page-design and personalization APIs, or (b) computing the effective layout — both substantially expand v1 scope.

## Decision

**v1 counts only directly-bound datasources** — those returned on the rendering's `Datasource` property by `xmc.agent.pagesGetComponentsOnPage` for the active page's layout.

Specifically excluded from v1:
- Datasources inherited from page designs or partial designs (OS-4).
- Datasources resolved via personalization rules or A/B variant rules (OS-6).
- Datasources expressed via rendering parameter tokens or computed at render time.

**Editor-visible affordance is mandatory:** the widget and panel each carry a small `ⓘ Direct bindings only` badge. Hover/tap reveals: *"Counts include datasources bound directly on the page's layout. Inherited (page designs), personalized, A/B variant, and token-resolved bindings are not counted in this version."*

This is FR-8 and is implementable without design ambiguity.

## Consequences

**Easier:**
- The scan engine remains a single fan-out per page — no nested resolution into page-design hierarchies, personalization rules, or variant trees.
- Predictable performance budget; the data-fetching pattern in `xmc.md` § 13 applies as written.
- Editors who use simple direct bindings (the most common case) get accurate counts.

**Harder:**
- Tenants that rely heavily on page designs / partial designs will see *under-counts* relative to their mental model. This is partially compensated by the visible affordance, but inbound feedback is expected (R12).
- Phase-2 promotion to inherited bindings is a meaningful expansion: it requires either fetching the effective layout or layering page-design + page calls. That work is intentionally deferred.
- The atlas might tell an editor "this datasource has 3 usages" when the truth at delivery time is 30 (because 27 pages inherit through a design). The `ⓘ` affordance is the only safeguard. If editor pulse signals widespread confusion, OS-4 promotes to v1.1 / Phase 2.

**Forbidden in this ADR:**
- Including any inherited / personalized / variant / token-resolved bindings in v1 counts.
- Hiding the `ⓘ Direct bindings only` affordance — it must be visible on both surfaces wherever datasource counts appear.
- Naming the affordance vaguely (e.g., "Note") that does not communicate the v1 limitation.

**Phase-2 escape hatch:** once inherited binding is in scope, this ADR is superseded by an ADR that documents the chosen resolution strategy (eager vs. lazy, full effective layout vs. selective). The affordance copy changes accordingly.

## Date

2026-04-27
