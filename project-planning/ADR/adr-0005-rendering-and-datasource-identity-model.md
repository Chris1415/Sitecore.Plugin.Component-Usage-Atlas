# ADR-0005: Identity model — rendering = definition ID, datasource = item ID

## Status

Accepted

## Context

The atlas indexes "components" across a tenant. The word *component* is overloaded in Sitecore:
- The **rendering definition** (template-level item describing the component) — typically `/sitecore/layout/Renderings/...` or under feature/foundation modules.
- The **rendering instance** (specific placement on a specific page, with parameters and a datasource binding).

Both are first-class. Two HeroV2 instances on different pages are *different placements* of the *same rendering definition*.

Editors think in terms of "which renderings are placed where" and "which datasources are bound where," not "which placements have parameter X." Discovery (Round 1+2) confirmed:
- Rendering identity = definition (Q15).
- Datasource references count as usage (Q16).
- Pages-not-items mental model — editors should not normally see item IDs.

A consistent identity model is load-bearing for index keying, deduplication, display name handling, and click-through targets.

## Decision

### Rendering identity

**A rendering's identity is its rendering definition item ID** (returned by `xmc.agent.pagesGetComponentsOnPage` in the per-component response shape). All instances of the same rendering on different pages share one entry in `renderingIndex`.

**Display name resolution order:**
1. The display name returned by the agent endpoint per the rendering definition.
2. Fallback to the rendering's name field.
3. Fallback to `(unnamed)` with the rendering ID as a badge.

**Display-name collisions** are handled per IS-16 / FR-9: rows are grouped by ID; suffix `· <last-7-of-id>` is appended to disambiguate at render time. Tooltips expose the full ID. Editors get one row per *distinct rendering definition*, not one row per *display name*.

**Renderings without a definition reference** (legacy / orphan placements) are recorded under a synthetic rendering ID with display name `(unknown rendering)` and an "unknown" badge — they are not silently merged with named entries (relates to OQ-9; final treatment confirmed during `/architect`).

### Datasource identity

**A datasource's identity is its content item ID** (returned on the rendering's `Datasource` property). The path representation may vary (cloned items, language fallbacks, source-vs-clone resolution); the item ID is canonical.

**Datasource display:**
1. Item display name from the agent endpoint when available.
2. Fallback to the item path (last segment).
3. Fallback to `(missing)` with a warning badge if the datasource ID does not resolve in the tenant content tree (per AC-2.5).

### Page reference shape

```ts
type PageRef = {
  pageId: PageId;       // page item ID
  pageName: string;     // display name
  sitePath: string;     // route path under the site
  siteId: string;
  siteName: string;
  language: string;     // site default for v1 (per IS-13)
  collectionId?: string;
};
```

### Editor abstraction line

**Item IDs do not appear as primary identifiers in any list, drawer, or counter.** They may appear as:
- Tooltip content on disambiguation suffixes.
- Copyable badges in debug-friendly affordances.
- Click-through hrefs (transparent to the user).

**Display names are the primary identity in the UI.** This is the "pages-not-items" abstraction line from PRD § 4 / A-PAIN-5.

## Consequences

**Easier:**
- Indexing by ID is unambiguous regardless of language fallbacks, clones, or display-name churn.
- Counts cannot be inflated by display-name collisions or deflated by display-name renames.
- The "+N other pages" counter is a stable claim because it counts page refs against a stable rendering or datasource ID.

**Harder:**
- The UI must always carry the resolution from ID → display name. The architecture must include a rendering-definition cache to avoid N+1 calls to look up names during result rendering (architect detail).
- Display-name collisions force the disambiguation UI to exist from day one (FR-9). Cannot be deferred.
- Cloned datasources may show as "the same" datasource even when the editor thinks of them as distinct site-local copies. Acceptable for v1; revisit if editor feedback contradicts.
- Renderings without a definition reference need an explicit `(unknown rendering)` treatment — silently dropping them would under-count impact.

**Forbidden in this ADR:**
- Indexing by display name.
- Silently merging two renderings with the same display name into one row.
- Showing item IDs as primary identifiers in lists, drawers, or counters.
- Casting `null/undefined` IDs to strings — guard the absence and surface it.

## Date

2026-04-27
