# Build decisions — Component Usage Atlas

Why this code is shaped the way it is, at component grain. Source files link here
instead of carrying the reasoning inline (rule `87-comment-economy`).

Architecture decisions live in `../project-planning/ADR/`.

Anchors are a contract — source comments point at them. Never rename one; supersede it.

> **Provenance.** Harvested 2026-08-12 from source-file header comments (690 lines, 22 blocks).

---

## The SDK boundary

### Every payload needs a DOUBLE unwrap {#double-unwrap}

**Decision.** `lib/sdk/queries.ts` is **the** SDK boundary. Every function takes an
already-narrowed `contextId: string` (never `string | undefined`) and returns a normalised
Atlas-domain shape, so `core/` and `components/` never touch a raw SDK type.

**`client.query`'s `QueryResult.data` is itself a hey-api envelope** — `{ data, error, request,
response }` — so reaching the actual payload means peeling **two** layers: `result.data?.data`. A
narrowing helper does this once and discriminates on `error`, which keeps `as` casts off the
boundary entirely.

**Three shapes verified against the real SDK types**, each of which would have been guessed wrong:

- `pagesGetComponentsOnPage` returns an **envelope**
  (`{ pageId, pageName, components?: ComponentModel[] | null, … }`), **not** a flat array.
- `sitesGetAllPagesBySite` returns a **flat array with no pagination** — there is no continuation
  token. Earlier prose hinting at a paginated loop is dead code; **one call per (site, language)
  pair**.
- `sitesGetSitesList` returns `{ sites: SiteBasicModel[] }`.

**The lean agent endpoint is missing fields the rich one has** — no `displayName`, no
`collectionId`, no `languages`. Callers needing those must go through the sites module path. To
resolve a site's collection, the code cross-references the collections list rather than assuming
the field exists.

### The Site shape has no `defaultLanguage` {#site-language-resolution}

**Decision.** The language resolver calls `retrieveSite` once per site, returns `languages[0]`
when present, and falls back to a hardcoded `'en'` when the list is empty or undefined.

**Why it exists at all.** The page-list endpoint **requires** a `language` query parameter, and
the SDK's `Site` shape exposes only `languages?: Array<string> | null` — there is no
`defaultLanguage` field to read.

**The cache is per-scan, not module-scoped** — the engine constructs one per `runScan`, so
successive scans pick up edits to a site's language list. **Module-scoping would leak stale
results across scans.**

**The resolver stays pure**; the friction-log entry recording a fallback is appended by the
engine, which is the logging surface.

---

## State and the scan engine

### Module-scoped state, `useSyncExternalStore`, no state library {#atlas-store}

**Decision.** The atlas is a module-scoped singleton — **not** on `window`, **not** in React
Context, **not** in Zustand / Redux / SWR. Surfaces subscribe through `useSyncExternalStore`.

**The snapshot is referentially stable and frozen** — mutations throw. `setAtlasState` is a
**no-op when the next state is the same reference**, so an unchanged set never notifies.

**A strict-mode double-mount guard is explicit.** `markScanStarting()` returns true the first
time and false the second; the action layer calls it **before** invoking the scan, and a `false`
return means the second invocation must no-op.

### ⚠ A selector returning a fresh object loops forever {#selector-primitive}

**Decision.** Slice selectors return a **primitive** by default
(`useAtlasSlice(s => s.kind)`), or a stable projection relying on the atlas being frozen and
only replaced on a real transition.

**Why this is called out.** `useSyncExternalStore` bails out of re-render when `getSnapshot`
returns an `Object.is`-equal value. A selector returning a **fresh object or array literal on
every call** puts React into an infinite loop — "Maximum update depth exceeded".

**No second-arg comparator is added.** React's API does not expose one, and adding a state
library is ruled out. A selector that legitimately needs structural memoisation memoises at the
call site.

**`getServerSnapshot` is the same function as `getSnapshot`** — the surfaces are `'use client'`
and never SSR, but React's API requires a function rather than `undefined`.

### Per-page failures are normal; site-level failures are not {#failure-classification}

**Decision.** Per-page rejections are collected by `Promise.allSettled`, classified, and land in
`Atlas.skipped` with a typed reason — the scan continues and ends `completed`, not `error`. Only
failures **outside** the per-page fan-out (site enumeration, catastrophic language resolution)
transition to `error`.

**Per-site language failures fall back to `'en'` so the scan continues** — a site-level fault is
not fatal.

**A site whose page list fails is a site-level fault, not a page-level skip** — sites without
pages cannot surface in `skipped` because the code never knew which page IDs belonged to them.

**Cancel preserves the partial atlas.** Cancelling mid-scan transitions to `canceled` with
`isPartial: true`, keeping everything collected so far.

**A state machine guards every transition**, so a buggy engine emits a clearly named error rather
than corrupting state.

**The engine never touches `client.query` directly** — all SDK access is brokered by the
queries/enumerator/fetcher modules, which is what makes "mock the SDK at the queries boundary"
hold as a testing rule.

### The panel surface subscribes; the widget never does {#panel-vs-widget}

**Decision.** The panel subscribes to `pages.context` so it re-paints when the editor navigates.
**The widget surface never subscribes** — its extension point does not expose that.

**The panel issues a SECOND independent fetch** for the active page's components **on a separate
abort bus**, so the rendering stack paints in under a second even on a 5k-page tenant whose
global scan is still running.

**On page switch:** cancel the old bus, fetch on a fresh one, and **do not re-trigger the global
scan**.

**The panel suppresses the KPI rail** — the viewport is narrow and the cross-tenant counter is
the primary signal there, not tenant aggregates.

---

## Export

### Construction is pure over its arguments {#export-purity}

**Decision.** `buildExport` reads inputs **only** from arguments — no store snapshot, no
application context, no React context, no `window` reads beyond what `Blob` requires
structurally. The caller clones the surface context **at click time** and passes both that clone
and the live atlas snapshot in.

**The contract this buys:** same arguments → **byte-identical Blob body**.

**Its only side effect is constructing the returned Blob.** `URL.createObjectURL` is deliberately
*not* here — that belongs to the trigger.

**The filename comes from the surface context + scope + format, never from the atlas** — the
atlas is body-only.

### Save is canonical but currently disabled; Open is the primary action {#three-actions}

**Decision.** Three actions ship. **Open** is the primary user-visible one, **Copy** is the
third, and **Save** ships **disabled**.

**Why.** The Marketplace iframe sandbox lacks `allow-downloads` but **grants `allow-popups`** —
so `window.open(blobUrl, '_blank', 'noopener,noreferrer')` works where a synthetic
`<a download>` does not.

**The Save mechanism stays canonical and future-proof.** The hook reports `unsupported` only when
the *browser* lacks the `download` attribute — a far stricter capability gap than the iframe
block. When Sitecore adds `allow-downloads`, the parent flips one prop and Save lights up **with
no code change**.

**⚠ `window.open` returning `null` is an imperfect blocked-signal.** With
`noopener,noreferrer`, browsers may return `null` **even when the popup actually opens**, because
`noopener` severs the opener relationship — a false positive reported live during smoke, where
the tab opened successfully. So `blocked` is treated as **advisory and transient**
(auto-reverting after 3.5s) rather than permanently disabling Open on a false negative.

**The blob URL is revoked after 60s**, so the new tab has time to read it.

**Copy is mode-aware:** JSON/CSV go through `writeText`; HTML goes through a `ClipboardItem`
carrying **both** `text/html` and a `text/plain` peer, so the editor can paste rich HTML into
Outlook or Pages **and** drop plain text into a code editor. A denial is **sticky** — no
auto-revert, and subsequent calls are no-ops.

**The denied message points at Open, not Download** — a deliberate divergence from the sibling
product, because Open is the primary action here.

### The download trigger's five-step pipeline {#trigger-download}

**Decision.** Create the object URL (failing here means the Blob exceeded browser limits), build
a synthetic anchor, **append it to the document** — detached anchors no-op in some browsers —
click inside a `try`/`catch` (a synchronous throw means the sandbox blocked it), then clean up in
a microtask.

Each failure mode maps to its own typed reason rather than a generic error.

### Export-format safety contracts {#export-safety}

**CSV** applies RFC 4180 quoting, and a **formula-injection guard**: any string field starting
with `=`, `+`, `-` or `@` gets a leading `'`. **Numeric fields are deliberately NOT guarded** —
`0` must not become `'0`. **UTF-8 with no BOM**; the consumer wraps it in a Blob with the charset,
and `﻿` is never prepended.

**HTML** escapes every interpolated string through a five-entity escape, in **both text and
attribute context**. **No `<script>` tags, no remote assets or fonts** — an inlined system-ui
fallback chain only. The print stylesheet is pinned exactly.

**Both are deterministic** — rows sorted by rendering id ascending, so re-export is byte-stable.

**The schema version is read from the header builder, never a literal** — no bare `1` appears in
any adapter.

### The tenant-name fallback is one canonical token, and JSON keeps `null` {#tenant-fallback}

**Decision.** When the tenant name is `null` (or slugifies to empty), the fallback is
`tenant-<last-7-of-tenantId>` — applied uniformly across the filename and the CSV/HTML header.

**⚠ JSON keeps the literal `null`, NOT the fallback string** — so downstream tooling can detect
the fallback case rather than being handed a synthesised name it cannot distinguish from a real
one.

**Filenames cap at 200 characters**, truncating the **page-name slug first** — dropping the
human-readable part before any other field.

---

## Evidence index

**No relocated evidence.** The one GUID the scanner flags in this app —
`{1D626D9D-5302-4741-97FD-882DD0A5016D}` in `site/lib/sdk/datasource-name.ts` — is an **illustrative
example inside a usage comment**, showing the short-id fallback format (`{1D626D9D-…}` →
`"Item · 1d626d9d"`). It names no real Sitecore item and belongs beside the function it documents
(rule `87` § 5 permits a short block explaining a non-obvious transform *in this function*).
Recorded here only so a future retention check does not read its absence as a loss.
