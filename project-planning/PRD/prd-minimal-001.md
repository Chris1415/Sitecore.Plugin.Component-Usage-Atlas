# PRD Minimal — Atlas Snapshot Export

---
document_type: prd_minimal
artifact_name: prd-minimal-001.md
pairs_with_prd: products/component-usage-atlas/project-planning/PRD/prd-001.md
generated_at: 2026-05-03T10:14:41Z
run_manifest: products/component-usage-atlas/project-planning/workflow/run-20260503T101441Z.json
consumed_by:
  - Developer (08) under `/implement`
purpose: |
  Condensed north-star for implementation of Atlas Snapshot Export (PRD-001).
  Agent 08 reads this plus the enriched task breakdown only — not the full PRD,
  architecture, or PRD-000.
---

## Problem

The Component Usage Atlas (PRD-000, shipped 2026-04-28) holds a live, in-memory atlas that dies with the tab. Editors who want to compare the tenant's rendering footprint over time, share it with a colleague, or feed the data into another tool have no way to take it out of the iframe.

## Goal

Add a single Download button to each of the two existing surfaces (Dashboard Widget, Page Context Panel) that emits a portable snapshot of the atlas in the editor's choice of **JSON**, **CSV**, or **HTML** (HTML doubles as the path to PDF via the browser's print dialog). Architecture stays additive: same Mode A iframe, no new SDK calls, no new extension points, no backend.

## Non-negotiables

- **No new architecture surface.** No new extension points, no new API scopes, no backend, no Auth changes. ADR-0002 (Mode A) and ADR-0003 (no persistence) must still hold after this feature ships.
- **No filter applied to exports.** Search-box terms, sort, view-state — all ignored. Structural collection scope (PRD-000 US-3) IS respected. Language scope = exactly what the atlas scanned (typically single-language per site, per PRD-000 IS-13).
- **Three formats from a single button.** Each surface gets one Download button that opens a Blok-styled menu of three options (JSON, CSV, HTML). One file per click — no zip bundles, no multi-format downloads.
- **JSON = full data; CSV = lite (one row per rendering, no nested arrays); HTML = lite + summary header + print stylesheet.** Schema versioned (`atlas_export_schema_version: 1`). Stable deterministic ordering for diffability.
- **Construction is a pure function.** Signature `(atlas, scope, surface, format, surfaceContext) → Blob`. `surfaceContext` is a **click-time clone** passed by the caller; the construction function does not re-read any singleton or React context. Per ADR-0016.
- **Iframe-download mechanism is a P0 verification spike at /architect** before implementation begins. Mechanism: `Blob` + `URL.createObjectURL` + synthetic `<a download>` + programmatic click + revoke. Spike must verify the pattern works in BOTH `xmc:dashboardblocks` and `xmc:pages:context-panel` extension points on a real Cloud Portal install. Fallback strategy required if blocked.
- **No PII masking.** All editor-visible fields included (tenant, site/page paths, names, IDs, languages, timestamps). Telemetry events `export.attempt` / `export.success` / `export.fail` use the existing in-iframe ring buffer (ADR-0013).
- **Bundle delta ≤20KB gzipped.** No client-side PDF library — browser print dialog handles PDF. No new heavy dependencies.
- **Refresh-in-progress: button stays enabled.** Exports the **previous** completed atlas with the previous `scan_timestamp` and `is_partial: false` while a refresh runs in the background.
- **Tenant-name fallback:** when `application.context.tenantName` is unavailable, use **`tenant-<last-7-of-tenantId>`** uniformly across filename, JSON header, and HTML/CSV header. JSON `tenant.tenant_name` is `null` (not the fallback string) so tooling can detect the fallback case.

## In scope / out of scope

- **In scope:** Widget atlas snapshot (W1), Panel current-page snapshot (P1), JSON + CSV + HTML formats, single Download button per surface with format-picker menu, schema versioning, deterministic ordering, telemetry events, iframe-sandbox verification spike at /architect, Blok-styled UI plumbing, empty-state and partial-scan handling.
- **Out of scope:** Drawer exports (per-rendering / per-datasource standalone), filtered exports, multi-format zip bundles, client-side PDF library (`jsPDF` etc.), in-app snapshot diff/compare, scheduled / automated exports, persisted snapshot history, programmatic export API, cross-tenant consolidation, custom report templates, editor-permission downscaling. All deferred to Phase 2 / Phase 3 per PRD-001 § 5.

## Success criteria

- Both surfaces have a working Download button → format picker → file save flow.
- JSON re-exports of an unchanged atlas are byte-identical except for `exported_at` (DoD-3, AC-4.4).
- HTML print preview produces a clean PDF in Chromium in ≤2 user steps (DoD-4).
- Bundle delta ≤20KB gzipped (DoD-5).
- Iframe-download mechanism verified working in both extension points on a real Cloud Portal install (DoD-1).
- Empty atlas and zero-rendering-page exports both produce valid files (DoD-8 / IS-18 / AC-2.5).
- Telemetry surfaces `export.attempt` / `export.success` / `export.fail` distributions in /test (DoD-9 / NFR-6.2).
- Schema version constant lives in exactly one file (DoD-7).
- Anti-metric guard at /ship: no "downloads/minute," "total bytes exported," or "format diversity per editor" on any dashboard (DoD-6).

## Key constraints & assumptions

- **ADR-0002** (Mode A iframe-only) must continue to hold — verify at /ship.
- **ADR-0003** (no persistence) must continue to hold — verify at /ship.
- **ADR-0010** (module singleton state) is the source of atlas data; export reads via the singleton at click time only.
- **ADR-0013** (in-iframe telemetry ring buffer) is the only telemetry transport.
- **ADR-0015** (export-as-v1-feature, supersedes PRD-000 OS-15) — supersession is intentional and recorded.
- **ADR-0016** (export construction is pure, surfaceContext is click-time clone) — implementer must NOT re-read singletons or React context inside the construction function.
- **ADR-0017** (iframe download mechanism + fallback hierarchy) — primary mechanism is `Blob + URL.createObjectURL + synthetic <a download>`. Verification spike is **T001 of `/task-breakdown`** — runs against a real Cloud Portal install on **both** extension points before any export feature code is written. Fallback chain F1 (window.open) → F2 (clipboard JSON) → F3 (hard-fail toast) is engineered only if the spike fails on either surface.
- **ADR-0018** (no client-side PDF library) — HTML + browser print dialog is the only PDF route in v1. Bundle delta capped at ≤20 KB gzipped (DoD-5).
- **ADR-0019** (export schema versioning policy) — `ATLAS_EXPORT_SCHEMA_VERSION` constant lives in **one** file: `src/atlas/export/schema-version.ts`. Adapters import from there; tests assert via the import; no literal `1` may appear elsewhere. Bump rules are exhaustive in the ADR — read them before changing any field.
- **ADR-0020** (tenant identity resolution path correction) — PRD shorthand `application.context.tenantName` does **not** match the SDK shape. Canonical access is `application.context.resourceAccess[0].tenantName` (verified against `node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79`). Use the new `requireTenantIdentity(ctx)` resolver in `core/tenant-identity.ts` (sibling of the existing `requireContextId`); construction function reads identity from `surfaceContext.tenant`, never from `application.context`.
- **The export module lives under `src/atlas/export/`** (OQ-7 confirmed). Format adapters: `json.ts`, `csv.ts`, `html.ts`. Shared header builder + filename builder + schema version constant alongside.
- **ADR-0021** (three-action egress pageshot pattern, 2026-05-04) — Save is canonical (matches PRD-001 IS-15 / FR-3 spec) but **renders disabled** in the current Marketplace iframe sandbox; Open (`window.open(blobUrl, '_blank')`) and Copy (`navigator.clipboard` — text for JSON/CSV, `ClipboardItem` for HTML with text/plain peer) ship as **primary user-visible actions**. The egress UX is: format picker → three-action cluster. PRD shorthand "Download button" is superseded — see the amended task breakdown § 4c-4 for the implementer contract. Pageshot precedent: `products/pageshot/site/next-app/components/use-open-image.ts` + `use-copy-image.ts` + `use-download-image.ts`.

## Handoff

- **Full PRD:** `products/component-usage-atlas/project-planning/PRD/prd-001.md` (for humans and upstream agents only — not loaded by agent 08 in normal flow.)
- **Executable contract:** `products/component-usage-atlas/project-planning/plans/task-breakdown-20260503T101441Z.md` after QA (07) enrichment (does not yet exist; written by `/task-breakdown`).
- **P0 verification spike** (PRD-001 R1, OQ-1, § 9.5): iframe-download mechanism in both extension points. Must complete before /implement begins.
