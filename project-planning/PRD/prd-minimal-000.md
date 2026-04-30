# PRD Minimal — Component Usage Atlas

---
document_type: prd_minimal
artifact_name: prd-minimal-000.md
pairs_with_prd: products/component-usage-atlas/project-planning/PRD/prd-000.md
generated_at: 2026-04-27T10:49:55Z
run_manifest: products/component-usage-atlas/project-planning/workflow/run-20260427T104955Z.json
consumed_by:
  - Developer (08) under `/implement`
purpose: |
  Condensed north-star for implementation. Keeps token use low: agent 08 reads this plus
  the enriched task breakdown only — not the full PRD or architecture doc.
---

## Problem

Sitecore content editors lack a fast, in-context way to see where a rendering or its bound datasource is used across a tenant. Today they cannot answer "what else breaks if I publish/delete/modify this?" without manual hand-traversal in another tool. Pre-deletion verification stalls; pre-publish edits ship with hidden impact.

## Goal

Ship a Sitecore Marketplace app — `Component Usage Atlas` — that gives editors a **live, tenant-wide view of where renderings and their datasources are used**, on two surfaces simultaneously: a **Dashboard Widget** (component-centric search) and a **Page Context Panel** (page-centric impact). The app runs entirely in the iframe via the Marketplace SDK; no backend, no persisted index. A scan walks `xmc.agent.sitesGetSitesList → sitesGetAllPagesBySite → pagesGetComponentsOnPage` on demand and caches results for the browser-tab lifetime. Wait time is absorbed by a polished, branded loading experience.

## Non-negotiables

- **Mode A only** — iframe app via `@sitecore-marketplace-sdk/client` + `/xmc`. No Mode B, no backend, no external store, no cron. (ADR-0002)
- **Live in-memory atlas** — no persistence layer of any kind in v1. The atlas dies with the tab. (ADR-0003)
- **Two surfaces in one app** — `xmc:dashboardblocks` (widget) + `xmc:pages:context-panel` (panel). Single app registration covers both. (ADR-0004)
- **Rendering identity = rendering definition item ID. Datasource identity = item ID.** Editors see display names; item IDs only appear as tooltips/badges. (ADR-0005)
- **Direct datasource bindings only.** v1 counts only datasources returned directly by `xmc.agent.pagesGetComponentsOnPage` for the page. Inherited (page designs/partial designs), personalized, A/B-variant, and token-resolved bindings are NOT counted. Editor-visible "ⓘ Direct bindings only" affordance is mandatory. (ADR-0006)
- **`sitecoreContextId` guard-clause** — never `as string`. Resolve from `application.context`; throw/render-error if absent. (xmc.md § 12a)
- **Promise.allSettled** for per-page fans-out; concurrency default 8; AbortController shared across all in-flight requests for cancel.
- **Per-page failure tolerance** — failures land in `skipped[]` with a typed reason (`forbidden`, `timeout`, `not_found`, `network_error`, `other`). Never abort the scan on a single page error.
- **Display-name collision** — group by rendering ID; suffix collisions with `· <last-7-of-id>`; tooltip exposes full ID.
- **No silent under/over-counting** — counts are upper bounds for the editor's visible universe (per IS-17 / FR-7.2).
- **TypeScript-first**; no `as any` / `as never` per `10-language.mdc`.
- **Anti-metric guard** at ship: no dashboard reports "scans/minute," "API calls served," or "session count" as a primary KPI.

## In scope / out of scope (very short)

- **In scope (v1):**
  - Dashboard Widget: search-first table; click-row inline detail (two-pane: pages + datasources, independent scroll); "Refresh atlas" action; collection-scope dropdown.
  - Page Context Panel: current-page rendering list; "+N other pages" counters; **per-row expansion exposing the bound datasource with its own cross-tenant counter** (S22/S23 reshape — replaces the original "Datasource impact group below the rendering list"); missing-datasource warnings; lazy item-name resolution against the Authoring API for GUID-only datasources with `Item · {short-id}` fallback.
  - Live in-memory scan engine, session-scoped cache, manual refresh.
  - Branded loading UX with phase progress, cancel, partial-result preservation.
  - Whole-tenant default + collection-narrowing setting (with edge-case behaviors per AC-3.4..3.6).
  - Display-name collision disambiguation (FR-9).
  - Skipped-page sub-drawer with typed reasons.
- **Out of scope (v1, see PRD-000 § 5 OS-1..OS-16 + § 15 Future Opportunities):**
  - Localization variants, history, version drift, partial/page designs propagation, scheduled-publish preview, A/B variants.
  - Persisted index / external storage / backend / cron.
  - Cross-tenant umbrella (Standalone extension).
  - Active interception of Pages publish/delete actions (SDK does not allow it).
  - "Unused placeholder" identification.
  - Bulk cleanup actions.
  - Mini-game during loading (gated on Phase-2 if S6 underperforms).
  - Incremental refresh.
  - Cross-tab cache sync.
  - Sort/export controls for IA / dev personas.

## Success criteria

1. Editor can open the widget, search a rendering, and see all using pages — first usable result in <30s on a 1k-page tenant (cold), <2s warm (S2/S3).
2. Editor can open the panel on a page and see, for each rendering, "+N other pages use this" — same for each datasource on the page (US-2 AC).
3. ≥80% of scans either complete OR are canceled-with-action (S4); intentional cancel is not a failure.
4. Zero external infrastructure in the deployed artifact (DoD-1).
5. All AC across US-1..US-5 pass on a representative test tenant (≥500 pages, ≥2 sites, ≥1 collection) — DoD-2.
6. Display-name collision and forbidden-page handling each have a passing scenario (DoD-5).
7. Anti-metric guard runs at ship (DoD-4).

## Key constraints & assumptions

- **Marketplace SDK constraints (load-bearing):**
  - Both target extension points are tenant-scoped — no cross-tenant fan-out (per `xmc.md` § 2c).
  - Cannot intercept publish/delete actions from inside an extension app — pull-only architecture is enforced by the platform, not by choice.
  - `sitecoreContextId` is required on essentially every `xmc.*` call; missing it returns 401/403 (per `xmc.md` § 12a).
- **Stack:** NOT a Content SDK / XM Cloud head app — the CLAUDE.md `create-content-sdk-app` rule does NOT apply. Use the marketplace-sdk skill setup. Architect picks Vite + React or the marketplace-app starter; recorded in ADR-0007 (created during `/architect`).
- **Scan boundaries (assumption A-PAIN-1..A-PAIN-5 in PRD):** persona claims about editor patience, tool-of-choice, and pages-not-items mental model are unvalidated; treat as working assumptions and validate post-launch via S1/S6 pulses.
- **Datasource scope (IS-12):** v1 = direct bindings only. Editor-visible affordance required. Promotion to inherited bindings is Phase 2.
- **Reference ADRs:** ADR-0002 (Mode A only), ADR-0003 (no persistence in v1), ADR-0004 (two-surface single-app), ADR-0005 (identity model), ADR-0006 (direct datasource bindings only).

## Handoff

- **Full PRD:** `products/component-usage-atlas/project-planning/PRD/prd-000.md` (for humans and upstream agents only — not loaded by agent 08 in normal flow).
- **Executable contract:** `products/component-usage-atlas/project-planning/plans/task-breakdown-<timestamp>.md` after QA (07) enrichment.
- **Recommended next command:** `/architect`.
