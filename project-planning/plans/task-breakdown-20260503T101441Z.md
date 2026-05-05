# Development Execution Plan — Atlas Snapshot Export (PRD-001)

---
document_type: task_breakdown
artifact_name: task-breakdown-20260503T101441Z.md
generated_at: 2026-05-03T14:10:00Z
run_manifest: products/component-usage-atlas/project-planning/workflow/run-20260503T101441Z.json
source_inputs:
  - products/component-usage-atlas/project-planning/PRD/prd-001.md
  - products/component-usage-atlas/project-planning/PRD/prd-minimal-001.md
  - products/component-usage-atlas/project-planning/ADR/adr-0002-mode-a-iframe-only-no-backend.md
  - products/component-usage-atlas/project-planning/ADR/adr-0003-no-persistence-live-in-memory-atlas.md
  - products/component-usage-atlas/project-planning/ADR/adr-0007-scaffold-marketplace-client-side.md
  - products/component-usage-atlas/project-planning/ADR/adr-0009-blok-as-ui-layer.md
  - products/component-usage-atlas/project-planning/ADR/adr-0010-state-module-singleton.md
  - products/component-usage-atlas/project-planning/ADR/adr-0013-telemetry-in-iframe-only.md
  - products/component-usage-atlas/project-planning/ADR/adr-0015-export-as-v1-feature-supersedes-prd000-os15.md
  - products/component-usage-atlas/project-planning/ADR/adr-0016-export-construction-pure-surfacecontext-clone.md
  - products/component-usage-atlas/project-planning/ADR/adr-0017-iframe-download-mechanism-and-fallback-hierarchy.md
  - products/component-usage-atlas/project-planning/ADR/adr-0018-no-clientside-pdf-library-html-print-only.md
  - products/component-usage-atlas/project-planning/ADR/adr-0019-export-schema-versioning-policy.md
  - products/component-usage-atlas/project-planning/ADR/adr-0020-tenant-identity-resolution-via-resourceaccess.md
  - products/component-usage-atlas/project-planning/ui-design/ui-design-20260503T101441Z-v1.md
  - products/component-usage-atlas/pocs/poc-v1/ (winning clickdummy — visual source of truth)
consumed_by:
  - QA Specialist (07) enriches sections 9 + 10 + reorders Depends-on for TDD
  - Developer (08) implements from this file + prd-minimal-001.md only
next_input:
  - products/component-usage-atlas/project-planning/plans/qa-report.md (optional on minimal track)
---

## 1. Implementation Overview

PRD-001 is a **feature PRD** layered on the already-shipped PRD-000 atlas (shipped_with_caveats 2026-04-28). Scope is the snapshot export feature only — the existing scan engine, atlas state, surfaces, and telemetry buffer are reused untouched. Planning track is **minimal** (PRD + ADRs + this task breakdown; no separate architecture blueprint). The Marketplace Client-Side scaffold (ADR-0007) and Mode A iframe-only posture (ADR-0002) carry forward unchanged — no new extension points, no new SDK calls, no Auth0 work, no backend.

The work splits into a **P0 verification spike** (T001 — iframe-download mechanism per ADR-0017, runs against a real Cloud Portal install on both `xmc:dashboardblocks` and `xmc:pages:context-panel`; non-success forks the plan into the F1/F2/F3 fallback engineering branch), a **pure construction core** (build-export + format adapters JSON/CSV/HTML; ADR-0016 keeps construction free of singleton reads and React context — `surfaceContext` is a click-time clone), and **two surface integrations** (download button + format-picker menu + failure toasts on widget header and panel zone-2).

The export schema is versioned (ADR-0019, `ATLAS_EXPORT_SCHEMA_VERSION = 1` in a single source-of-truth file) and produces deterministic byte-stable output for diffability (DoD-3, AC-4.4). Tenant identity comes from `application.context.resourceAccess[0]` via the new `requireTenantIdentity` helper (ADR-0020) — never the PRD's shorthand `application.context.tenantName`. Bundle delta is capped at ≤20 KB gzipped (NFR-1.4 / DoD-5) — no client-side PDF library (ADR-0018); HTML print-to-PDF is the only PDF route. Three formats from a single Download button per surface, picker menu per the **Quiet Affordance** UI direction; POC at `pocs/poc-v1/` is the visual source of truth.

## 2. Epics

- **E1 — Spike + foundation.** Verify the iframe download mechanism on both extension points; install missing UI primitive (`@blok/sonner`); add the schema-version constant, telemetry event types, and the tenant-identity resolver.
- **E2 — Pure construction core.** SurfaceContext type, header-builder, filename-builder, size-estimator, build-export entry function. All unit-testable without React or the SDK; ADR-0016 purity contract.
- **E3 — Format adapters.** JSON (full data), CSV (lite, RFC 4180 quoting + injection guard), HTML (lite + summary header + inlined print stylesheet matching Blok body tokens). Each ≤300 LOC per NFR-5.1.
- **E4 — Download trigger + failure detection.** Blob → objectURL → synthetic `<a download>` → click → revoke per ADR-0017 primary mechanism; 5 s detection heuristic; clipboard-JSON F2 fallback (engineered only if T001 fails).
- **E5 — Surface integrations.** `<DownloadButton>` composite (widget label + panel icon-only), format-picker menu, success / generic-failure / sandbox-blocked toasts, "Why?" popover, wiring into `widget-surface.tsx` FreshnessRibbon and `panel-surface.tsx` zone-2.
- **E6 — Tests + verification.** Adapter unit tests, integration tests on both surfaces, schema-stability re-export test (DoD-3), bundle-size audit (DoD-5), HTML print-preview manual gate (DoD-4), empty-atlas + zero-rendering page tests (DoD-8), telemetry distribution check (DoD-9), antimetric guard wiring (DoD-6), host-frame visual smoke against POC clickdummy.

## 3. Feature Breakdown

### E1 — Spike + foundation

- F1.1 Iframe-download verification spike on both extension points.
- F1.2 Install `@blok/sonner` toast primitive via shadcn registry.
- F1.3 Schema-version constant — single source of truth.
- F1.4 Telemetry event types extension (`export.attempt` / `export.success` / `export.fail` / `clipboard_blocked`).
- F1.5 Tenant identity resolver `requireTenantIdentity` (ADR-0020).
- F1.6 Token gap remediation: `--shadow-popover`, `--color-sonner-success`.

### E2 — Pure construction core

- F2.1 `SurfaceContext` type + click-time clone helpers.
- F2.2 Header builder (shared metadata block: tenant, surface, scope, timestamps, totals, partial flags, languages_scanned, schema_version).
- F2.3 Filename builder (FR-6, slug rules § 9.4, 200-char ceiling, page-name truncation).
- F2.4 Size estimator (tiered: <5 MB / 5–50 MB / ≥50 MB).
- F2.5 `buildExport(atlas, scope, surface, format, surfaceContext) → Blob` — pure entry function.

### E3 — Format adapters

- F3.1 JSON adapter (full data, 2-space indent, deterministic ordering, schema § 10.1).
- F3.2 CSV adapter (lite columns § 10.2, RFC 4180 quoting, formula-injection guard, `#` header comment block).
- F3.3 HTML adapter (lite + summary header `<dl>` + table + `<footer>` + inlined `<style media="print">` per § 10.3 + § 4.7).

### E4 — Download trigger + failure detection

- F4.1 `triggerDownload(blob, filename)` — Blob + objectURL + synthetic anchor + click + revoke.
- F4.2 `detectFailure` — 5 s timeout heuristic + try/catch (ADR-0017 detection contract).
- F4.3 Clipboard-JSON fallback stub `fallbackClipboard(jsonString)` (F2 — engineered only if T001 fails OR sandbox-blocked code surfaces in production).

### E5 — Surface integrations

- F5.1 `<DownloadButton>` composite (widget outline label / panel icon-only ghost + tooltip).
- F5.2 `<FormatPickerMenu>` (three Blok DropdownMenuItems with title + description + size annotation tier).
- F5.3 Success toast (S6) + empty-atlas variant.
- F5.4 Generic failure toast (S7) — Retry + Why?.
- F5.5 Sandbox-blocked failure toast (S8) — Retry + Copy-JSON + Why?.
- F5.6 Why? popover (S9) — per-error-code copy.
- F5.7 Widget integration in `widget-surface.tsx` FreshnessRibbon.
- F5.8 Panel integration in `panel-surface.tsx` zone-2.

### E6 — Tests + verification

- F6.1 Unit tests for every leaf module.
- F6.2 Integration tests for download-button + format-picker on widget and panel.
- F6.3 Schema-stability re-export test (DoD-3 / AC-4.4).
- F6.4 Empty-state tests (DoD-8 / IS-18 / AC-2.5).
- F6.5 Bundle-size audit (DoD-5 / NFR-1.4).
- F6.6 Schema-version grep audit (DoD-7).
- F6.7 Antimetric guard wiring (DoD-6).
- F6.8 Telemetry distribution check (DoD-9 / NFR-6.2).
- F6.9 HTML print-preview manual gate on Chromium + Firefox + Safari (DoD-4 / AC-3.3 / AC-3.4).
- F6.10 Host-frame visual smoke against POC clickdummy ground truth.

## 4. Task Breakdown

For every task: stable Task ID; explicit `Depends on` (Task IDs or `none`).

**TDD ordering (post-QA enrichment):** Where TDD applies (see § 9), the RED test task is written BEFORE its corresponding implementation task. The implementation task's `Depends on` field includes the RED test task. The test file lives in source from the start; assertions fail (or import-error) until the implementation arrives, then pass without further test edits. Test tasks are titled `RED — ...` to make the ordering self-evident in the execution order. Non-TDD tasks (T001 spike, T002 install, T003 token provisioning, T004 single-constant SoT, T031 thin telemetry helpers, T034 popover, T035 toast helpers, T042–T050 audits and manual gates) preserve the LD's original ordering — see § 9 for the per-task TDD-applicability decisions.

### E1 — Spike + foundation

---

**Task ID:** T001
**Title:** Iframe-download mechanism verification spike (ADR-0017)
**Description:** Add a temporary "Download test fixture" button on **each** of the two surfaces (widget header + panel zone-2). Each button triggers the canonical primary mechanism with a 1 KB synthetic Blob: `new Blob([body], { type: 'application/json' })` → `URL.createObjectURL` → synthetic `<a download="atlas-spike-test.json">` → `appendChild(document.body)` → `click()` → `queueMicrotask(() => { a.remove(); URL.revokeObjectURL(url); })`. Deploy a build to the existing Cloud Portal install on a real test tenant. Verify on **both** extension points: `xmc:dashboardblocks` (route `/widget`) and `xmc:pages:context-panel` (route `/panel`). Capture results in the friction log (`project-planning/workflow/friction-log-20260503T101441Z.md`) under a new `download_smoke` section, one record per surface: `{ surface: 'widget' | 'panel', result: 'success' | 'silent_block' | 'console_error', browser: '<chromium-version>', timestamp: '<ISO>', console_excerpt?: '<text>' }`. Remove the temporary fixture button(s) before the next commit — they are spike code, not feature code. **Spike-task constraint:** this task is not implementation; it is a smoke spike. If either surface returns a non-success outcome, **HARD STOP**: open a /architect amendment task to revise ADR-0017 and select F1/F2/F3 fallback engineering before any T002+ work proceeds. This is the hard fork in the plan (see § 7 R-S1).
**Expected Output:**
1. Friction-log section `download_smoke` populated with two surface records (widget + panel).
2. Plain-English summary line in the run-manifest's `smoke_outcomes.download_spike`: `{ widget: '<result>', panel: '<result>', verdict: 'green' | 'fork-to-F1' | 'fork-to-F2' | 'fork-to-F3' }`.
3. Temporary fixture buttons removed; no diff in `widget-surface.tsx` / `panel-surface.tsx` after cleanup.
**Depends on:** none

**Outcome (2026-05-04):** COMPLETED with verdict `fork-to-pageshot-pattern`.
- Pass 1 (F0 — Blob + synthetic `<a download>` + click): `silent_block` on BOTH surfaces. Click handler fires (console.info diagnostic confirmed); no save dialog; no file lands in Downloads; no console error. Iframe sandbox lacks `allow-downloads` — known platform-level limitation, not per-app bug.
- ADR-0017 superseded in part by ADR-0021 (three-action pageshot pattern). Save preserved as future-proof; Open + Copy promoted to first-class actions.
- F1 (`window.open`) and F2 (clipboard) inherit production proof from `products/pageshot/site/next-app/components/use-open-image.ts:62` and `use-copy-image.ts:128` — same iframe context, working live. No fresh per-spike verification required at /architect; per-action live-host smoke runs at /test.
- Spike fixture cleanup: T001a (new) below.

---

**Task ID:** T001a
**Title:** Remove T001 spike fixtures from widget-surface and panel-surface
**Description:** Grep `T001-SPIKE-FIXTURE` across `products/component-usage-atlas/site/components/atlas/widget-surface.tsx` and `panel-surface.tsx`. Remove every block the marker comment guards: F0 helper `runDownloadSpike`, F1 helper `runDownloadSpikeF1`, sandbox-diagnostic `useEffect`, both buttons in each surface header. Verify `grep -r "T001-SPIKE-FIXTURE" products/component-usage-atlas/site/` returns zero matches. Run `npm run typecheck && npm run lint && npm run build` clean.
**Expected Output:**
1. Both surface files restored to their pre-T001 state (modulo any unrelated edits the user may have committed).
2. `grep` for `T001-SPIKE-FIXTURE` returns nothing.
3. Build + typecheck + lint pass clean.
**Depends on:** T001

---

**Task ID:** T002
**Title:** Install `@blok/sonner` toast primitive via shadcn registry (OQ-UI-1)
**Description:** Run `npx shadcn@latest add @blok/sonner` from `products/component-usage-atlas/site/`. The Blok registry is already wired in `components.json` (`"@blok": "https://blok.sitecore.com/r/{name}.json"`). The command writes `components/ui/sonner.tsx` (and any peer Toaster export). Mount the `<Toaster />` at the iframe-app root inside the widget and panel route entry points (`app/widget/layout.tsx`, `app/panel/layout.tsx` — pick the layout that already wraps `<MarketplaceProvider>`). Confirm the install does not regress bundle: capture `next build` output size before and after and record delta in the friction log under `bundle_smoke`. **Toast usage shift (per ADR-0021 supersession):** the `@blok/sonner` install is still required, but toasts now appear only for **cross-cutting events** (e.g. blob construction failed before any action ran) — per-action failures (Open `'blocked'`, Copy `'denied'`, Save `'unsupported'`) surface inline status copy on the action affordance itself, NOT as toasts. The toast helpers in T035 are reshaped accordingly; the success toast on completion is preserved.
**Expected Output:**
1. `components/ui/sonner.tsx` exists and exports a `Toaster` component (Blok-styled).
2. `<Toaster />` mounted once per route (widget + panel) above the surface tree.
3. Friction-log `bundle_smoke` entry: `{ before_bytes, after_bytes, delta_bytes, delta_kb_gzipped }`.
4. `npm run lint && npm run typecheck` pass.
**Depends on:** T001a

---

**Task ID:** T003
**Title:** Provision missing Blok tokens — `--shadow-popover`, `--color-sonner-success`
**Description:** The POC pre-flagged two token gaps in `app/globals.css`: `--shadow-popover` (POC aliased to `--shadow-md`) and `--color-sonner-success` (POC derived from `--color-success-background`). Provision both as semantic tokens in `app/globals.css` `@theme inline` block. Source values from the Blok theme registry where possible (run `sitecore:blok-theming` skill to confirm the canonical values). If the registry does not expose them, document the alias choice with an inline CSS comment citing this task ID and the POC's `poc.css` source line.
**Expected Output:**
1. `app/globals.css` declares `--shadow-popover` and `--color-sonner-success` with values either copied from the Blok registry or aliased (with inline comment).
2. POC's `poc.css` references resolve at runtime against `globals.css` (no missing-variable warnings in browser console).
3. `npm run lint && npm run typecheck && npm run build` pass.
**Depends on:** T002

---

**Task ID:** T004
**Title:** Create export module directory + `schema-version.ts` single source of truth (ADR-0019)
**Description:** Create the export module directory at `core/atlas/export/` (project layout convention — see § 4c-5 rationale). Add `core/atlas/export/schema-version.ts` containing exactly one constant: `export const ATLAS_EXPORT_SCHEMA_VERSION = 1 as const;` plus a leading comment block citing ADR-0019 and the bump rules. No other file may declare a literal `1` for the schema version — DoD-7 audit (`grep -r "atlas_export_schema_version" core/atlas/export/ | grep -v schema-version.ts | grep -v __tests__` returns only importers).
**Expected Output:**
1. `core/atlas/export/schema-version.ts` exports `ATLAS_EXPORT_SCHEMA_VERSION` = `1 as const`.
2. File includes ADR-0019 reference comment and bump-rule note.
**Depends on:** T002

---

**Task ID:** T005
**Title:** Add `requireTenantIdentity` resolver in `core/tenant-identity.ts` (ADR-0020)
**Description:** Create `core/tenant-identity.ts` (sibling to `core/context-resolver.ts`). Export `interface TenantIdentity { tenantId: string; tenantName: string | null }` and `function requireTenantIdentity(ctx: ApplicationContext | null): TenantIdentity`. Behavior: throw `AtlasNoContextError` (re-imported from `./context-resolver`) when `ctx === null`, when `resourceAccess` is not a non-empty array, or when `resourceAccess[0].tenantId` is not a non-empty string. Read `tenantName` from `resourceAccess[0].tenantName` — when absent or empty, return `null` (NOT a fallback string; the filename builder constructs the fallback). Cite the verified `.d.ts` paths in the file's leading comment per `40-sdk-contracts.mdc`: `node_modules/@sitecore-marketplace-sdk/client/dist/sdk-types.d.ts:236-240` (query map) and `node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79` (`ApplicationResourceContext`).
**Expected Output:**
1. `core/tenant-identity.ts` exports `TenantIdentity` interface + `requireTenantIdentity` function.
2. Throws `AtlasNoContextError` for null / empty `resourceAccess` / missing `tenantId`.
3. Returns `tenantName: null` when SDK does not expose name (never invents a fallback string).
4. Leading comment cites `.d.ts` paths.
**Depends on:** T002, T006 (TDD — T006 is the RED test for this resolver and runs first)

---

**Task ID:** T006
**Title:** RED — Unit tests for `requireTenantIdentity` (write first; fail-first against unimplemented module)
**Description:** Add `core/__tests__/tenant-identity.test.ts` modeled on `core/__tests__/context-resolver.test.ts`. **TDD discipline:** these tests are written BEFORE T005 implementation. Until T005 lands, every assertion must fail (the module does not yet exist — import error is acceptable as the RED state). Cases: (a) returns `{ tenantId, tenantName }` when both are present; (b) returns `tenantName: null` when `tenantName` is undefined / empty string; (c) throws `AtlasNoContextError` when `ctx === null`; (d) throws when `resourceAccess` is missing / empty array; (e) throws when `tenantId` is missing or empty string; (f) `AtlasNoContextError` is the same class as the one re-exported from `core/context-resolver`. Use Vitest + the existing `makeCtx` style fixture from `context-resolver.test.ts`. **SDK fixture provenance:** the top of the test file MUST carry `// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79, 128-146` — fixtures without this comment are CR-blockers per § 9 SDK fixture rule.
**Expected Output:**
1. `core/__tests__/tenant-identity.test.ts` covers all 6 cases.
2. SDK fixture provenance comment present at file top.
3. Tests fail until T005 lands (RED), then pass without further test edits (GREEN).
**Depends on:** T002 (TDD — RED test for T005)

---

**Task ID:** T007
**Title:** Extend `core/telemetry.ts` with export event kinds (GREEN — depends on T008 RED)
**Description:** In `core/telemetry.ts`, extend the `TelemetryEventKind` union with: `'export_attempt'`, `'export_success'`, `'export_fail'`. (Match existing snake_case kind convention — surface representation in friction log can be dotted.) Add a typed event-payload helper interface (or rely on the existing `[key: string]: unknown` index signature) for the export-specific fields: `surface: 'widget' | 'panel'`, `format: 'json' | 'csv' | 'html'`, `atlasSize?: number`, `scopeKind?: 'all-collections' | 'collection'`, `durationMs?: number`, `errorCode?: 'blob_construction_failed' | 'sandbox_blocked_download' | 'browser_save_canceled' | 'clipboard_blocked' | 'unknown'`. No external transport — the existing ring buffer + `console.info("[CUA]", event)` mirror is the only sink (ADR-0013).
**Expected Output:**
1. `TelemetryEventKind` union includes the three new kinds.
2. No new transport added — `track()` body unchanged.
3. `npm run typecheck` passes.
**Depends on:** T002, T008 (TDD — T008 is the RED test for the new event kinds)

---

**Task ID:** T008
**Title:** RED — Unit tests for the new telemetry event kinds (write first)
**Description:** Extend (or add) `core/__tests__/telemetry.test.ts` to cover the new export-related event kinds. **TDD discipline:** RED tests authored before T007 widens the union — `track({ kind: 'export_attempt', ... })` is a `TelemetryEventKind` type error until T007 lands; tests stage the call via a typed cast OR via the type-test pattern in `core/__tests__/telemetry-conformance.test.ts` to assert the kind is accepted. Cases: (a) `track({ kind: 'export_attempt', surface: 'widget', format: 'json', atlasSize: 12345 })` is buffered; (b) `track({ kind: 'export_fail', surface: 'panel', format: 'csv', errorCode: 'sandbox_blocked_download' })` is buffered; (c) `getBuffer()` returns events in FIFO order with the new export events; (d) `console.info` is called with `'[CUA]'` and the event payload (use `vi.spyOn(console, 'info')`); (e) telemetry-conformance test (parity with existing `telemetry-conformance.test.ts`): the new event kinds are part of `TelemetryEventKind`; passing `'export_attempt'` typechecks.
**Expected Output:**
1. New cases land in the telemetry test file.
2. Tests fail until T007 lands (RED), then pass without further test edits (GREEN).
**Depends on:** T002 (TDD — RED test for T007)

---

### E2 — Pure construction core

---

**Task ID:** T009
**Title:** Define `SurfaceContext` type and click-time-clone helper
**Description:** Add `core/atlas/export/surface-context.ts`. Export:
- `interface SurfaceContext { surface: 'widget' | 'panel'; tenant: TenantIdentity; scope: { kind: 'all-collections' | 'collection'; collectionId?: string; collectionName?: string }; languagesScanned: string[]; scanTimestamp: string; isPartial: boolean; partialInfo?: { pagesScanned: number; pagesTotal: number; cancelReason: 'user_canceled' | 'timeout' | 'error' }; totals: { sites: number; pages: number; renderings: number; datasources: number }; skippedPages: Array<{ pageId: string; reason: 'forbidden' | 'timeout' | 'not_found' | 'network_error' | 'other' }>; panelPage?: { pageId: string; pageName: string; sitePath: string; siteId: string; siteName: string; language: string; collectionId?: string }; }`
- `function cloneSurfaceContext(ctx: SurfaceContext): SurfaceContext` — structural clone (deep enough for arrays + nested page object). Per ADR-0016 the click handler calls this **at click time** before passing into `buildExport`. The construction function never mutates this clone.
**Expected Output:**
1. `core/atlas/export/surface-context.ts` exports `SurfaceContext` + `cloneSurfaceContext`.
2. Comment block cites ADR-0016 (purity) + AC-2.7 (mid-scan navigation contract).
**Depends on:** T005, T010 (TDD — T010 is the RED test for the clone helper)

---

**Task ID:** T010
**Title:** RED — Unit tests for `surface-context.ts` (write first)
**Description:** Add `core/atlas/export/__tests__/surface-context.test.ts`. **TDD discipline:** RED tests authored before T009 — module does not yet exist, import-error is acceptable as the RED state. Cases: (a) `cloneSurfaceContext` produces a structurally equal but reference-different object; (b) mutating the clone's nested arrays does not affect the original; (c) widget context (no `panelPage`) round-trips; (d) panel context (with `panelPage`) round-trips; (e) deeply mutating `partialInfo.cancelReason` on the clone does not affect the original (deep-clone integrity). All assertions are behavioral — no `expect(true).toBe(true)`.
**Expected Output:**
1. Test file exists with 5 cases minimum.
2. Tests fail until T009 lands (RED), then pass (GREEN).
**Depends on:** T005 (TDD — RED test for T009; needs `TenantIdentity` type via T005)

---

**Task ID:** T011
**Title:** Header builder — shared metadata across formats
**Description:** Add `core/atlas/export/header-builder.ts`. Export `function buildHeader(ctx: SurfaceContext, exportedAt: string): AtlasExportHeader` returning the canonical metadata block (PRD-001 § 10.1 top-level fields): `atlas_export_schema_version` (imported from `./schema-version`), `surface`, `exported_at`, `scan_timestamp`, `is_partial`, `partial_info?`, `tenant: { tenant_id, tenant_name }` (where `tenant_name` is `ctx.tenant.tenantName` — i.e. `null` when SDK lacks name; the **fallback string is NOT applied here** — only the filename builder synthesizes that, per ADR-0020), `scope`, `languages_scanned`, `totals`, `skipped_pages`. **Key ordering is contractual** (IS-14 / AC-4.1 / § 10.4 / ADR-0019): emit fields in the exact declared order. Use object-literal construction in declared order so JSON.stringify preserves it.
**Expected Output:**
1. `header-builder.ts` exports `AtlasExportHeader` type + `buildHeader` function.
2. `JSON.stringify(buildHeader(ctx, 't'))` produces fields in the documented order.
3. Imports `ATLAS_EXPORT_SCHEMA_VERSION` from `./schema-version`.
**Depends on:** T004, T009, T012 (TDD — T012 is the RED test for the header builder)

---

**Task ID:** T012
**Title:** RED — Unit tests for `header-builder.ts` (write first)
**Description:** Add `core/atlas/export/__tests__/header-builder.test.ts`. **TDD discipline:** RED tests authored before T011 — module does not yet exist. Cases: (a) widget header carries `surface: 'widget'` and no panel-specific fields; (b) panel header surfaces panel page metadata when caller injects via the JSON adapter (header-builder itself is surface-agnostic — caller appends body per § 10.1); (c) partial scan emits `is_partial: true` and a populated `partial_info`; (d) unchanged ctx + unchanged exportedAt produce byte-identical JSON output (DoD-3 / AC-4.4 prerequisite); (e) tenant.tenant_name is `null` when `ctx.tenant.tenantName === null` (NOT the fallback string); (f) field order in stringified JSON matches § 10.1 declared order — assert via `Object.keys(JSON.parse(...))` array-equals declared order, NOT just `toMatchObject`; (g) `atlas_export_schema_version` reads `1` and is sourced from the imported constant.
**Expected Output:**
1. Test file covers all 7 cases.
2. Tests fail until T011 lands (RED), then pass (GREEN).
**Depends on:** T004, T009 (TDD — RED test for T011)

---

**Task ID:** T013
**Title:** Filename builder (FR-6 / § 9.4)
**Description:** Add `core/atlas/export/filename-builder.ts`. Export `function buildFilename(input: { tenant: TenantIdentity; surface: 'widget' | 'panel'; scopeKind: 'all-collections' | 'collection'; scopeCollectionName?: string; scopeCollectionId?: string; scanTimestamp: string; pageName?: string; pageId?: string; format: 'json' | 'csv' | 'html' }): string`. Slug rules per § 9.4:
- Lowercase ASCII; replace whitespace + punctuation with `-`; collapse `-` runs; trim leading/trailing `-`.
- Tenant slug: `slugify(tenant.tenantName)` when non-null; else `tenant-${tenant.tenantId.slice(-7)}` (canonical fallback per ADR-0020).
- Scope slug: `'all-collections'` literal; or `${slugify(collectionName)}-${collectionId.slice(-7)}` (IS-17); or fallback `${collectionId.slice(-7)}` if name unavailable.
- Page slug (panel only): `slugify(pageName)` truncated to 60 chars + `-${pageId.slice(-7)}` if truncated; or `page-${pageId.slice(-7)}` if name unavailable.
- ISO timestamp compact form `YYYYMMDDTHHMMSSZ` (no separators).
- Pattern: `atlas-${tenantSlug}-${surface}-${scopeOrPageSlug}-${tsCompact}.${ext}` (widget); `atlas-${tenantSlug}-panel-${pageSlug}-${tsCompact}.${ext}` (panel).
- Total length ≤ 200 chars; if over, truncate page-name slug component first per FR-6.3.
**Expected Output:**
1. `filename-builder.ts` exports `buildFilename`.
2. Pure function — same input always returns same output.
**Depends on:** T005, T014 (TDD — T014 is the RED test for filename builder)

---

**Task ID:** T014
**Title:** RED — Unit tests for `filename-builder.ts` (write first)
**Description:** Add `core/atlas/export/__tests__/filename-builder.test.ts`. **TDD discipline:** RED tests authored before T013 — module does not yet exist. Cases: (a) widget all-collections, tenant name present → `atlas-acme-widget-all-collections-20260503T101441Z.json`; (b) widget collection scope, name + id (IS-17 collision suffix) → `atlas-acme-widget-marketing-3a8f2bc-...json`; (c) tenant name missing → `atlas-tenant-abcd123-widget-all-collections-...json` (ADR-0020 fallback); (d) panel page name present → `atlas-acme-panel-home-page-...html`; (e) panel page name missing → `atlas-acme-panel-page-9f8e7d6-...html`; (f) page name 80 chars truncates to 60 chars + `-${pageId.slice(-7)}` suffix; (g) total filename length always ≤ 200 chars (test with very-long names); (h) timestamp compact form `YYYYMMDDTHHMMSSZ` (no `:` no `-` inside the timestamp segment); (i) format extension switches `.json` / `.csv` / `.html`; (j) two collections with the same display name in the same tenant produce different filenames (IS-17 collision suffix from `collectionId.slice(-7)`).
**Expected Output:**
1. Test file covers all 10 cases (case (j) added for IS-17 explicit coverage).
2. Tests fail until T013 lands (RED), then pass (GREEN).
**Depends on:** T005 (TDD — RED test for T013)

---

**Task ID:** T015
**Title:** Size estimator (tiered for picker annotation)
**Description:** Add `core/atlas/export/size-estimator.ts`. Export `function estimateAtlasSizeBytes(atlas: Atlas): number` (heuristic per A-UI-1: try `JSON.stringify(atlas).length` adjusted by 1.4× CSV/HTML overhead factor; if that costs >10 ms on the 50k-page benchmark, fall back to `atlas.totals.pages * 8 KB`). Also export `function sizeAnnotationTier(bytes: number): 'none' | 'muted' | 'warning'` returning the tier per § 4.2: `< 5 MB → 'none'`, `5 MB ≤ s < 50 MB → 'muted'`, `≥ 50 MB → 'warning'`. Lead developer: benchmark the JSON.stringify path on representative fixture sizes; document the chosen heuristic in a comment block.
**Expected Output:**
1. `size-estimator.ts` exports `estimateAtlasSizeBytes` + `sizeAnnotationTier`.
2. Heuristic chosen + benchmarked; rationale in leading comment.
**Depends on:** T016 (TDD — T016 is the RED test for size estimator)

---

**Task ID:** T016
**Title:** RED — Unit tests for `size-estimator.ts` (write first)
**Description:** Add `core/atlas/export/__tests__/size-estimator.test.ts`. **TDD discipline:** RED tests authored before T015. Cases: (a) empty atlas → `0` bytes (or near); (b) tiny fixture (1 KB JSON) → tier `none`; (c) 7 MB fixture → tier `muted`; (d) 80 MB fixture → tier `warning`; (e) boundary cases: 4.99 MB → `none`, 5.00 MB → `muted`, 49.99 MB → `muted`, 50.00 MB → `warning`. Mock the atlas via a synthetic `JSON.stringify`-able shape rather than constructing 80 MB of real data. Each tier assertion checks BOTH `estimateAtlasSizeBytes` and `sizeAnnotationTier` results — neither can be a tautology.
**Expected Output:**
1. Test file covers all 5 case groups.
2. Tests fail until T015 lands (RED), then pass (GREEN).
**Depends on:** T002 (TDD — RED test for T015)

---

**Task ID:** T017
**Title:** `buildExport` — pure construction entry point (ADR-0016)
**Description:** Add `core/atlas/export/build-export.ts`. Export `function buildExport(args: { atlas: Atlas; surface: 'widget' | 'panel'; format: 'json' | 'csv' | 'html'; surfaceContext: SurfaceContext; exportedAt: string }): { blob: Blob; filename: string }`. Behavior:
1. Compute `header = buildHeader(surfaceContext, exportedAt)`.
2. Dispatch on `format` to `formats/json.ts` / `formats/csv.ts` / `formats/html.ts` adapter; each adapter takes `(atlas, surfaceContext, header) → { body: string; mime: string }`.
3. Wrap `body` in a `Blob` with MIME (`application/json` / `text/csv;charset=utf-8` / `text/html;charset=utf-8`).
4. Compute filename via `buildFilename` from `surfaceContext` + scan timestamp.
5. Return `{ blob, filename }`.

**Purity contract (ADR-0016):** the function never reads `getAtlasState()`, never reads `application.context`, never reads React context. Inputs only. Caller (the Download button click handler) clones surfaceContext and resolves the atlas snapshot at click time.
**Expected Output:**
1. `build-export.ts` exports `buildExport` matching the signature above.
2. Function is pure — no module-level side effects, no globals beyond `Blob`.
3. Comment block restates ADR-0016 contract.
**Depends on:** T009, T011, T013, T018 (TDD — T018 is the RED test for buildExport orchestration + purity)

---

**Task ID:** T018
**Title:** RED — Unit tests for `build-export.ts` (top-level orchestration; write first)
**Description:** Add `core/atlas/export/__tests__/build-export.test.ts`. **TDD discipline:** RED tests authored before T017. Cases: (a) JSON format dispatches to JSON adapter; CSV to CSV; HTML to HTML (use `vi.mock` on the three format module imports); (b) returned filename matches the format extension; (c) returned Blob has correct MIME for each format; (d) function does NOT call `getAtlasState()` (verify via `vi.spyOn` on the imported module — fails-loud if buildExport reaches into the singleton, ADR-0016 purity contract); (e) function does NOT read `window` beyond `Blob` (`URL.createObjectURL` is the trigger's job, not buildExport's — assert via `vi.spyOn(URL, 'createObjectURL')` with zero call count); (f) re-running `buildExport` with the same inputs produces a Blob with byte-identical body content (DoD-3 / AC-4.4 — read the Blob via `text()` and `expect(body1).toBe(body2)`).
**Expected Output:**
1. Test file covers all 6 cases.
2. Tests fail until T017 lands (RED), then pass (GREEN).
**Depends on:** T009, T011, T013 (TDD — RED test for T017; needs same prerequisites)

---

### E3 — Format adapters

---

**Task ID:** T019
**Title:** JSON adapter (`formats/json.ts`) — full data, schema § 10.1
**Description:** Add `core/atlas/export/formats/json.ts`. Export `function jsonAdapter(atlas: Atlas, ctx: SurfaceContext, header: AtlasExportHeader): { body: string; mime: 'application/json' }`. Compose: `{ ...header, format: 'json', body: surfaceBody }` where `surfaceBody` is `WidgetBody` or `PanelBody` per § 10.1. Sort renderings by `rendering_id` ASC, pages by `page_id` ASC, datasources by `datasource_id` ASC (IS-14 / § 10.4). Pretty-print with 2-space indent (FR-2.1). Field order in `surfaceBody` and inside each rendering object follows § 10.1 declared order. **Module size cap:** ≤300 LOC (NFR-5.1).
**Expected Output:**
1. `formats/json.ts` exports `jsonAdapter`.
2. Output passes `JSON.parse` round-trip.
3. ≤300 LOC (verify).
**Depends on:** T011, T020 (TDD — T020 is the RED test for the JSON adapter)

---

**Task ID:** T020
**Title:** RED — Unit tests for JSON adapter (schema, ordering, partial-flag, empty-state; write first)
**Description:** Add `core/atlas/export/__tests__/json.test.ts`. **TDD discipline:** RED tests authored before T019. Cases: (a) widget body contains `renderings[]` sorted by `rendering_id` ASC (IS-14 deterministic ordering); (b) each rendering's `pages[]` sorted by `page_id` ASC; (c) `datasources[]` sorted by `datasource_id` ASC; (d) panel body has `page` + `renderings[]` (with `cross_tenant_pages[]` sorted); (e) `is_partial: true` produces a populated `partial_info` (AC-1.6 partial atlas export); (f) `tenant.tenant_name = null` when SDK didn't expose it; (g) skipped pages appear in `skipped_pages[]` sorted by `page_id` ASC; (h) empty atlas (zero renderings) produces a valid JSON with `renderings: []`, populated header (IS-18); (i) panel body on a zero-rendering page produces `renderings: []` (AC-2.5); (j) `atlas_export_schema_version: 1` read from imported constant (IS-13); (k) byte-identical re-export with same inputs except `exported_at` (DoD-3 / AC-4.4 prerequisite); (l) `format: 'json'` field is at the documented position in the top-level key order; (m) two collections with identical display names produce JSON entries distinguishable by their `collection_id` (IS-17 collision suffix verified at JSON layer).
**Expected Output:**
1. Test file covers all 13 cases.
2. Tests fail until T019 lands (RED), then pass (GREEN).
**Depends on:** T011 (TDD — RED test for T019)

---

**Task ID:** T021
**Title:** CSV adapter (`formats/csv.ts`) — lite columns, RFC 4180 quoting, formula-injection guard
**Description:** Add `core/atlas/export/formats/csv.ts`. Export `function csvAdapter(atlas: Atlas, ctx: SurfaceContext, header: AtlasExportHeader): { body: string; mime: 'text/csv;charset=utf-8' }`. Behavior:
1. Emit `#`-prefixed comment header block per § 10.2 (Tenant / Surface / Scope / Languages scanned / Page (panel only) / Scan timestamp / Exported at / Schema version / Partial). The `# Tenant:` line uses the **fallback string** when `ctx.tenant.tenantName === null`: `# Tenant: tenant-${tenant.tenantId.slice(-7)} (${tenant.tenantId})` (per ADR-0020 — CSV/HTML use fallback string, only JSON uses `null`).
2. Emit column header row: widget = 5 columns per § 10.2 widget table; panel = 6 columns per § 10.2 panel table.
3. Emit data rows in deterministic order (rendering_id ASC).
4. RFC 4180 quoting: any field containing `,`, `"`, `\r`, or `\n` is wrapped in `"..."` with internal `"` doubled.
5. **Formula-injection guard (R4 / OQ-9):** any field whose first char is `=`, `+`, `-`, or `@` gets a leading single quote (`'`) prepended (Excel-friendly). Non-string fields (numbers) are not subject to this check.
6. Footer: `# skipped_pages: <count>` only when `skippedPages.length > 0`.
7. UTF-8, NO BOM (FR-2.2).
**Module size cap:** ≤300 LOC.
**Expected Output:**
1. `formats/csv.ts` exports `csvAdapter`.
2. Quoting + injection guard + deterministic ordering verified.
3. ≤300 LOC.
**Depends on:** T011, T022 (TDD — T022 is the RED test for the CSV adapter)

---

**Task ID:** T022
**Title:** RED — Unit tests for CSV adapter (quoting, injection, columns, partial, empty-state; write first)
**Description:** Add `core/atlas/export/__tests__/csv.test.ts`. **TDD discipline:** RED tests authored before T021. Cases: (a) widget header block emits 9 `#` comment lines (or 10 with skipped footer when present); (b) widget data row column order matches § 10.2 widget table; (c) panel data row column order matches § 10.2 panel table; (d) display name containing `,` is quoted (RFC 4180); (e) display name containing `"` doubles the quote; (f) display name containing newline is quoted; (g) **R4 formula injection**: field starting with `=SUM(...)` gets leading `'`; (h) field starting with `@cmd` gets leading `'`; (i) field starting with `+1` gets leading `'`; (j) field starting with `-1` gets leading `'`; (k) tenant name fallback rendered in CSV `# Tenant:` line as `tenant-${tenantId.slice(-7)}`; (l) `# Schema version: 1` line read from imported constant (IS-13); (m) UTF-8 string output, no BOM byte (assert via `body.charCodeAt(0) !== 0xFEFF`); (n) empty atlas produces header block + empty body + correct comments (no data rows; IS-18); (o) skipped footer `# skipped_pages: 3` when 3 skipped pages; (p) numeric field `0` (zero) does NOT get a leading `'` prefix (regression — only string fields with leading `=`/`+`/`-`/`@` are guarded); (q) field starting with `-1` BUT classified as a number is not quoted (verifies the guard checks string-vs-number, not value).
**Expected Output:**
1. Test file covers all 17 cases (cases (p) and (q) added to harden R4 mitigation).
2. Tests fail until T021 lands (RED), then pass (GREEN).
**Depends on:** T011 (TDD — RED test for T021)

---

**Task ID:** T023
**Title:** HTML adapter (`formats/html.ts`) — lite + summary header + inlined print stylesheet
**Description:** Add `core/atlas/export/formats/html.ts`. Export `function htmlAdapter(atlas: Atlas, ctx: SurfaceContext, header: AtlasExportHeader): { body: string; mime: 'text/html;charset=utf-8' }`. Build per § 10.3 + § 4.7:
1. `<!doctype html><html lang="en"><head>` with `<meta charset="utf-8">`, `<title>Atlas snapshot — <tenant> — <surface></title>`, and `<style>` carrying both screen + print CSS (canonical hex map per § 4.7.3 — derived from Blok tokens; cite globals.css line numbers in CSS comments).
2. `<body>` contains `<header>` with `<h1>` + `<dl class="summary">` + optional `<span class="badge-partial">` (when `is_partial`); `<main>` with `<table>` (lite columns same as CSV) and conditional `<p class="if-skipped">` and `<p class="empty-state if-empty">`; `<footer>` with `<small>Schema version 1 — generated by Component Usage Atlas.</small>`.
3. Tenant name in header `<dd>` uses the fallback string `tenant-${tenantId.slice(-7)}` when `ctx.tenant.tenantName === null` (parity with CSV; PRD-001 § 10.3 + ADR-0020).
4. **HTML-escape every interpolated string** (R6 — XSS guard): replace `&`, `<`, `>`, `"`, `'` with HTML entities. Apply uniformly to display names, IDs, paths.
5. **No JS, no remote assets, no remote fonts** (AC-3.2 / NFR-4.3). Inlined `system-ui` fallback chain matching Blok body's resolved cascade per § 4.7.2.
6. Print stylesheet exactly per § 4.7.6 (11 pt body, 10 pt table, `thead { display: table-header-group }`, `tr { page-break-inside: avoid }`, `print-color-adjust: exact` on partial-scan badge).

**Module size cap:** ≤300 LOC. Inline CSS counts toward the line budget — keep it concise.
**Expected Output:**
1. `formats/html.ts` exports `htmlAdapter`.
2. Output is valid HTML5 (passes `<!doctype html>` + closing `</html>`).
3. `<style>` contains `@media print` block.
4. Every interpolated string is HTML-escaped.
5. ≤300 LOC.
**Depends on:** T011, T024 (TDD — T024 is the RED test for the HTML adapter)

---

**Task ID:** T024
**Title:** RED — Unit tests for HTML adapter (XSS escape, structure, print stylesheet, empty/partial states; write first)
**Description:** Add `core/atlas/export/__tests__/html.test.ts`. **TDD discipline:** RED tests authored before T023. Cases: (a) output begins with `<!doctype html>` and ends with `</html>`; (b) `<title>` includes tenant + surface; (c) `<dl class="summary">` carries all required `<dt>/<dd>` pairs (Tenant, Surface, Scope, Languages scanned, Page (panel only), Scan timestamp, Exported at, Sites, Pages, Renderings, Datasources, Partial scan when partial); (d) **R6 XSS guard**: display name `<script>alert(1)</script>` renders as `&lt;script&gt;alert(1)&lt;/script&gt;`; (e) `&` in display name escapes to `&amp;`; (f) `'` in display name escapes to `&#39;`; (g) `"` in display name escapes to `&quot;`; (h) `>` in display name escapes to `&gt;`; (i) `<style>` block contains `@media print`; (j) `<style>` carries `thead { display: table-header-group }` rule; (k) `<style>` carries `print-color-adjust: exact` on `.badge-partial`; (l) partial-scan flag renders `<span class="badge-partial">Partial scan — N of M pages</span>` in summary (AC-1.6); (m) empty atlas renders `<p class="empty-state if-empty">(No renderings found.)</p>` (IS-18 / DoD-8); (n) skipped pages render `<p class="if-skipped">N pages skipped: ...</p>`; (o) tenant name fallback `tenant-${tenantId.slice(-7)}` in `<dd>` when SDK lacks name; (p) `<footer>` says `Schema version 1 — generated by Component Usage Atlas.`; (q) no `<script>` element appears anywhere in output (NFR-4.3); (r) no `http://` or `https://` URL appears in any `<link>`, `<script>`, or `@import` (no remote assets — AC-3.2); (s) every interpolated path / id / display-name attribute value is also escaped (R6 — XSS via attribute injection, e.g. `id="</a><script>"` would be a CR-blocker).
**Expected Output:**
1. Test file covers all 19 cases (cases (g), (h), (s) added — full 5-entity escape coverage + attribute-context XSS).
2. Tests fail until T023 lands (RED), then pass (GREEN).
**Depends on:** T011 (TDD — RED test for T023)

---

### E4 — Download trigger + failure detection

---

**Task ID:** T025
**Title:** `triggerDownload` — primary mechanism per ADR-0017
**Description:** Add `core/atlas/export/download/trigger-download.ts`. Export `async function triggerDownload(blob: Blob, filename: string): Promise<{ outcome: 'started' | 'failed'; errorCode?: 'blob_construction_failed' | 'sandbox_blocked_download' | 'unknown' }>`. Behavior per ADR-0017 primary mechanism:
1. `const url = URL.createObjectURL(blob)` (catch — fails at this layer if Blob exceeded browser limits; return `{ outcome: 'failed', errorCode: 'blob_construction_failed' }`).
2. `const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';`
3. `document.body.appendChild(a)` (mandatory — detached anchors no-op in some browsers per ADR-0017 step 7).
4. Wrap `a.click()` in try/catch. On synchronous throw → cleanup + return `{ outcome: 'failed', errorCode: 'sandbox_blocked_download' }`.
5. `queueMicrotask(() => { a.remove(); URL.revokeObjectURL(url); })` for cleanup.
6. Return `{ outcome: 'started' }` — caller chains `detectFailure` for the 5 s heuristic.
**Expected Output:**
1. `trigger-download.ts` exports `triggerDownload`.
2. Cleanup happens via `queueMicrotask` (not `setTimeout`).
3. Synchronous throw paths return correct error codes.
**Depends on:** T002, T026 (TDD — T026 is the RED test for triggerDownload)

---

**Task ID:** T026
**Title:** RED — Unit tests for `triggerDownload` (write first)
**Description:** Add `core/atlas/export/download/__tests__/trigger-download.test.ts`. Use jsdom + `vi.spyOn` on `URL.createObjectURL`, `URL.revokeObjectURL`, `HTMLAnchorElement.prototype.click`. **TDD discipline:** RED tests authored before T025. Cases: (a) happy path: anchor created with `href = blob: url`, `download = filename`, appended, clicked, removed; `revokeObjectURL` called; outcome `started`; (b) `URL.createObjectURL` throws → outcome `failed`, errorCode `blob_construction_failed`; (c) `a.click()` throws → cleanup happens, outcome `failed`, errorCode `sandbox_blocked_download` (AC-5.3 — explicit error-code surfacing); (d) anchor is appended to `document.body` (not detached); (e) `a.style.display === 'none'`; (f) cleanup runs in microtask (anchor still in DOM synchronously after `triggerDownload` resolves; gone after `await Promise.resolve()`).
**Expected Output:**
1. Test file covers all 6 cases.
2. Tests fail until T025 lands (RED), then pass (GREEN).
**Depends on:** T002 (TDD — RED test for T025)

---

**Task ID:** T027
**Title:** `detectFailure` — 5 s heuristic per ADR-0017 detection contract
**Description:** Add `core/atlas/export/download/detect-failure.ts`. Export `async function detectFailure(triggerOutcome: { outcome: 'started' | 'failed'; errorCode?: string }): Promise<{ result: 'success' | 'fail'; errorCode?: string }>`. Behavior:
1. If `triggerOutcome.outcome === 'failed'` → return `{ result: 'fail', errorCode: triggerOutcome.errorCode }`.
2. Otherwise schedule a 5 s timeout. If during the timeout no observable failure surfaces (no console error captured by the existing telemetry buffer with `kind === 'export_fail'` matching this attempt) → return `{ result: 'success' }`. The heuristic is imperfect by design (ADR-0017 § Detection contract) — false negatives + false positives are acceptable for v1; `export.attempt` always fires so operators can compute attempt-vs-success ratios.
3. **Implementation note:** because the iframe sandbox can swallow errors silently, the 5 s timeout is the load-bearing guard. The function is tested with Vitest fake timers (`vi.useFakeTimers()`) — caller passes a `setTimeout`-equivalent that the test can advance.
**Expected Output:**
1. `detect-failure.ts` exports `detectFailure`.
2. Pure function over its arguments; uses `setTimeout` (testable with fake timers).
**Depends on:** T025, T028 (TDD — T028 is the RED test for the 5s heuristic)

---

**Task ID:** T028
**Title:** RED — Unit tests for `detectFailure` — fake-timer 5 s heuristic (write first)
**Description:** Add `core/atlas/export/download/__tests__/detect-failure.test.ts`. Use `vi.useFakeTimers()`. **TDD discipline:** RED tests authored before T027. Cases: (a) `triggerOutcome.outcome === 'failed'` short-circuits to `{ result: 'fail', errorCode: 'sandbox_blocked_download' }`; (b) `triggerOutcome.outcome === 'started'` resolves `success` after 5 s advance with no observable failure; (c) advancing timer by 4999 ms keeps the promise pending (verify via `expect.poll`/race against `Promise.race([p, timeout(0)])` — the resolution slot must remain unfilled); (d) errorCode propagates through fail path.
**Expected Output:**
1. Test file covers all 4 cases.
2. Tests fail until T027 lands (RED), then pass (GREEN).
**Depends on:** T025 (TDD — RED test for T027)

---

**Task ID:** T029
**Title:** `fallbackClipboard` — F2 stub (engineered only if T001 fails)
**Description:** Add `core/atlas/export/download/fallback-clipboard.ts`. Export `async function fallbackClipboard(jsonString: string): Promise<{ result: 'success' | 'fail'; errorCode?: 'clipboard_blocked' }>`. Calls `navigator.clipboard.writeText(jsonString)`; on rejection returns `{ result: 'fail', errorCode: 'clipboard_blocked' }`. If T001 returns `green` for both surfaces, this module ships as a non-wired stub (still imported by the sandbox-blocked toast handler — but the sandbox-blocked toast itself only renders when telemetry surfaces `sandbox_blocked_download`, which is gated on the spike outcome). If T001 forks to F2, this stub is the F2 implementation. **Code-size impact: zero unless wired.**
**Expected Output:**
1. `fallback-clipboard.ts` exports `fallbackClipboard`.
2. Module is leaf — no other module imports it unconditionally.
**Depends on:** T001, T030 (TDD — T030 is the RED test for the clipboard fallback)

---

**Task ID:** T030
**Title:** RED — Unit tests for `fallbackClipboard` (write first)
**Description:** Add `core/atlas/export/download/__tests__/fallback-clipboard.test.ts`. Mock `navigator.clipboard.writeText`. **TDD discipline:** RED tests authored before T029. Cases: (a) success path: `writeText` resolves → `{ result: 'success' }`; (b) failure path: `writeText` rejects with permission error → `{ result: 'fail', errorCode: 'clipboard_blocked' }`; (c) very-large string round-trips (no truncation).
**Expected Output:**
1. Test file covers all 3 cases.
2. Tests fail until T029 lands (RED), then pass (GREEN).
**Depends on:** T001 (TDD — RED test for T029)

---

### E5 — Surface integrations

---

**Task ID:** T051
**Title:** RED — Unit tests for `useSaveExport` hook
**Description:** Add `core/atlas/export/hooks/__tests__/use-save-export.test.tsx` modeled on existing atlas hook tests (and on `products/pageshot/site/next-app/components/__tests__/...` if such tests exist — grep the pageshot tree first). **TDD discipline:** RED tests authored before T052; module does not yet exist, import-error is the RED state. Cases: (a) status starts `'idle'`; (b) `save({ blob, filename })` flips to `'saving'` then `'unsupported'` when sandbox blocks (detection via the mechanism's own no-op behavior — since we cannot detect silent_block reliably at runtime, the hook reports `'unsupported'` based on a feature-detection guard that runs at mount time — defer specifics to T052 GREEN); (c) when sandbox supports downloads (future state — simulate by stubbing the feature-detection probe to return `true` AND letting the synthetic anchor click resolve), status flips to `'saving' → 'saved' → 'idle'` after the 1.4 s revert window (mirror pageshot `use-download-image.ts:115-121`); (d) cleanup on unmount cancels revert timer; (e) idempotency — multiple rapid clicks yield single download. Use Vitest `vi.useFakeTimers()` for the 1.4 s window. Reference implementation: `products/pageshot/site/next-app/components/use-download-image.ts`.
**Expected Output:**
1. Test file with 5 cases.
2. Tests fail until T052 lands (RED), then pass (GREEN).
**Depends on:** T002 (TDD — RED for T052)

---

**Task ID:** T052
**Title:** Implement `useSaveExport` hook (GREEN)
**Description:** Add `core/atlas/export/hooks/use-save-export.ts` mirroring pageshot's `use-download-image.ts` shape — but adapted for arbitrary text/HTML Blob (not pageshot's base64 PNG). Signature: `useSaveExport({ blob, filename }): { status: 'idle' | 'saving' | 'saved' | 'unsupported', save: () => void }`. Use the canonical mechanism from ADR-0017 § Primary mechanism: `URL.createObjectURL(blob)` → synthesize `<a download={filename} rel="noopener" style="display:none">` → `appendChild(document.body)` → `click()` → defer 60 s revoke. Feature detection: at mount, the hook MAY run a no-op probe (synthesize a minimal anchor with `download="probe"` and check `'download' in document.createElement('a')`) — if missing, report `'unsupported'`; otherwise the hook is functionally enabled. **Note:** the no-op probe does NOT detect Marketplace's silent_block (the API is "supported" at the document level; the sandbox swallows the result). The hook ships with the disabled-state policy on the action button enforced at the surface level via ADR-0021's recommendation, not via runtime detection. Cite pageshot `use-download-image.ts:99-110` in the leading comment block; cite ADR-0017 § Primary mechanism and ADR-0021 § The three actions.
**Expected Output:** Hook exports `useSaveExport`. T051 RED tests pass.
**Depends on:** T002, T051

---

**Task ID:** T053
**Title:** RED — Unit tests for `useOpenExport` hook
**Description:** Add `core/atlas/export/hooks/__tests__/use-open-export.test.tsx`. **TDD discipline:** RED tests authored before T054; module does not yet exist. Cases: (a) status `'idle'` at mount; (b) `open()` flips to `'opening'`, `window.open` returns a non-null window object (mocked), status flips to `'opened'`, then back to `'idle'` after the 1.4 s window; (c) `window.open` returns `null` (popup blocked) → status flips to `'blocked'`, sticky for the session (subsequent `open()` calls are no-ops); (d) `URL.revokeObjectURL` deferred 60 s — assert via `vi.useFakeTimers()` and `vi.advanceTimersByTime(60_000)`; (e) idempotency — concurrent `open()` calls during the `'opening'` window are no-ops. Mock `window.open` via `vi.spyOn(window, 'open')`. Reference implementation: `products/pageshot/site/next-app/components/use-open-image.ts`.
**Expected Output:**
1. Test file with 5 cases.
2. Tests fail until T054 lands (RED), then pass (GREEN).
**Depends on:** T002 (TDD — RED for T054)

---

**Task ID:** T054
**Title:** Implement `useOpenExport` hook (GREEN)
**Description:** Add `core/atlas/export/hooks/use-open-export.ts` mirroring pageshot's `use-open-image.ts` shape — adapted for arbitrary Blob (not just PNG). Signature: `useOpenExport({ blob }): { status: 'idle' | 'opening' | 'opened' | 'blocked', open: () => void }`. Implementation: `URL.createObjectURL(blob)` → `window.open(url, '_blank', 'noopener,noreferrer')`. If the returned window is `null`, flip status to `'blocked'` (sticky); otherwise flip to `'opened'`, then revert to `'idle'` after 1.4 s. Defer `URL.revokeObjectURL` 60 s so the new tab has time to read the blob. Cite `products/pageshot/site/next-app/components/use-open-image.ts:62` and ADR-0021 § The three actions.
**Expected Output:** Hook exports `useOpenExport`. T053 tests pass.
**Depends on:** T002, T053

---

**Task ID:** T055
**Title:** RED — Unit tests for `useCopyExport` hook
**Description:** Add `core/atlas/export/hooks/__tests__/use-copy-export.test.tsx`. **TDD discipline:** RED tests authored before T056; module does not yet exist. Cases:
- (a) **Text path** (`useCopyExport({ text: '{"a":1}', mode: 'text' })`): status `'idle'` → `'copying'` → `'copied'` (1.8 s window) → `'idle'`. Asserts `navigator.clipboard.writeText` called with the text.
- (b) **HTML path** (`useCopyExport({ text: '<html>…</html>', mode: 'html' })`): asserts `navigator.clipboard.write` called with one `ClipboardItem` carrying `'text/html'` + `'text/plain'` peer entries.
- (c) **Capability detection**: on mount, `available: false` when `navigator.clipboard.writeText` is undefined (text mode) or when `ClipboardItem` is undefined (html mode).
- (d) **Sticky `'denied'`** after rejection — second `copy()` call is a no-op until session ends.
- (e) **`'unsupported'` initial status** when `available === false`.
- (f) Idempotency — concurrent `copy()` calls during the `'copying'` window are no-ops.

SDK fixture provenance comment is **NOT required** for this test file (clipboard is a browser API, not an SDK).

Reference implementation: `products/pageshot/site/next-app/components/use-copy-image.ts` (note divergence: pageshot uses `image/png` ClipboardItem; atlas uses text/* — text path is `writeText`, html path is `text/html` + `text/plain` peers).
**Expected Output:**
1. Test file with 6 cases.
2. Tests fail until T056 lands (RED), then pass (GREEN).
**Depends on:** T002 (TDD — RED for T056)

---

**Task ID:** T056
**Title:** Implement `useCopyExport` hook (GREEN)
**Description:** Add `core/atlas/export/hooks/use-copy-export.ts` mirroring pageshot's `use-copy-image.ts` shape — but text-aware. Signature: `useCopyExport({ text, mode }): { available: boolean, status: 'idle' | 'copying' | 'copied' | 'denied' | 'unsupported', deniedMessage: string, copy: () => Promise<void> }`. JSON / CSV path (`mode === 'text'`): `await navigator.clipboard.writeText(text)`. HTML path (`mode === 'html'`): construct `new ClipboardItem({ 'text/html': new Blob([text], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })` and call `await navigator.clipboard.write([item])`. Capability detection at mount: text mode requires `navigator.clipboard?.writeText`; html mode requires both `ClipboardItem` and `navigator.clipboard?.write`. **Sticky-denied posture**: after a rejection, status stays `'denied'` for the lifetime of the hook (no auto-revert). `deniedMessage` constant: `"Clipboard access was blocked. Use Open instead."` (mirrors pageshot's posture but copy points at Open, not Download). Cite pageshot `use-copy-image.ts:128-148` and ADR-0021 § The three actions in the leading comment.
**Expected Output:** Hook exports `useCopyExport`. T055 tests pass.
**Depends on:** T002, T055

---

**Task ID:** T031
**Title:** Telemetry helpers `emitExportAttempt` / `emitExportSuccess` / `emitExportFail`
**Description:** Add `core/atlas/export/telemetry/events.ts`. Export three thin helpers wrapping `track()` from `core/telemetry.ts`:
- `emitExportAttempt({ surface, format, atlasSize, scopeKind })` → `track({ kind: 'export_attempt', timestamp_ms: Date.now(), surface, format, atlasSize, scopeKind })`
- `emitExportSuccess({ surface, format, durationMs })` → `track({ kind: 'export_success', timestamp_ms: Date.now(), surface, format, durationMs })`
- `emitExportFail({ surface, format, errorCode, durationMs? })` → `track({ kind: 'export_fail', timestamp_ms: Date.now(), surface, format, errorCode, durationMs })`

No new transport — strictly delegating to `track()`.
**Expected Output:**
1. `telemetry/events.ts` exports the three helpers.
2. `npm run typecheck` passes.
**Depends on:** T007

---

**Task ID:** T032
**Title:** Action cluster component (Save / Open / Copy pills) — widget label + panel icon-only variants
**Description:** **(Amended per ADR-0021 supersession of single-Download-button pattern.)** Add `components/atlas/download-button.tsx` (filename preserved for git diff continuity; the component now exports an action cluster, not a single Download button). Props: `surface: 'widget' | 'panel'`; `state: 'enabled' | 'disabled-no-data' | 'disabled-panel-loading' | 'disabled-scan-in-progress-no-prior' | 'constructing'`; `atlasSizeBytes: number | null`; `onSelectFormat: (format: 'json' | 'csv' | 'html') => void`; `selectedFormat: 'json' | 'csv' | 'html' | null`; `saveStatus: 'idle' | 'saving' | 'saved' | 'unsupported'`; `openStatus: 'idle' | 'opening' | 'opened' | 'blocked'`; `copyStatus: 'idle' | 'copying' | 'copied' | 'denied' | 'unsupported'`; `copyDeniedMessage: string`; `onSave: () => void`; `onOpen: () => void`; `onCopy: () => void`; `sandboxBlocksDownload: boolean` (parent decides — typically `true` while running in the Marketplace iframe).

Composition:
- The component renders **a format picker followed by three action affordances** (the action cluster). The format picker is the existing `<FormatPickerMenu>` from T033. After format selection, the three action pills become enabled (subject to per-action status).
- **Save pill** (`<ActionPill variant="save">`): icon `mdiContentSave`, label `Save`. Defaults to `disabled` with the tooltip "Downloads are blocked in this iframe — use Open or Copy instead. (Save will work once Sitecore enables it.)" when `sandboxBlocksDownload === true` OR when `saveStatus === 'unsupported'`. Shows status-driven label / icon transitions per pageshot precedent (`'saving'` → spinner; `'saved'` → check icon for 1.4 s).
- **Open pill** (`<ActionPill variant="open">`): icon `mdiOpenInNew`, label `Open`. Status `'opening'` → spinner; `'opened'` → check icon for 1.4 s; `'blocked'` → inline message "Popup blocked — use Copy instead." (sticky for the session).
- **Copy pill** (`<ActionPill variant="copy">`): icon `mdiContentCopy`, label `Copy`. Status `'copying'` → spinner; `'copied'` → check icon for 1.8 s; `'denied'` → inline `copyDeniedMessage` (sticky); `'unsupported'` → disabled with `copyDeniedMessage`.
- Widget surface: pill row uses `<Button variant="outline" colorScheme="neutral" size="sm">` style (label + icon at ≥480 px; icon-only with tooltip below 480 px). Panel surface: pill row uses `<Button variant="ghost" colorScheme="neutral" size="icon-sm">` style (always icon-only, tooltip carries label + status copy).
- The clicked action is disabled with a per-action spinner during construction; the other two actions remain interactive.
- Disabled states attach `aria-describedby` pointing to a visually-hidden `<span>` with the per-state / per-status copy (NFR-3.3). `aria-label` per pill: "Save snapshot" / "Open snapshot in new tab" / "Copy snapshot to clipboard".
- POC reference: `pocs/poc-v1/widget.html` + `pocs/poc-v1/panel.html` show the original single-Download-button shape — they are now **stale on this aspect**. Visual re-spin is deferred to `/document` polish; for implementation, follow pageshot's ActionPill anatomy at `products/pageshot/site/next-app/components/ActionPill.tsx` (live in production). Use the same Blok primitives the POC used (`@blok/button` outline / ghost variants, `@blok/icon`).

**Expected Output:**
1. `components/atlas/download-button.tsx` exports the action-cluster component accepting the documented props.
2. All three pills render with correct status transitions.
3. Save's disabled-state tooltip surfaces verbatim copy from the spec.
4. Both surface variants render correctly at narrow + wide breakpoints.
**Depends on:** T002, T003, T015, T038, T052, T054, T056 (TDD — T038 is the RED component test for the action cluster + per-action statuses + a11y; the three action hooks T052/T054/T056 are wired by the parent surface, but T032 reads their status types and exposes them as props)

---

**Task ID:** T033
**Title:** `<FormatPickerMenu>` — three Blok DropdownMenuItems with size annotation (sub-component to T032's action cluster)
**Description:** **(Amended per ADR-0021 supersession.)** Renders the format dropdown menu — JSON / CSV / HTML — per existing PRD § 11.2. **Sub-component to T032's action cluster.** The action selection (Save / Open / Copy) is in T032 — this component is responsible only for format selection, not action selection. Add `components/atlas/format-picker-menu.tsx`. Props: `atlasSizeBytes: number | null`; `surface: 'widget' | 'panel'`; `onSelect: (format: 'json' | 'csv' | 'html') => void`. Composition per UI design § 4.2:
- Wraps `<DropdownMenuContent align="end" className={surface === 'widget' ? 'w-80' : 'w-72'}>` (320 px / 280 px).
- Three `<DropdownMenuItem>`s in fixed order: JSON / CSV / HTML.
- Each item: per-format icon (`mdiCodeBraces` / `mdiTable` / `mdiFileDocumentOutline`) + `<DropdownMenuItemText>` with `<DropdownMenuItemTitle>` (format name + muted `.ext` suffix) + `<DropdownMenuItemDescription>` (subtitle + size annotation per `sizeAnnotationTier`).
- Size annotation rendering:
  - `none` tier: no extra text.
  - `muted` tier: ` · ~12 MB` appended to description (computed value formatted via `Math.round(bytes/1024/1024)`).
  - `warning` tier: prefix `<Icon path={mdiAlert} size={0.55} className="text-warning-fg mr-1" aria-hidden />` then ` · ~78 MB — Large, may take a moment` (per § 4.2 table).
- POC reference: `pocs/poc-v1/widget-menu-open.html`, `widget-menu-large.html`, `widget-menu-huge.html`, `panel-menu-open.html`.

**Expected Output:**
1. `components/atlas/format-picker-menu.tsx` exports `<FormatPickerMenu>`.
2. Three menu items in JSON / CSV / HTML order.
3. Size annotation tier renders correctly for `none` / `muted` / `warning`.
**Depends on:** T032, T039 (TDD — T039 is the RED component test for the 3 items + size tiers)

---

**Task ID:** T034
**Title:** `<WhyPopover>` — per-error-code explanation popover (S9)
**Description:** Add `components/atlas/why-popover.tsx`. Props: `errorCode: 'blob_construction_failed' | 'sandbox_blocked_download' | 'clipboard_blocked' | 'unknown'`; `frictionLogHasEntries: boolean`. Renders `<Popover>` (from existing `components/ui/popover.tsx`) anchored to the Why? action button inside the toast; `align="end"`, side `top`, width 240 px (`w-60`). Body per UI design § 4.6 per-error-code copy table. When `frictionLogHasEntries === true`, render a `<Button variant="link">View friction log</Button>` footer that opens the existing `components/atlas/debug-panel.tsx`. Closes on outside-click, Escape, or trigger re-click. POC reference: `pocs/poc-v1/popover-why-sandbox.html`.
**Expected Output:**
1. `components/atlas/why-popover.tsx` exports `<WhyPopover>`.
2. All 4 error-code cases render their canonical copy.
3. Friction-log link conditionally rendered.
**Depends on:** T002

---

**Task ID:** T035
**Title:** Toast helpers — success / generic-failure / sandbox-blocked
**Description:** Add `components/atlas/export-toasts.ts` (or `.tsx` if it carries JSX action handlers). Export three `toast` invocation helpers wrapping `sonner`'s `toast.success` / `toast.error`:
- `toastExportSuccess({ filename, isEmptyAtlas })` — Sonner success variant, body `Downloaded <code>${filename}</code>.` (or `... — empty atlas.` when `isEmptyAtlas`); `mdiCheckCircle` icon; `aria-live="polite"`; auto-dismiss 4 s (per UI § 4.3).
- `toastExportFailure({ errorCode, onRetry, frictionLogHasEntries })` — Sonner error variant, sticky; copy per error-code branch:
  - generic codes (`blob_construction_failed` / `unknown`): `Couldn't download. Try a different format or retry.` + actions [Retry, Why?].
  - `sandbox_blocked_download`: `Downloads are blocked in this app's iframe. Copy the JSON to clipboard, or contact Sitecore support.` + actions [Retry, Copy JSON, Why?] — Copy JSON action runs `fallbackClipboard` and on success replaces toast body with `Copied JSON to clipboard.` (collapsing actions to [Why?] only, auto-dismiss 4 s); on clipboard failure replaces toast with `Clipboard blocked. Open the friction log for the raw JSON.` (sticky, terminal). Telemetry on clipboard failure: `emitExportFail({ errorCode: 'clipboard_blocked' })`.
- `toastBenignCancel()` — no-op for `browser_save_canceled` (per UI § 4.4 — benign).

POC reference: `pocs/poc-v1/toast-success.html`, `toast-failure-generic.html`, `toast-failure-sandbox.html`.
**Expected Output:**
1. `export-toasts.ts(x)` exports the three helpers.
2. Sandbox-blocked toast renders 3 actions; generic renders 2.
3. Copy-JSON success path mutates toast in-place to acknowledgement.
**Depends on:** T002, T029, T031, T034

---

**Task ID:** T036
**Title:** Wire action cluster (Save / Open / Copy) into `widget-surface.tsx` FreshnessRibbon
**Description:** **(Amended per ADR-0021 supersession.)** Edit `components/atlas/widget-surface.tsx` (insertion point per UI § 4.8, line ~146 — `freshness__right`). Insert the T032 action cluster (format picker + three action pills) as the **first** child of the `freshness__right` container, before the existing "Refresh atlas" button (data-out before data-mutation). Wire the click handlers:

1. Resolve `state` from current atlas store: `disabled-no-data` if no completed atlas in this tab session; `disabled-scan-in-progress-no-prior` if scanning AND no prior atlas; `enabled` otherwise (including refresh-with-prior).
2. Compute `atlasSizeBytes = atlas ? estimateAtlasSizeBytes(atlas) : null` lazily on menu-open.
3. **On format selection** (`onSelectFormat(format)`):
   - Set `selectedFormat` state to the picked value.
   - Eagerly construct the export so the three actions can use the same Blob:
     - Capture `surfaceContext` via `cloneSurfaceContext(...)` from current atlas state + tenant identity (`requireTenantIdentity(appContext)`).
     - `const { blob, filename, text } = buildExport({ atlas, surface: 'widget', format, surfaceContext, exportedAt: new Date().toISOString() })` — `buildExport` returns the text body alongside the Blob so Copy can pass it directly to the clipboard hook (Copy operates on string, not Blob).
     - On `blob_construction_failed` (catch + errorCode): emit `export_fail` with `errorCode: 'blob_construction_failed'` and surface a Sonner error toast (cross-cutting failure — reaches no action). Reset to format unselected.
   - Pass `blob`, `filename`, `text` into the three hooks via the cluster's props:
     - `useSaveExport({ blob, filename })` → `saveStatus`, `onSave`.
     - `useOpenExport({ blob })` → `openStatus`, `onOpen`.
     - `useCopyExport({ text, mode: format === 'html' ? 'html' : 'text' })` → `copyStatus`, `copyDeniedMessage`, `onCopy`.
4. **On action click** (Save / Open / Copy):
   - Call `emitExportAttempt({ surface: 'widget', format, action, atlasSize, scopeKind })` — payload includes the `action` field per ADR-0021.
   - Invoke the corresponding hook's action.
   - Telemetry on resolution:
     - Save: emit `export_success` if `status` reaches `'saved'`; emit `export_fail` once on mount if `status === 'unsupported'` (informational, see ADR-0021); per-click failures do NOT emit further events.
     - Open: emit `export_success` on `'opened'`; emit `export_fail` with `errorCode: 'popup_blocked'` on `'blocked'` (once per session — sticky).
     - Copy: emit `export_success` on `'copied'`; emit `export_fail` with `errorCode: 'clipboard_blocked'` on `'denied'` (once per session — sticky).
   - Success toast (`toastExportSuccess({ filename, action, isEmptyAtlas })`) fires on the first successful action per format-pick. Subsequent successful actions on the same format-pick are silent (avoid toast spam).
5. **Cross-cutting failure toast.** Per ADR-0021, only `blob_construction_failed` (a failure that prevents any action from running) surfaces a Sonner error toast. Per-action blocks (Open `'blocked'`, Copy `'denied'`, Save `'unsupported'`) surface inline status copy on the affordance, NOT a toast — handled by T032 internally.
6. AC-1.1: button stays enabled during refresh-with-prior — exports the **previous** atlas at click time.
7. The `sandboxBlocksDownload` prop on T032 is set to `true` while the app runs in the Marketplace iframe (detect via the existing iframe-detection helper or a build-time env flag — Developer picks the cleanest lever and documents the choice). When Sitecore later adds `allow-downloads`, flipping this prop to `false` re-enables Save with no further code change.

**Expected Output:**
1. `widget-surface.tsx` integrates the action cluster + format picker.
2. Click flow emits attempt / success / fail telemetry per action with `action` field in the payload.
3. Cross-cutting blob-construction failure surfaces a toast; per-action failures surface inline status only.
4. POC visual parity verified against `pocs/poc-v1/widget.html` for the surface chrome (action cluster visual re-spin deferred to /document polish).
**Depends on:** T017, T025, T027, T031, T032, T033, T035, T040, T052, T054, T056 (TDD — T040 is the RED integration test; T052/T054/T056 supply the three hooks the surface wires)

---

**Task ID:** T037
**Title:** Wire action cluster (Save / Open / Copy) into `panel-surface.tsx` zone-2
**Description:** **(Amended per ADR-0021 supersession.)** Edit `components/atlas/panel-surface.tsx` (insertion point per UI § 4.8, line ~385 — zone-2 right-side flex group). Insert the T032 action cluster (`surface="panel"`) as the second child, before the skipped-link warning (when present). Wire the same handlers as T036 with the panel-specific differences:
- `surface: 'panel'` everywhere; telemetry payload `action: 'save' | 'open' | 'copy'` per ADR-0021.
- `surfaceContext.panelPage` populated **at action-click time** via `cloneSurfaceContext(...)` with `pageId / pageName / sitePath / siteId / siteName / language` from the panel's current `activePageId` / per-page rendering snapshot. Per AC-2.7 (amended): the click-time clone is captured at the **action click** (Save / Open / Copy), not at the format-pick click — panel re-renders for new pages mid-construction do NOT affect the in-flight export.
- Disabled-state extras: `disabled-panel-loading` while per-page fetch is in flight (panel-surface.tsx:305-307 indicator).
- `sandboxBlocksDownload` prop set the same way as T036.
- POC reference: `pocs/poc-v1/panel.html`, `panel-menu-open.html` — note these show the original single-Download-button layout and are stale on this aspect; visual re-spin deferred to /document polish.
**Expected Output:**
1. `panel-surface.tsx` integrates the action cluster + format picker.
2. Action-click handler captures click-time `surfaceContext` snapshot (AC-2.7 invariant).
3. Telemetry events carry `surface: 'panel'` + `action` field.
4. POC visual parity verified for the surface chrome (action-cluster visual re-spin deferred).
**Depends on:** T017, T025, T027, T031, T032, T033, T035, T041, T052, T054, T056 (TDD — T041 is the RED integration test; the three hooks supply per-action behavior)

---

**Task ID:** T038
**Title:** RED — Component test for action cluster (widget + panel variants, three actions, per-action statuses; write first)
**Description:** **(Amended per ADR-0021 supersession — three-action cluster behavior.)** Add `components/atlas/__tests__/download-button.test.tsx`. Use `@testing-library/react` + `@testing-library/user-event` + jsdom. **TDD discipline:** RED tests authored before T032 — component does not yet exist, import-error is the RED state. Cases:
- (a) **All three actions render** in fixed order: Save → Open → Copy on both surface variants.
- (b) **Save disabled with documented tooltip** when `saveStatus === 'unsupported'` OR when `sandboxBlocksDownload === true` — tooltip carries verbatim copy: `Downloads are blocked in this iframe — use Open or Copy instead. (Save will work once Sitecore enables it.)`.
- (c) **Open click flips visible status** inline: `'opening'` → spinner glyph; `'opened'` → check glyph for 1.4 s window; `'blocked'` → inline message `Popup blocked — use Copy instead.` (sticky).
- (d) **Copy click flips status**: `'copying'` → spinner; `'copied'` → check (1.8 s window); `'denied'` → inline `copyDeniedMessage` (sticky); `'unsupported'` → disabled with `copyDeniedMessage`.
- (e) **Format change resets all three actions to `'idle'`** — when parent passes a new `selectedFormat`, the per-pill status props default to `'idle'` and the visual treatment resets.
- (f) **Keyboard nav reaches all three pills via Tab** — `userEvent.tab()` lands on Save first, then Open, then Copy. Enter activates each.
- (g) Widget variant renders pill labels at desktop width (≥ 480 px); panel variant always icon-only with tooltip.
- (h) `state='disabled-no-data'` / `disabled-scan-in-progress-no-prior` / `disabled-panel-loading` apply to all three pills with tooltip copy unchanged from the existing per-state table.
- (i) `state='constructing'` swaps icon for inline spinner on the **clicked** pill only; the other two pills remain interactive.
- (j) `aria-label` per pill (`Save snapshot` / `Open snapshot in new tab` / `Copy snapshot to clipboard`) always present.
- (k) `aria-describedby` points to visually-hidden span with reason copy on disabled / blocked / denied states (NFR-3.3).
- (l) **Runtime contrast (per § 9.3)**: when state === `enabled` on the widget variant, assert via `getComputedStyle()` that resolved foreground:background contrast for each visible pill is ≥ 4.5:1. Use `@/lib/contrast.ts` helper.
- (m) Tab order: action cluster DOM-precedes Refresh button (UI § 4.8 — data-out before data-mutation).

**Expected Output:**
1. Test file covers all 13 cases.
2. Tests fail until T032 lands (RED), then pass (GREEN).
**Depends on:** T002, T003 (TDD — RED test for T032; needs primitives installed but not the component impl)

---

**Task ID:** T039
**Title:** RED — Component test for `<FormatPickerMenu>` (three items, size tiers; write first)
**Description:** Add `components/atlas/__tests__/format-picker-menu.test.tsx`. **TDD discipline:** RED tests authored before T033. **(Note per ADR-0021 supersession: this component now drives only format selection; action selection lives in T032's action cluster. The dropdown mechanics tested here are unchanged from the original LD spec.)** Cases: (a) renders three items in JSON/CSV/HTML order; (b) JSON item has `mdiCodeBraces` icon, title `JSON`, suffix `.json`, description `Full data, machine-readable`; (c) CSV item has `mdiTable`, title `CSV`, `.csv`, `Lite data, spreadsheet-friendly`; (d) HTML item has `mdiFileDocumentOutline`, title `HTML`, `.html`, `Lite data, printable / shareable`; (e) `atlasSizeBytes < 5MB` → no size annotation; (f) `atlasSizeBytes` in 5–50 MB → muted ` · ~N MB` annotation; (g) `atlasSizeBytes ≥ 50 MB` → warning glyph + ` · ~N MB — Large, may take a moment`; (h) `onSelect` fired with correct format on click + on Enter; (i) widget menu width 320 px; panel 280 px; (j) **runtime contrast (per § 9 contrast rule)**: warning-tier annotation's `text-warning-fg` resolved color vs the menu-item background contrast ≥ 4.5:1 (asserts the warning glyph remains legible after Blok token resolution); (k) keyboard: arrow-down navigates between items; arrow-up reverses; Enter selects; Escape closes (WCAG 2.1 AA — keyboard reach + arrow-key menu nav).
**Expected Output:**
1. Test file covers all 11 cases.
2. Tests fail until T033 lands (RED), then pass (GREEN).
**Depends on:** T002, T003 (TDD — RED test for T033; needs primitives but not the menu impl)

---

### E6 — Tests + verification

---

**Task ID:** T040
**Title:** RED — Integration test — widget surface end-to-end action-cluster flow (three formats × three actions; write first)
**Description:** **(Amended per ADR-0021 supersession — covers Save / Open / Copy per format with one success + one failure mode each.)** Add `components/atlas/__tests__/widget-surface-export.test.tsx`. Render the full widget surface with a fixture atlas (1 site, 5 pages, 3 renderings, 2 datasources). Mock `URL.createObjectURL`, `window.open`, and `navigator.clipboard` to control per-action outcomes. **TDD discipline:** RED tests authored before T036.

**Per-action coverage** (six scenarios per surface — one success + one failure mode per action):

- (a) **Save success** (simulating a future sandbox that allows downloads): pick JSON → click Save → assert synthetic `<a download={filename}>` clicked; filename `atlas-${tenant}-widget-all-collections-${ts}.json`; Blob body parses as JSON with `atlas_export_schema_version === 1` and `surface === 'widget'`; `saveStatus` flips `'saving' → 'saved' → 'idle'`; telemetry: `export_attempt` + `export_success` with `action: 'save'`.
- (b) **Save unsupported** (current sandbox — `sandboxBlocksDownload === true`): Save pill renders disabled with the verbatim tooltip; click does nothing; no telemetry beyond the mount-time informational `export_fail` with `errorCode: 'sandbox_blocked_download'` (emitted at most once per session).
- (c) **Open success**: pick CSV → click Open → `window.open` called with `(blobUrl, '_blank', 'noopener,noreferrer')`; mock returns a non-null window; `openStatus` flips `'opening' → 'opened' → 'idle'`; telemetry: `export_attempt` + `export_success` with `action: 'open'`.
- (d) **Open blocked**: pick HTML → click Open → `window.open` mock returns `null`; `openStatus` flips to `'blocked'` (sticky); inline status copy `Popup blocked — use Copy instead.` renders on the pill; telemetry: `export_fail` with `errorCode: 'popup_blocked'` and `action: 'open'`.
- (e) **Copy success — text path**: pick JSON → click Copy → `navigator.clipboard.writeText` called with the JSON text; `copyStatus` flips `'copying' → 'copied' → 'idle'` (1.8 s window); telemetry: `export_attempt` + `export_success` with `action: 'copy'`.
- (f) **Copy success — html path**: pick HTML → click Copy → `navigator.clipboard.write` called with one `ClipboardItem` carrying `'text/html'` + `'text/plain'` peer entries; `copyStatus` flips through the same window.
- (g) **Copy denied**: pick CSV → click Copy → `navigator.clipboard.writeText` rejects → `copyStatus` flips to `'denied'` (sticky); inline `deniedMessage` renders on the pill; telemetry: `export_fail` with `errorCode: 'clipboard_blocked'` and `action: 'copy'`.

**Cross-cutting cases:**

- (h) **Format-pick eagerly constructs Blob + text**: picking a format calls `buildExport`; the resolved blob/text are passed into the three hooks via the cluster props.
- (i) **Cross-cutting blob-construction failure**: simulate `buildExport` throwing → emit `export_fail` with `errorCode: 'blob_construction_failed'`; Sonner error toast renders (the only toast path); no per-action attempt telemetry fires.
- (j) **Empty atlas (DoD-8 / IS-18)**: empty-atlas fixture → all three actions still produce valid output; success toast (on the first successful action) says `... — empty atlas.`
- (k) **Refresh-with-prior (FR-1.2 / AC-1.1)**: action cluster stays enabled DURING a refresh; the resolved Blob (Save / Open / Copy all share it) carries the PREVIOUS atlas's `scan_timestamp`, not the new one.
- (l) **Telemetry payload includes `action` field** on every `export_*` event per ADR-0021. Verify by inspecting `getBuffer()` after each scenario.
- (m) **SDK fixture provenance**: the test fixture for `application.context.resourceAccess[0]` carries the `// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79, 128-146` comment at file top.

**Expected Output:**
1. Test file covers all 13 cases.
2. Tests fail until T036 lands (RED), then pass (GREEN).
**Depends on:** T017, T025, T027, T031, T032, T033, T035, T052, T054, T056 (TDD — RED test for T036; needs all upstream modules in place but NOT the integration into widget-surface.tsx)

---

**Task ID:** T041
**Title:** RED — Integration test — panel surface end-to-end action-cluster flow + AC-2.7 mid-scan navigation (write first)
**Description:** **(Amended per ADR-0021 supersession — three actions × three formats with success + failure modes per action.)** Add `components/atlas/__tests__/panel-surface-export.test.tsx`. Render the panel with a fixture page (3 renderings, each with a bound datasource). **TDD discipline:** RED tests authored before T037.

**Per-action coverage (mirrors T040 panel-side):**
- (a) **Save success** (simulated future sandbox): JSON → Save → synthetic anchor clicked; resolved Blob carries `body.page` (panel) + per-rendering `cross_tenant_pages[]` arrays; telemetry `surface: 'panel'`, `action: 'save'`.
- (b) **Save unsupported** (current sandbox): Save pill disabled with verbatim tooltip; mount-time informational `export_fail` with `errorCode: 'sandbox_blocked_download'`.
- (c) **Open success**: HTML → Open → `window.open` called; mock returns non-null; status `'opening' → 'opened' → 'idle'`.
- (d) **Open blocked**: pick any format → Open → `window.open` returns `null` → status `'blocked'`; telemetry `errorCode: 'popup_blocked'`, `action: 'open'`.
- (e) **Copy success — text path** (JSON or CSV): `clipboard.writeText` called with the text; status flips through the 1.8 s window.
- (f) **Copy success — html path**: `clipboard.write` called with `ClipboardItem` carrying `text/html` + `text/plain` peers.
- (g) **Copy denied**: `clipboard.writeText` rejects → status sticky-`'denied'`; telemetry `errorCode: 'clipboard_blocked'`, `action: 'copy'`.

**Panel-specific cases:**
- (h) **Mid-scan navigation (AC-2.7 — load-bearing for ADR-0016):** click Save (or Open / Copy — pick one to assert the invariant) → fire async event that changes `activePageId` → assert the resolved Blob's `body.page.page_id` equals the page active at the moment of the **action click**, NOT the new page. Per ADR-0021, the click-time clone is captured at action click, not at format-pick click.
- (i) **Zero-rendering page (AC-2.5)**: panel page with zero renderings → all three actions still produce valid output; `body.renderings: []`; success toast on first successful action acknowledges the empty state per UI § 11.7.
- (j) **Disabled-panel-loading state**: while per-page fetch is in flight, all three pills render in `disabled-panel-loading` state with the `Loading current page…` tooltip; format picker does not open on click.

**Cross-cutting cases:**
- (k) Telemetry payload includes `surface: 'panel'` and `action` field on every `export_*` event.
- (l) **SDK fixture provenance**: any fixture that fakes `application.context.resourceAccess[0]` carries the SDK source comment at file top.

**Expected Output:**
1. Test file covers all 12 cases.
2. Tests fail until T037 lands (RED), then pass (GREEN).
**Depends on:** T017, T025, T027, T031, T032, T033, T035, T052, T054, T056 (TDD — RED test for T037; needs all upstream modules but NOT the panel-surface integration)

---

**Task ID:** T042
**Title:** Schema-stability test — re-export byte-identical except `exported_at` (DoD-3 / AC-4.4)
**Description:** Add `core/atlas/export/__tests__/schema-stability.test.ts`. Construct a synthetic but realistic atlas fixture; call `buildExport` twice with `exportedAt: 't1'` and `exportedAt: 't2'` (different click times) but identical atlas + surfaceContext otherwise. Read both Blobs via `text()`. Assert: (a) both bodies differ ONLY in the `exported_at` field (and the `Exported at` line for CSV/HTML); a `diff` after stripping `exported_at` lines yields empty; (b) `JSON.stringify` field order is identical between exports; (c) Array sort order is identical (sample renderings + pages + datasources).
**Expected Output:**
1. Test file covers all 3 cases for all 3 formats (JSON/CSV/HTML).
2. `npm run test -- schema-stability` passes.
**Depends on:** T020, T022, T024

---

**Task ID:** T043
**Title:** Schema-version grep audit script (DoD-7)
**Description:** Add `scripts/audit-schema-version.mjs` (or similar). Behavior:
1. `grep -r "atlas_export_schema_version" core/atlas/export/` (or equivalent JS-native ripgrep / fs walk) and `grep -r "ATLAS_EXPORT_SCHEMA_VERSION"` across the project source (excluding `node_modules/`, `__tests__/`, and `core/atlas/export/schema-version.ts`).
2. The only declarations of the literal `1` for the constant must be in `schema-version.ts`. All other references must be **importers** (e.g. `import { ATLAS_EXPORT_SCHEMA_VERSION }`).
3. Exit code 0 if audit passes, non-zero with diagnostic on violation.
4. Wire into `npm run ci` so a future PR that re-declares `const VERSION = 1` somewhere fails CI.
**Expected Output:**
1. `scripts/audit-schema-version.mjs` exists and is executable via `node`.
2. `package.json` `scripts` adds `audit:schema` command + chains it into `ci`.
3. Audit passes on the post-implementation tree.
**Depends on:** T004

---

**Task ID:** T044
**Title:** Bundle-size audit (DoD-5 / NFR-1.4) — verify ≤20 KB gzipped delta
**Description:** Run `npm run build` on a clean checkout of the pre-export baseline (PRD-000 main / shipped tip). Record total `.next/` chunk-sizes (gzipped). Then run `npm run build` on the post-implementation branch (`prd-001`). Record same. Compute delta. Document in friction log under `bundle_smoke.final` with `{ before_kb_gzipped, after_kb_gzipped, delta_kb_gzipped, verdict: 'pass' | 'fail' }`. Pass threshold: delta ≤ 20 KB gzipped (NFR-1.4). If delta is over, escalate to /architect for a defer-or-reduce decision before /ship.
**Expected Output:**
1. Friction-log `bundle_smoke.final` populated with verdict.
2. Verdict captured in run-manifest `smoke_outcomes.bundle_delta`.
3. If `fail`, /ship blocked; /architect amendment task opened.
**Depends on:** T036, T037

---

**Task ID:** T045
**Title:** Antimetric guard wiring (DoD-6) — extend `scripts/check-antimetrics.mjs`
**Description:** Read existing `scripts/check-antimetrics.mjs`. Add three new forbidden patterns scoped to PRD-001's anti-metrics (PRD-001 § 3): `downloads per minute` (or variants `downloads/min`, `dl_per_min`, `download_rate`), `total bytes exported` (or `total_export_bytes`, `bytes_exported_total`), `format diversity per editor` (or `format_diversity_per_user`). The script scans documentation, dashboards, telemetry config, and source comments for these tokens. Failure: exit non-zero with the offending file:line. The `audit:anti-metric` script (already chained into `ci`) re-runs at /ship sign-off.
**Expected Output:**
1. `scripts/check-antimetrics.mjs` extended with the 3 new forbidden patterns.
2. Audit passes on the post-implementation tree.
3. Audit fails when a synthetic violation is introduced (verify by adding a temporary doc line, running, then removing).
**Depends on:** T036, T037

---

**Task ID:** T046
**Title:** Telemetry distribution check (DoD-9 / NFR-6.2) — friction log surfaces `export.attempt` / `export.success` / `export.fail` ratios
**Description:** Update the `/test` friction-log generator (or add a new check in `scripts/check-antimetrics.mjs`'s sibling — wherever the existing `friction-log-*.md` smoke section is computed). Behavior: at the end of the smoke pass, tabulate from the in-memory ring buffer:
- count of `kind === 'export_attempt'` per surface and format,
- count of `kind === 'export_success'` per surface and format,
- count of `kind === 'export_fail'` per error code,
- attempt:success ratio.

Write the table into the friction log under `export_telemetry_smoke`. If `export_fail.errorCode === 'sandbox_blocked_download'` count > 0 in the smoke pass, raise it as a P0 finding (R1).
**Expected Output:**
1. Friction-log generator extended.
2. After /test smoke pass, `export_telemetry_smoke` table is present and accurate.
**Depends on:** T031, T040, T041

---

**Task ID:** T047
**Title:** HTML print-preview manual gate (DoD-4 / AC-3.3 / AC-3.4) — Chromium + Firefox + Safari, A4 + Letter
**Description:** Manual QA task. Generate an HTML export from the widget surface against a representative fixture (≥500 pages, ≥2 sites). Open the saved `.html` file in the latest stable versions of:
1. Chromium (Edge or Chrome).
2. Firefox.
3. Safari (skip if no macOS available — note in friction log).

For each browser:
- Open the file (no JS, no remote network — verify in DevTools network tab that 0 requests fire).
- Open print preview at A4 paper size + at Letter paper size.
- Save as PDF; verify: (a) thead repeats on each page; (b) rows do not split across pages (`page-break-inside: avoid`); (c) partial-scan badge keeps its background colour (`-webkit-print-color-adjust: exact`); (d) typography legible at 11 pt body / 10 pt table.
- Capture screenshots, attach to friction log under `html_print_smoke`.

UI Designer signs off on visual parity with `pocs/poc-v1/html-output-sample.html`.
**Expected Output:**
1. Friction-log `html_print_smoke` with per-browser per-paper-size results.
2. UI Designer sign-off note.
**Depends on:** T040

---

**Task ID:** T048
**Title:** Host-frame visual smoke against POC clickdummy (per `sitecore:marketplace-sdk-host-frame-testing`)
**Description:** Invoke the `sitecore:marketplace-sdk-host-frame-testing` skill. Configure with the user-supplied host URL (Cloud Portal install) and the POC clickdummy as ground truth (`pocs/poc-v1/`). Capture before/after screenshots for:
- Widget header default state (S1 — `widget.html`).
- Widget format-picker open at 3 size tiers (S2/S2b/S2c — `widget-menu-open.html` / `-large.html` / `-huge.html`).
- Panel header default + format picker (S4/S5 — `panel.html` / `panel-menu-open.html`).
- Success toast (S6 — `toast-success.html`).
- Sandbox-blocked toast (S8 — `toast-failure-sandbox.html`) — only if T001 spike forced this code path; else skip.
- Why? popover (S9 — `popover-why-sandbox.html`) — same conditional skip.

Comparison should highlight any drift > 4 px or any color delta > 3 ΔE between live install and POC. Document under `host_frame_smoke` in friction log.
**Expected Output:**
1. Friction-log `host_frame_smoke` with per-screen verdicts.
2. Drift findings (if any) raised as follow-up tasks.
**Depends on:** T036, T037, T044

---

**Task ID:** T049
**Title:** Empty-atlas + zero-rendering-page integration test (DoD-8 / IS-18 / AC-2.5)
**Description:** Add `core/atlas/export/__tests__/empty-state.test.ts`. Cases: (a) atlas with `totals.renderings === 0` produces valid JSON with `body.renderings: []` and populated header (IS-18); (b) same atlas → CSV produces header block + column header + zero data rows (no errors); (c) same atlas → HTML produces `<p class="empty-state if-empty">(No renderings found.)</p>`; (d) panel surface with zero-rendering page produces `body.renderings: []` (AC-2.5); (e) success toast copy includes `— empty atlas.` for widget; (f) success toast for zero-rendering panel page acknowledges the empty state per § 11.7.
**Expected Output:**
1. Test file covers all 6 cases.
2. `npm run test -- empty-state` passes.
**Depends on:** T020, T022, T024, T040, T041

---

**Task ID:** T050
**Title:** CHANGELOG schema-version line (ADR-0019 CHANGELOG discipline)
**Description:** Edit `CHANGELOG.md` in the product root. Under the v1.0 / PRD-001 section add a line: `Schema: atlas export schema introduced at v1 — see ADR-0019.` This is the explicit affirmation per ADR-0019's CHANGELOG discipline.
**Expected Output:**
1. `CHANGELOG.md` carries the schema-version line.
2. /document agent (09) downstream picks this up automatically.
**Depends on:** T044

---

## 4b. Important Test Cases (by epic / feature)

Strengthened by QA (07): each case linked to a Task ID; gap-analysis additions appended where the LD missed an explicit AC / IS / R coverage. Specific PRD-001 acceptance gates checked: AC-1.6 (partial), AC-2.7 (mid-nav), AC-4.4 (byte-identical re-export), AC-5.3 (sandbox-blocked code), IS-13 (schema constant), IS-14 (deterministic ordering), IS-17 (display-name collision), IS-18 (empty atlas), R4 (CSV formula injection), R6 (HTML XSS).

### E1 — Spike + foundation
- T001 spike: widget surface success/silent_block/console_error captured (smoke / manual). Covered by T001 — outcome `silent_block` on both surfaces; verdict `fork-to-pageshot-pattern` per ADR-0021.
- T001 spike: panel surface success/silent_block/console_error captured (smoke / manual). Covered by T001 — same outcome.
- **T001a spike-fixture cleanup**: surface files restored to baseline; `grep -r "T001-SPIKE-FIXTURE" products/component-usage-atlas/site/` returns zero matches; build + typecheck + lint pass clean. Covered by T001a.
- T002 sonner install: bundle delta within budget (regression). Covered by T002 + T044.
- requireTenantIdentity: 6 unit cases incl. SDK fixture provenance comment. Covered by T006 (RED) → T005 (GREEN).
- Telemetry kinds: 4+ unit cases incl. type-conformance. Covered by T008 (RED) → T007 (GREEN).
- **Gap added — IS-13 single-source-of-truth**: schema-version constant has exactly one declaration. Covered by T043 (grep audit).
- **Gap added — Tenant identity error path**: when `application.context` is null OR resourceAccess is empty, surfaces enter the existing W5/P5 disabled state with no-data tooltip variant. Covered by T006 cases (c)–(e) + T040 / T041 disabled-state assertions.

### E2 — Pure construction core
- SurfaceContext clone: deep-clone integrity. Covered by T010 (RED) → T009 (GREEN).
- Header-builder: field-order contract + null-name + partial flag + IS-13 schema constant import. Covered by T012 (RED) → T011 (GREEN).
- Filename-builder: 10 unit cases incl. truncation + fallback + ISO compact + **IS-17 collision suffix**. Covered by T014 (RED) → T013 (GREEN).
- Size-estimator: 5 tier cases. Covered by T016 (RED) → T015 (GREEN).
- buildExport: 6 cases — purity asserted via spy on `getAtlasState` and `URL.createObjectURL` (zero calls). Covered by T018 (RED) → T017 (GREEN).
- **Gap added — IS-14 deterministic ordering at the build-export level**: re-running buildExport with shuffled atlas input arrays produces identical output. Covered by T042 schema-stability test + T020 cases (a)/(b)/(c).

### E3 — Format adapters
- JSON: 13 cases incl. ordering + partial (AC-1.6) + empty-state (IS-18 / DoD-8) + null tenant_name + **byte-identical re-export prereq (DoD-3 / AC-4.4)** + IS-17 collision visible at JSON layer. Covered by T020 (RED) → T019 (GREEN).
- CSV: 17 cases incl. RFC 4180 quoting + **R4 formula-injection guard with explicit `=`/`+`/`-`/`@` cases plus regression for numeric `0`** + empty-state. Covered by T022 (RED) → T021 (GREEN).
- HTML: 19 cases incl. **R6 XSS escape — full 5-entity coverage (`&`, `<`, `>`, `"`, `'`)** + attribute-context XSS + print stylesheet + no-remote-asset (AC-3.2 / NFR-4.3) + empty-state. Covered by T024 (RED) → T023 (GREEN).
- **Gap added — partial-scan badge in all three formats**: AC-1.6 explicitly covered in T020 (case e — JSON `is_partial`), T022 (header-block `# Partial:` line), T024 (case l — `<span class="badge-partial">` element).

### E4 — Download trigger + failure detection
- triggerDownload: 6 cases — happy path + blob_construction_failed + sandbox_blocked_download (AC-5.3). Covered by T026 (RED) → T025 (GREEN).
- detectFailure: 4 cases — fake-timer 5 s heuristic. Covered by T028 (RED) → T027 (GREEN).
- fallbackClipboard: 3 cases — success / blocked / large string. Covered by T030 (RED) → T029 (GREEN).
- **Gap added — F1/F2/F3 fallback hierarchy (ADR-0017)**: if T001 spike forks, fallback engineering becomes a separate task chain; for the green path, the `sandbox_blocked_download` errorCode is exercised end-to-end via T040 case (g).

### E5 — Surface integrations
- **Three-action hooks (per ADR-0021):**
  - `useSaveExport`: 5 unit cases incl. unsupported-state, future-success path, revert window, unmount cleanup, idempotency. Covered by T051 (RED) → T052 (GREEN).
  - `useOpenExport`: 5 unit cases incl. blocked path (`window.open` returns `null` → sticky `'blocked'`), 60 s deferred revoke, idempotency. Covered by T053 (RED) → T054 (GREEN).
  - `useCopyExport`: 6 unit cases incl. text path (writeText), html path (ClipboardItem with text/html + text/plain peers), capability detection, sticky-denied, unsupported initial status, idempotency. Covered by T055 (RED) → T056 (GREEN).
- Action cluster (T032, was DownloadButton): 13 cases — three actions render + Save disabled with verbatim tooltip + Open status transitions incl. `'blocked'` inline message + Copy status incl. sticky `'denied'` + format change resets actions + keyboard reach to all three pills via Tab + a11y + **runtime contrast assertion** + tab order (data-out before data-mutation). Covered by T038 (RED) → T032 (GREEN).
- FormatPickerMenu: 11 cases — order + size tiers + onSelect + **runtime contrast on warning tier** + arrow-key keyboard nav. (Format-only role per ADR-0021; action selection moved to T032.) Covered by T039 (RED) → T033 (GREEN).
- Widget integration: 13 cases — three actions × three formats with success + failure modes per action (Save success / Save unsupported / Open success / Open blocked / Copy success text / Copy success html / Copy denied) + cross-cutting blob-construction failure toast + empty atlas + refresh-with-prior + telemetry payload `action` field + SDK fixture provenance. Covered by T040 (RED) → T036 (GREEN).
- Panel integration: 12 cases — same three-action coverage + **AC-2.7 mid-scan navigation captured at action click** + zero-rendering page (AC-2.5) + disabled-panel-loading on all three pills + telemetry `surface: 'panel'` + `action` field + SDK fixture provenance. Covered by T041 (RED) → T037 (GREEN).
- **New surface-level cases (per ADR-0021):**
  - Save disabled state surfaces the verbatim tooltip and is keyboard-reachable. Covered by T038 case (b) + T040 case (b) + T041 case (b).
  - Open `'blocked'` state surfaces inline message pointing at Copy. Covered by T038 case (c) + T040 case (d) + T041 case (d).
  - Copy `'denied'` state surfaces sticky inline message. Covered by T038 case (d) + T040 case (g) + T041 case (g).
  - Telemetry payload includes `action` field on every `export.*` event. Covered by T040 case (l) + T041 case (k).
- **Gap added — Why? popover behavior**: per-error-code copy table coverage is not in T034 itself (no dedicated unit test); covered indirectly by T040 + T041 failure branches. The Why? popover's role narrows under ADR-0021 — most blockers are now per-action inline messages, not toast → popover.
- **Gap added — Toast helpers behavior**: per ADR-0021, only the cross-cutting blob-construction failure surfaces a Sonner error toast; per-action blocks (Save unsupported, Open blocked, Copy denied) surface inline status copy on the affordance, NOT a toast. Toast invocation path covered by T040 case (i) + success paths by T040 case (j).

### E6 — Tests + verification
- T042 schema-stability: byte-identical re-export modulo `exported_at` (DoD-3 / AC-4.4). Covered by T042.
- T043 schema-version grep audit (DoD-7 / IS-13). Covered by T043.
- T044 bundle-size audit ≤ 20 KB gzipped (DoD-5 / NFR-1.4). Covered by T044.
- T045 antimetric guard 3 patterns (DoD-6). Covered by T045.
- T046 telemetry distribution surfaces in friction log (DoD-9 / NFR-6.2). Covered by T046.
- T047 HTML print preview Chromium + Firefox + Safari × A4 + Letter (DoD-4 / AC-3.3 / AC-3.4). Covered by T047.
- T048 host-frame visual smoke vs POC ground truth. Covered by T048 (per `sitecore:marketplace-sdk-host-frame-testing`; auth interactive; POC at `pocs/poc-v1/` is first-run ground truth; do not silently promote host-frame screenshots to baselines; cross-origin DOM read restricted — fall back to visual diff).
- T049 empty-atlas + zero-rendering-page (DoD-8 / IS-18 / AC-2.5). Covered by T049.

## 4c. Implementation execution contract (for Developer 08)

### 4c-1. Non-negotiable technical boundaries

- **ADR-0002 — Mode A iframe-only.** No backend, no Auth0 changes, no server-to-server, no Mode B. The export is purely client-side over existing in-memory state.
- **ADR-0003 — No persistence.** Forbidden: IndexedDB, localStorage, sessionStorage, service-worker cache, cookies, in-memory caches that survive a tab reload. Snapshots exist only as the user's downloaded file.
- **ADR-0007 — Marketplace Client-Side scaffold posture is unchanged.** No new SDK initialization, no new providers, no new route entries.
- **ADR-0009 — Blok semantic tokens only.** No hand-picked hex anywhere except the canonical print-stylesheet hex map in § 4.7.3 of the UI design (which derives values from Blok tokens cited at globals.css line numbers). New tokens added in T003 must come from the Blok registry or be aliases with inline source comments.
- **ADR-0010 — Atlas state via module-level singleton.** The export module reads from `core/atlas-store.ts` exactly once per click (in the click handler, before passing into `buildExport`). The construction function never reads it. The export module never writes atlas state.
- **ADR-0013 — Telemetry stays in-iframe.** Use the existing `core/telemetry.ts` ring buffer + `console.info` mirror. No fetch/XHR/sendBeacon. No postMessage. New event kinds extend the existing union.
- **ADR-0015 — Export is a v1 feature, not a Phase 2 deferral.** PRD-000 OS-15 has been superseded; do not gate any export work on Phase 2 conditions.
- **ADR-0016 — `buildExport(...)` is pure.** No singleton reads, no React context reads, no `window` reads beyond `Blob`. `surfaceContext` is the only source of per-surface metadata; it is a click-time clone, never re-resolved.
- **ADR-0017 — Primary mechanism = Blob + URL.createObjectURL + synthetic `<a download>` + click + revoke.** F1/F2/F3 fallback engineering is **not** done unless T001 spike fails. 5 s detection heuristic per ADR-0017 § Detection contract.
- **ADR-0018 — No client-side PDF library.** No `jsPDF`, no `pdfmake`, no anything that bumps bundle materially. HTML + browser print dialog is the only PDF route. Bundle delta cap ≤20 KB gzipped (NFR-1.4 / DoD-5 / T044).
- **ADR-0019 — `ATLAS_EXPORT_SCHEMA_VERSION` lives in exactly one file.** `core/atlas/export/schema-version.ts`. Adapters import; tests import; no literal `1` for the schema version anywhere else. T043 grep audit enforces.
- **ADR-0020 — Tenant identity via `application.context.resourceAccess[0]`.** PRD shorthand `application.context.tenantName` is **wrong** at the runtime API level — use `requireTenantIdentity(ctx)` from `core/tenant-identity.ts`. Filename-builder synthesizes the `tenant-<last-7-of-tenantId>` fallback string; resolver returns `null` for missing name.
- **No new SDK calls.** The export reads exclusively from existing in-memory atlas state. No `xmc.agent.*`, no `xmc.sites.*`, no new query keys.
- **No new extension points** (NFR-7.1). No edits to Cloud Portal app registration.
- **HTML output: no JS, no remote assets, no remote fonts** (AC-3.2 / NFR-4.3). Inlined `system-ui` fallback chain only.
- **HTML-escape every interpolated string in HTML adapter** (R6 — XSS guard). All five entities: `&`, `<`, `>`, `"`, `'`.
- **CSV formula-injection guard** (R4 / OQ-9): leading single-quote prefix on fields starting with `=`, `+`, `-`, `@`.
- **Module size cap** (NFR-5.1): each format adapter ≤300 LOC.
- **POC clickdummy at `pocs/poc-v1/` is the visual source of truth.** When spec text and POC diverge on look-and-feel, POC wins.

### 4c-2. ADR one-liners

- **ADR-0001:** ADRs are the architecture backbone — every fundamental decision lives here, one decision per file.
- **ADR-0002:** Mode A iframe-only — no backend, no Mode B; carries forward unchanged.
- **ADR-0003:** No persistence — atlas is live in-memory; export does not introduce any storage.
- **ADR-0004:** Two surfaces (widget + panel) in one app — both get the export; no third surface.
- **ADR-0005:** Rendering = definition ID, datasource = item ID — export field semantics align.
- **ADR-0006:** Direct datasource bindings only in v1 — export reflects this scope.
- **ADR-0007:** Marketplace Client-Side scaffold (Scaffold 2) — unchanged; no new init.
- **ADR-0008:** Stay on Next.js + Turbopack — unchanged.
- **ADR-0009:** Blok is the UI layer — semantic tokens via the Blok registry; reuse existing primitives.
- **ADR-0010:** Atlas state = module-level singleton + `useSyncExternalStore` — export reads at click time only.
- **ADR-0011:** Loading visualization = branded animation — export uses inline button spinner only (no skeleton per UI § 2 — spinner is sufficient at <1.5 s).
- **ADR-0012:** Scan concurrency = 8 with backoff — irrelevant to export; carried forward.
- **ADR-0013:** Telemetry stays in-iframe — extend the ring buffer, no new transport.
- **ADR-0014:** `/` returns notFound — irrelevant to export; carried forward.
- **ADR-0015:** Export is a v1 feature, supersedes PRD-000 OS-15.
- **ADR-0016:** `buildExport` is pure; `surfaceContext` is click-time clone; never re-read singletons mid-construction.
- **ADR-0017:** Primary download = Blob + objectURL + synthetic anchor + click + revoke; F1/F2/F3 fallback engineered only if T001 spike fails.
- **ADR-0018:** No client-side PDF library — HTML + browser print is the only PDF route.
- **ADR-0019:** `ATLAS_EXPORT_SCHEMA_VERSION` constant lives in exactly one file; bump rules exhaustive — read the ADR before changing any field shape.
- **ADR-0020:** Tenant identity via `application.context.resourceAccess[0]`; new `requireTenantIdentity(ctx)` resolver in `core/tenant-identity.ts`.

### 4c-3. Stack / tooling specifics

- **Scaffold posture:** Marketplace Client-Side (per ADR-0007) — already locked by PRD-000; PRD-001 changes none of it. Verified via `sitecore:setup-scaffold` skill.
- **Project root:** `products/component-usage-atlas/site/`. There is **no `src/` prefix** in this project — source sits directly under `site/` with subfolders `app/`, `components/`, `core/`, `lib/`, `hooks/`, `scripts/`. Adjust any ADR/PRD prose that says `src/atlas/export/` to read `core/atlas/export/` for this product (see § 7 R-S2).
- **Package manager:** **`npm`** (not `pnpm`, not `yarn`). Confirmed by `package.json` + `package-lock.json`.
- **Node:** matches `@types/node ^25` — modern; use top-level await safely.
- **Next.js:** `16.1.7` with Turbopack (`next dev --turbopack`). React `19.2.4`.
- **Test runner:** `vitest 4.x` via `npm run test` (one-shot CI mode) and `npm run test:watch` (watch mode).
- **Test environment:** `jsdom` (per `vitest.config.ts`). Setup file: `vitest.setup.ts`.
- **Test imports:** `@testing-library/react ^16`, `@testing-library/jest-dom ^6`. Path alias `@` → `products/component-usage-atlas/site/` (e.g. `@/core/...`, `@/components/...`).
- **TypeScript:** `5.9.x`, strict mode (verify `tsconfig.json`).
- **Linter:** ESLint 9 (`npm run lint`). **Formatter:** Prettier 3 (`npm run format`). **Typecheck:** `npm run typecheck`.
- **Build:** `npm run build` runs `next build` — bundle delta verified here (T044).
- **Antimetric guard:** `npm run check:antimetrics` (= `npm run audit:anti-metric`). Script: `scripts/check-antimetrics.mjs`. T045 extends.
- **Network audit:** `npm run audit:network` — script `scripts/audit-network.mjs`.
- **CI sequence:** `npm run ci` = `lint && typecheck && test && build && audit:network && audit:anti-metric`. T043 chains a new `audit:schema` step into this.
- **Toast primitive add command (T002):** `npx shadcn@latest add @blok/sonner` (Blok registry already wired in `components.json`).
- **shadcn registry:** `"@blok": "https://blok.sitecore.com/r/{name}.json"` per `components.json`.
- **Other primitives composed (already installed):** `@blok/button` (`components/ui/button.tsx`), `@blok/dropdown-menu` (`components/ui/dropdown-menu.tsx` — exposes `DropdownMenuItemTitle` / `DropdownMenuItemDescription` slots), `@blok/popover` (`components/ui/popover.tsx`), `@blok/tooltip` (`components/ui/tooltip.tsx`), `@blok/icon` via `@/lib/icon` wrapper around `@mdi/js`.
- **Icons used:** `mdiDownload` (button), `mdiAlert` (size-warning + error toast), `mdiCheckCircle` (success toast), `mdiCodeBraces` (JSON menu item), `mdiTable` (CSV menu item), `mdiFileDocumentOutline` (HTML menu item), `mdiAlertCircle` (generic-failure toast). All routed through `@/lib/icon.tsx`'s `<Icon path={...} size={0.75} />` wrapper — never via direct `@mdi/react` imports.
- **Marketplace SDK:** `@sitecore-marketplace-sdk/client@0.3.2` + `@sitecore-marketplace-sdk/xmc@0.4.1`. No new SDK calls needed; reuse the existing `MarketplaceProvider` (`components/providers/marketplace.tsx`) — already unwraps `client.query("application.context")` as `res.data` (verified at line 34).
- **No new dependencies** to add beyond `@blok/sonner` from the Blok registry.
- **Runtime contrast helper (added by QA enrichment, per § 9.3):** Developer (08) creates `@/lib/contrast.ts` (~30 LOC) as part of T032's GREEN phase if it does not already exist. Pattern: `function contrast(fg: string, bg: string): number` — parses sRGB colors (handles `rgb(r, g, b)` strings returned by `getComputedStyle`), converts to relative luminance per WCAG 2.1, returns `(L1 + 0.05) / (L2 + 0.05)`. Used by T038 case (j), T039 case (j), and any future component test that paints with theme tokens. No runtime dependency — pure TS.

### 4c-4. UI implementation notes

- **Egress pattern (ADR-0021, supersedes single-Download-button pattern):** The surface header presents a format picker (existing PRD § 11.2 dropdown) followed by a three-action cluster: Save / Open / Copy. The Save action is **rendered as disabled** with the tooltip "Downloads are blocked in this iframe — use Open or Copy instead. (Save will work once Sitecore enables it.)" Open and Copy are first-class. Visual reference for the action cluster: `products/pageshot/site/next-app/components/ActionPill.tsx` (live in production). The original POC at `pocs/poc-v1/` shows a single Download button and is **stale on this aspect** — the action-cluster visual re-spin is deferred to `/document` polish. The Developer constructs the three pills from the same Blok primitives the POC used (`@blok/button` outline / ghost variants, `@blok/icon`) and follows pageshot's anatomy.

- **Hooks (one per action):**
  - `useSaveExport` — `core/atlas/export/hooks/use-save-export.ts` — canonical mechanism per ADR-0017 § Primary mechanism; future-proof.
  - `useOpenExport` — `core/atlas/export/hooks/use-open-export.ts` — `window.open(blobUrl, '_blank', 'noopener,noreferrer')`. Pattern from `products/pageshot/site/next-app/components/use-open-image.ts:62`.
  - `useCopyExport` — `core/atlas/export/hooks/use-copy-export.ts` — `navigator.clipboard.writeText` for JSON/CSV; `ClipboardItem` with text/html + text/plain peers for HTML. Pattern from `products/pageshot/site/next-app/components/use-copy-image.ts:128`.

- **Named direction:** **Quiet Affordance** (subtle divergence on PRD-000's already-shipped Blok visual language).
- **Winning POC clickdummy:** `pocs/poc-v1/` — the HTML clickdummy is the canonical visual reference for look-and-feel. Developer (08) **may open** the POC's HTML/CSS files (`poc.css`, `widget.html`, `widget-menu-open.html`, `widget-menu-large.html`, `widget-menu-huge.html`, `panel.html`, `panel-menu-open.html`, `toast-success.html`, `toast-success-csv.html`, `toast-success-html.html`, `toast-success-empty.html`, `toast-failure-generic.html`, `toast-failure-sandbox.html`, `popover-why-sandbox.html`, `html-output-sample.html`, `click-targets.md`) during implementation to match the intended appearance. **When spec text and clickdummy diverge on visual details, the clickdummy wins.**
- **Format-picker UX:** Blok dropdown menu via existing `components/ui/dropdown-menu.tsx`. Reuse `DropdownMenuItemTitle` + `DropdownMenuItemDescription` slots. Three items in fixed order JSON / CSV / HTML; each has format-name title + `.ext` muted suffix + use-case description.
- **Format-picker subtitles (verbatim per PRD-001 § 11.2):**
  - JSON: `Full data, machine-readable`
  - CSV: `Lite data, spreadsheet-friendly`
  - HTML: `Lite data, printable / shareable`
- **Tiered size annotation:** `< 5 MB` → no annotation; `5 MB ≤ s < 50 MB` → ` · ~N MB` (muted, `text-subtle-text` = `var(--muted-foreground)`); `≥ 50 MB` → warning glyph (`mdiAlert`, `text-warning-fg` = `var(--warning-foreground)`) + ` · ~N MB — Large, may take a moment`.
- **Two-variant failure toast:** generic (Retry + Why?) for `blob_construction_failed` / `unknown`; sandbox-blocked (Retry + Copy JSON + Why?) ONLY for `sandbox_blocked_download`. Copy-JSON action is hidden for any other error code; CSV/HTML downloads cannot be recovered via clipboard — Why? popover explains this.
- **Print stylesheet typography (HTML adapter):** Blok body tokens at 11 pt; inlined `system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif` fallback chain (no remote fonts). Body 11 pt / line-height 1.4; table 10 pt; h1 16 pt; footer 9 pt. Token references via `globals.css` (`--font-sans`, `--text-md`, `--text-xs`).
- **Canonical print hex map (§ 4.7.3 — derived from Blok tokens):**
  - Body bg `#ffffff` (`--color-white`, globals.css:11)
  - Primary text `#212121` (`--color-gray-900`, globals.css:71)
  - Muted text `#535353` (`--color-gray-600`, globals.css:68)
  - Border `#d8d8d8` (`--color-gray-200`, globals.css:65)
  - Partial badge bg `#ffe6bd` (`--color-warning-100`, globals.css:163)
  - Partial badge text `#7a2f00` (`--color-warning-700`, globals.css:169)
  - Footer text `#8e8e8e` (`--color-gray-400`, globals.css:66)

  Cite the globals.css line numbers in CSS comments next to each hex.
- **Token gaps to provision (T003):** `--shadow-popover` (POC aliased to `--shadow-md`); `--color-sonner-success` (POC derived from `--color-success-background`). Either provision via Blok registry or document alias choice with inline comment.
- **WCAG 2.1 AA contrast** verified in POC (8.93:1 partial-scan badge — AAA). Maintain on any new states.
- **Tab order on widget header:** existing controls (search, density, ...) → **`Download` (data-out)** → `Refresh atlas` (data-mutation). Spec mandates Download is **before** Refresh.
- **Iframe widths:** widget 300–800 px; panel 320–400 px. Effective breakpoint 480 px (Tailwind `sm:`):
  - widget < 480 px → icon-only, menu 280 px.
  - widget ≥ 480 px → label `Download` + icon, menu 320 px.
  - panel always icon-only with tooltip; menu 280 px.
- **Disabled-state copy (with `aria-describedby` to visually-hidden span):**
  - `disabled-no-data`: `No data — start a scan first.`
  - `disabled-scan-in-progress-no-prior`: `Scan in progress — finish the scan to download.`
  - `disabled-panel-loading`: `Loading current page…`
  - `constructing`: `Preparing your download…`
- **Refresh-with-prior visual treatment (A-UI-4):** button stays enabled with no spinner; the JSON `scan_timestamp` reveals the source-of-truth time to anyone who cares.
- **Panel button vs skipped-link warning visual cluster (OQ-UI-3):** if visual collision surfaces during integration, Developer is empowered to insert a 4-px Blok `<Separator />` between Download and the warning glyph without re-spec.
- **Toast positioning:** bottom-end of iframe viewport (Sonner default). `aria-live="polite"` for success, `aria-live="assertive"` for errors. Auto-dismiss 4 s for success; sticky for failure. Reduced-motion respected (Sonner default).
- **Why? popover:** anchored to Why? action button inside the toast; `align="end"`, side `top`, width 240 px (`w-60`). Per-error-code copy table per UI § 4.6 (4 codes: `blob_construction_failed`, `sandbox_blocked_download`, `clipboard_blocked`, `unknown`). Friction-log link conditional on ring buffer non-empty.
- **POC frame citations for tests (added by QA enrichment, per § 10):** T040 sandbox-blocked path (case g) → `pocs/poc-v1/toast-failure-sandbox.html`. T040 success toast → `pocs/poc-v1/toast-success.html` / `toast-success-csv.html` / `toast-success-html.html` / `toast-success-empty.html`. T040 generic-failure → `pocs/poc-v1/toast-failure-generic.html`. T041 panel success → `pocs/poc-v1/panel.html` + `panel-menu-open.html`. T047 HTML print preview → `pocs/poc-v1/html-output-sample.html`. T048 host-frame smoke uses the same set of frames. All are first-run ground truth — do NOT silently re-baseline.

### 4c-5. File / module structure and naming conventions

**Chosen export-root location:** `products/component-usage-atlas/site/core/atlas/export/`.

**Rationale:** the project's existing layout puts business-logic + state + telemetry under `core/` (atlas-store, scan-engine, telemetry, context-resolver, datasource-name-cache, etc.) and smaller orphan utilities under `lib/` (icon wrapper, slugify utilities, dedupe-pages). The export module is a multi-file feature module (12 files: schema-version, surface-context, header-builder, filename-builder, size-estimator, build-export, 3 format adapters, 3 download trigger files, 1 telemetry helpers, plus tests) that **reads from `core/atlas-store.ts`, extends `core/telemetry.ts`, and depends on the new `core/tenant-identity.ts`** — all `core/` siblings. Placing it under `core/atlas/export/` keeps the dependency graph short and matches the existing convention. `lib/` would be wrong — `lib/` holds tiny single-purpose utilities, not a 12-file feature module.

**ADR-0019 path-string drift:** ADR-0019 § Decision and prd-minimal-001 cite `src/atlas/export/schema-version.ts`. This was authored against the original PRD assumption of a `src/` prefix. The actual project layout has no `src/` — the canonical path is `core/atlas/export/schema-version.ts`. **Follow-up:** Developer (08) opens a small ADR amendment / patch task at /document time to update ADR-0019's path string. This task breakdown locks the actual location at `core/atlas/export/`. (See § 7 R-S2.)

**Module diagram:**

```
products/component-usage-atlas/site/
├── core/
│   ├── tenant-identity.ts                  # T005 — ADR-0020 resolver
│   ├── telemetry.ts                        # T007 — extend with export event kinds
│   ├── __tests__/
│   │   └── tenant-identity.test.ts         # T006
│   └── atlas/export/
│       ├── schema-version.ts               # T004 — ADR-0019 SoT
│       ├── surface-context.ts              # T009 — SurfaceContext + clone
│       ├── header-builder.ts               # T011
│       ├── filename-builder.ts             # T013 — FR-6 / § 9.4
│       ├── size-estimator.ts               # T015 — tiered for picker
│       ├── build-export.ts                 # T017 — ADR-0016 pure entry
│       ├── formats/
│       │   ├── json.ts                     # T019 — § 10.1
│       │   ├── csv.ts                      # T021 — § 10.2 + R4 guard
│       │   └── html.ts                     # T023 — § 10.3 + § 4.7
│       ├── download/
│       │   ├── trigger-download.ts         # T025 — ADR-0017 primary
│       │   ├── detect-failure.ts           # T027 — 5 s heuristic
│       │   └── fallback-clipboard.ts       # T029 — F2 stub
│       ├── telemetry/
│       │   └── events.ts                   # T031 — emitExportAttempt/Success/Fail
│       └── __tests__/
│           ├── surface-context.test.ts     # T010
│           ├── header-builder.test.ts      # T012
│           ├── filename-builder.test.ts    # T014
│           ├── size-estimator.test.ts      # T016
│           ├── build-export.test.ts        # T018
│           ├── json.test.ts                # T020
│           ├── csv.test.ts                 # T022
│           ├── html.test.ts                # T024
│           ├── schema-stability.test.ts    # T042
│           ├── empty-state.test.ts         # T049
│           └── download/
│               ├── trigger-download.test.ts  # T026
│               ├── detect-failure.test.ts    # T028
│               └── fallback-clipboard.test.ts# T030
├── components/
│   ├── ui/
│   │   └── sonner.tsx                      # T002 — added via shadcn registry
│   └── atlas/
│       ├── download-button.tsx             # T032
│       ├── format-picker-menu.tsx          # T033
│       ├── why-popover.tsx                 # T034
│       ├── export-toasts.ts(x)             # T035
│       ├── widget-surface.tsx              # T036 — edit existing
│       ├── panel-surface.tsx               # T037 — edit existing
│       └── __tests__/
│           ├── download-button.test.tsx    # T038
│           ├── format-picker-menu.test.tsx # T039
│           ├── widget-surface-export.test.tsx  # T040
│           └── panel-surface-export.test.tsx   # T041
└── scripts/
    └── audit-schema-version.mjs            # T043
```

**Naming conventions:**
- Source files: kebab-case `*.ts` / `*.tsx`.
- Test files: kebab-case `*.test.ts(x)`, co-located in `__tests__/` per existing convention (`core/__tests__/`, `components/atlas/__tests__/`, etc.).
- Component files: kebab-case `*.tsx` (matches the existing pattern — `widget-surface.tsx`, `panel-surface.tsx`, `density-toggle.tsx`).
- Component exports: PascalCase functions (`<DownloadButton>`, `<FormatPickerMenu>`, `<WhyPopover>`).
- TypeScript interfaces: PascalCase (`SurfaceContext`, `TenantIdentity`, `AtlasExportHeader`).
- TypeScript: strict mode (verify `tsconfig.json`); no `as any`; SDK-typed values must come from `@sitecore-marketplace-sdk/*` imports, not hand-rolled shapes.

### 4c-6. Integration and API contract notes

- **`client.query("application.context")` — the only SDK call this feature touches; reuses the existing call from `components/providers/marketplace.tsx`.**
  - Query map source: `node_modules/@sitecore-marketplace-sdk/client/dist/sdk-types.d.ts:236-240` — declares `'application.context': { params: void; response: ApplicationContext; subscribe: false }`.
  - Response type source: `node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:128-146` — `ApplicationContext` interface; key fields used here: `resourceAccess?: ApplicationResourceContext[]` (preferred) / `resources?: ApplicationResourceContext[]` (deprecated, do not read).
  - Tenant subobject source: `node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79` — `ApplicationResourceContext` interface; key fields: `resourceId: string`, `tenantId: string`, `tenantName?: string`, `tenantDisplayName?: string`, `context: { live: string; preview: string }`.
  - **Unwrap level:** single `.data` (Mode A pattern per `sitecore:marketplace-sdk-client` § 8b). The existing call site at `components/providers/marketplace.tsx:34` already handles this: `client.query("application.context").then((res) => res.data)`. The export module **does not call `client.query`** — it consumes the resolved `ApplicationContext` from `MarketplaceProvider`'s context.
  - Access path for tenant identity: `application.context.resourceAccess[0]` — go through `requireTenantIdentity` (T005). PRD shorthand `application.context.tenantName` is wrong at runtime per ADR-0020; resolver returns `{ tenantId, tenantName: string | null }`.

- **No new SDK calls.** No `xmc.agent.*`, no `xmc.sites.*`, no new query keys, no `client.subscribe`, no `client.mutate`. The export module reads exclusively from existing in-memory atlas indices populated by PRD-000's scan engine (per ADR-0010).

- **Error model:** `requireTenantIdentity` throws `AtlasNoContextError` (re-exported from `core/context-resolver.ts`) — same class used by `requireContextId`. Surfaces handle this by entering the existing W5 / P5 "no tenant context" disabled state — they do **not** retry, do **not** offer a fallback download, and do **not** show the export menu. Per PRD-001: when tenant identity is unresolvable, the Download button is disabled with the existing no-data tooltip variant.

- **Telemetry contract:** events go through `core/telemetry.ts`'s `track()` function — same ring-buffer + console.info mirror, no external transport (ADR-0013). New `kind` values: `'export_attempt' | 'export_success' | 'export_fail'`. Payload fields: `surface`, `format`, `atlasSize?`, `scopeKind?`, `durationMs?`, `errorCode?` per § 7 FR-9 / AC-5.1–5.3.

### 4c-7. Parity / rebuild pointers

`N/A — greenfield`. The run manifest `source.analysis_mode` is `greenfield`; this is a feature add on top of PRD-000's already-shipped greenfield work, not a rebuild of an external app. There is no asset bundle, content dump, or external parity target.

## 5. Dependencies

### Ordering constraints

- **T001 first, no exception.** ADR-0017 makes the iframe-download spike a hard fork in the plan: every other task assumes the primary mechanism works on real Cloud Portal. If the spike fails, T002+ proceeds only after a /architect amendment task selects F1/F2/F3 fallback engineering. This is the highest-risk gate in the plan.
- **T002 (`@blok/sonner` install) before any toast-wiring task.** T035 (toast helpers) and downstream surface-integration tasks (T036/T037) depend on the primitive existing in `components/ui/`.
- **T004 (schema-version.ts) before any adapter that emits the version field** — T011, T019, T021, T023, T042, T043.
- **T005 (`requireTenantIdentity`) before any module that resolves tenant identity** — T009, T011, T013, T036, T037.
- **T009 (SurfaceContext type) before T011 / T013 / T017 / format adapters / surface integrations.**
- **T011 (header-builder) before format adapters T019 / T021 / T023.**
- **T017 (buildExport) before surface integrations T036 / T037.**
- **T032 (DownloadButton) + T033 (FormatPickerMenu) + T035 (toasts) before surface integrations T036 / T037.**
- **T036 + T037 before integration tests T040 / T041, bundle audit T044, host-frame smoke T048.**
- **T040 + T041 before T042 (schema-stability), T046 (telemetry distribution), T047 (HTML print), T049 (empty-state).**
- **T044 before T050 (CHANGELOG line — bundle audit must pass).**

### Execution order (numbered list of every Task ID in valid dependency order — TDD-ordered)

Every RED test task appears BEFORE its corresponding implementation task. Trivial tasks (T002 install, T003 token provisioning, T004 SoT constant, T031 thin helpers, T034 popover, T035 toast helpers, T042–T050 audits/manual gates) preserve LD ordering — see § 9 for TDD applicability.

1. T001 — Iframe-download spike (blocking gate; non-TDD; outcome: `fork-to-pageshot-pattern`)
1a. T001a — Cleanup spike fixtures from widget-surface + panel-surface (non-TDD; depends on T001)
2. T002 — Install `@blok/sonner` (non-TDD; depends on T001a)
3. T003 — Provision missing tokens (non-TDD)
4. T004 — schema-version.ts (non-TDD; single-constant SoT, audit by T043)
5. T006 — RED tests for `requireTenantIdentity`
6. T005 — `requireTenantIdentity` impl (GREEN)
7. T008 — RED tests for new telemetry kinds
8. T007 — Extend telemetry kinds (GREEN)
9. T010 — RED tests for SurfaceContext clone
10. T009 — SurfaceContext type + clone (GREEN)
11. T012 — RED tests for header builder
12. T011 — Header builder (GREEN)
13. T014 — RED tests for filename builder
14. T013 — Filename builder (GREEN)
15. T016 — RED tests for size estimator
16. T015 — Size estimator (GREEN)
17. T018 — RED tests for buildExport orchestration + purity
18. T017 — buildExport entry function (GREEN)
19. T020 — RED tests for JSON adapter
20. T019 — JSON adapter (GREEN)
21. T022 — RED tests for CSV adapter
22. T021 — CSV adapter (GREEN)
23. T024 — RED tests for HTML adapter
24. T023 — HTML adapter (GREEN)
25. T026 — RED tests for triggerDownload
26. T025 — triggerDownload (GREEN)
27. T028 — RED tests for detectFailure
28. T027 — detectFailure (GREEN)
29. T030 — RED tests for fallbackClipboard
30. T029 — fallbackClipboard stub (GREEN)
30a. T051 — RED tests for `useSaveExport`
30b. T052 — `useSaveExport` hook (GREEN)
30c. T053 — RED tests for `useOpenExport`
30d. T054 — `useOpenExport` hook (GREEN)
30e. T055 — RED tests for `useCopyExport`
30f. T056 — `useCopyExport` hook (GREEN)
31. T031 — Telemetry emit helpers (non-TDD; thin delegating wrappers, behavior covered by T040/T041)
32. T038 — RED component test for action cluster (Save/Open/Copy + per-action statuses)
33. T032 — Action cluster composite (GREEN; consumes T052/T054/T056 hook status types)
34. T039 — RED component test for `<FormatPickerMenu>`
35. T033 — `<FormatPickerMenu>` (GREEN)
36. T034 — `<WhyPopover>` (non-TDD; behavior covered indirectly by T040/T041 sandbox-blocked path)
37. T035 — Toast helpers (non-TDD; delegating wrappers; behavior covered by T040/T041)
38. T040 — RED integration test for widget-surface end-to-end download
39. T036 — Wire into widget-surface (GREEN)
40. T041 — RED integration test for panel-surface + AC-2.7 mid-scan navigation
41. T037 — Wire into panel-surface (GREEN)
42. T042 — Schema-stability test (DoD-3 / AC-4.4 — independent regression test)
43. T043 — Schema-version grep audit (DoD-7 — CI guard)
44. T044 — Bundle-size audit (DoD-5 — manual gate)
45. T045 — Antimetric guard wiring (DoD-6 — CI guard)
46. T046 — Telemetry distribution check (DoD-9 — smoke)
47. T047 — HTML print preview manual gate (DoD-4 — manual)
48. T048 — Host-frame visual smoke (manual / visual regression)
49. T049 — Empty-state integration test (DoD-8 / IS-18 / AC-2.5)
50. T050 — CHANGELOG schema-version line

### Parallel groups (Team Lead may spawn multiple Developers when justified — TDD-aware)

```
Group 1 (sequential — gate):                       T001
Group 1a (sequential — cleanup spike fixtures):    T001a (depends on T001)
Group 2 (sequential — foundation install):         T002 (depends on T001a)
Group 3 (parallel — depends on T002):              T003, T004
Group 4 (parallel — RED tests; depends on T002):   T006, T008, T016, T051, T053, T055
Group 5 (parallel — GREEN impls; depends on RED):  T005 (needs T006), T007 (needs T008), T015 (needs T016), T052 (needs T051), T054 (needs T053), T056 (needs T055)
Group 6 (parallel — RED tests; depends on T005):   T010
Group 7 (sequential — GREEN; depends on T010):     T009
Group 8 (parallel — RED tests; depends on T004/T009): T012 (needs T004,T009), T014 (needs T005)
Group 9 (parallel — GREEN; depends on RED):        T011 (needs T012), T013 (needs T014)
Group 10 (sequential — RED test; depends on T009/T011/T013): T018
Group 11 (sequential — GREEN; depends on T018):    T017
Group 12 (parallel — RED tests; depends on T011):  T020, T022, T024
Group 13 (parallel — GREEN; depends on RED):       T019 (needs T020), T021 (needs T022), T023 (needs T024)
Group 14 (parallel — RED tests; depends on T002):  T026, T028 (needs T025? no — T028 RED comes before T027 impl; T028 depends on T025), T030 (needs T001a)
Group 15 (parallel — GREEN; depends on RED):       T025 (needs T026), T027 (needs T028 + T025), T029 (needs T030 + T001a)
Group 16 (sequential — non-TDD helpers):           T031 (depends on T007), T034 (depends on T002)
Group 17 (parallel — RED component tests; depends on T002/T003): T038, T039
Group 18 (parallel — GREEN components; depends on RED + hooks): T032 (needs T038 + T002,T003,T015 + T052,T054,T056), T033 (needs T039 + T032)
Group 19 (sequential — non-TDD helper):            T035 (depends on T029, T031, T034)
Group 20 (parallel — RED integration tests; depends on full impl set including hooks): T040 (needs T052/T054/T056), T041 (needs T052/T054/T056)
Group 21 (parallel — GREEN integrations; depends on RED): T036 (needs T040), T037 (needs T041)
Group 22 (parallel — depends on T036/T037):        T044, T045, T048
Group 23 (parallel — depends on T020/T022/T024/T036/T037): T042, T049
Group 24 (sequential — depends on T031/T036/T037): T046
Group 25 (sequential — depends on T036):           T047
Group 26 (parallel — depends on T004):             T043
Group 27 (sequential — depends on T044):           T050
```

Rules per template: groups execute in order; within a parallel group, all tasks can run simultaneously in separate Developer agent contexts; a group starts only when ALL tasks it depends on are complete. T001 is the single highest-priority sequential gate — never parallelize anything against it. **TDD discipline:** every "GREEN impl" group enters only after its paired RED test group lands and shows red — execution agent verifies the RED state before authoring the GREEN.

## 6. Suggested Milestones

- **M1 — Spike + foundation green** (after Group 4): T001 spike returns success on both surfaces; `@blok/sonner` installed; schema-version + tenant-identity + telemetry kinds in place. **Decision gate:** if T001 forks, halt and re-plan F1/F2/F3 before proceeding past M1.
- **M2 — Pure construction core green** (after Group 9): SurfaceContext, header, filename, size estimator, buildExport + all 3 format adapters land with their unit tests passing. The export feature is now testable in isolation; no UI yet.
- **M3 — Surface integrations green** (after Group 17): Download button + format picker + toasts wired into both surfaces; integration tests pass; widget + panel both produce real downloads in jsdom.
- **M4 — Verification + ship-ready** (after Group 23): schema-stability re-export passes; bundle delta within 20 KB; antimetric guard wired; HTML print preview signed off; host-frame visual smoke passes; CHANGELOG line in. Ready for `/code-review` → `/test` → `/document` → `/ship`.

## 7. Risk Areas

- **R-S1 — T001 iframe-download spike fork (highest risk).** ADR-0017 makes T001 the entry gate. If either surface returns `silent_block` or `console_error`, the F1/F2/F3 fallback engineering branch activates and the entire E4 epic re-scopes (F1 = window.open new-tab; F2 = clipboard JSON only; F3 = hard-fail toast). Mitigation: T001 is procedurally enforced as the first executable task — `Depends on: none` is intentional. Spike is run on a real Cloud Portal install (not Storybook, not headless browser), per ADR-0017 § Easier (DoD-1 is satisfied by *interaction with the real iframe sandbox*, not a simulation).

- **R-S2 — ADR-0019 path-string drift.** ADR-0019 § Decision and prd-minimal-001's "Key constraints" both cite `src/atlas/export/schema-version.ts`. The actual project layout has no `src/` prefix — this task breakdown locks the canonical path at `core/atlas/export/schema-version.ts`. **Follow-up required:** Developer (08) opens a small ADR amendment / patch at /document time to update ADR-0019's path string to match. Until then, anyone following ADR-0019 verbatim will fail to find the file — readers should defer to this task breakdown's § 4c-5 module diagram.

- **R-S3 — `@blok/sonner` install timing (OQ-UI-1).** The toast primitive is not yet in `components/ui/`. T002 must run before any toast-wiring task; if `npx shadcn@latest add @blok/sonner` fails (registry outage, slug rename, version conflict), all surface-integration work stalls. Mitigation: T002 captures bundle delta in the friction log so any unexpected size jump surfaces immediately; if the install fails, escalate to `sitecore:blok-components` skill for the current canonical slug.

- **R-S4 — Missing Blok tokens (`--shadow-popover`, `--color-sonner-success`).** POC pre-flagged; T003 must provision these. Risk: if the Blok registry doesn't expose them, the Developer is empowered to alias with inline source comments — this is acceptable but generates technical debt that should be tracked in friction log.

- **R-S5 — NFR-1.4 bundle cap.** ≤20 KB gzipped delta. The current estimate (UI design § 1): ~2-3 KB for sonner + a few KB per format adapter + the inlined HTML print stylesheet. T044 measures the actual delta from PRD-000 baseline. Mitigation: HTML adapter's inlined `<style>` block is the most likely overshoot — if measured delta > 18 KB, Developer should compress CSS by collapsing whitespace and shortening selectors before /ship. If still > 20 KB, halt and escalate.

- **R-S6 — JSON.stringify perf on 50k-page atlases (OQ-UI-2).** `estimateAtlasSizeBytes` heuristic may exceed 10 ms on menu-open for very-large tenants. Mitigation: T015 documents fallback heuristic `atlas.totals.pages × 8 KB`; Developer benchmarks before locking the implementation.

- **R-S7 — Panel button vs skipped-link warning visual cluster (OQ-UI-3).** UI design empowers Developer to insert a 4-px Blok `<Separator />` if cluster surfaces during integration — no re-spec required. Mitigation: T037 explicitly checks visual parity against POC `panel.html`.

- **R-S8 — Open action's `window.open` may also be popup-blocked** if the iframe sandbox lacks `allow-popups` (per ADR-0021's three-action egress pattern). Pageshot ships `useOpenImage` with a `'blocked'` status fallback for exactly this case — atlas inherits the same posture via T054 (`useOpenExport`). If Open is also blocked at smoke time, Copy is the remaining egress; users with both popups + clipboard restricted are not served by v1 — escalate to Phase 2 (e.g. data: URL fallback or alternate egress channel). Mitigation: T054 case (c) covers the `'blocked'` status path; T040 case (d) + T041 case (d) verify the inline message routes the editor to Copy; live-host smoke at /test confirms `allow-popups` is present (Pageshot's production proof says it is).

- **R1 (PRD-001) — Iframe sandbox blocks Blob mechanism.** Same as R-S1 — see above. **Status as of 2026-05-04**: confirmed `silent_block` on both surfaces; ADR-0017 superseded by ADR-0021's three-action pattern; Save preserved as future-proof affordance, Open + Copy promoted to first-class actions.

- **R2 — Tenant name not exposed.** ADR-0020 + T005 + T013 cover the fallback path. Filenames degrade to `tenant-<last-7-of-tenantId>` slug; JSON `tenant.tenant_name = null` (deliberate — tooling can detect the case). Editor-unfriendly but functional.

- **R3 — Very-large tenants exceed Blob limits.** NFR-1.2 — graceful failure path. T025 (`triggerDownload`) catches `URL.createObjectURL` throw and returns `blob_construction_failed` errorCode. T015 size estimator surfaces the warning glyph at ≥50 MB so the editor sees the warning before clicking.

- **R4 — CSV formula injection.** T021 implements OWASP-style leading-quote prefix on `=`/`+`/`-`/`@`. T022 unit tests cover this with 4 explicit cases.

- **R5 — Schema v1 wrong shape.** ADR-0019's exhaustive bump rules + DoD-7 audit (T043) + CHANGELOG discipline (T050) catch this early. Phase 2 adds explicit migration tooling if needed.

- **R6 — HTML XSS via display names.** T023 HTML adapter HTML-escapes every interpolated string; T024 tests cover `<script>`, `&`, `'` cases. NFR-4.3 enforced.

- **R7 — Print output broken in non-Chromium.** T047 manual gate covers Chromium + Firefox + Safari × A4 + Letter. Sign-off captured in friction log.

- **R8 — Telemetry ring buffer overflow.** ADR-0013's bounded ring buffer is FIFO-evicting by design; documented in friction log if surfaced. No engineering required.

- **R9 — "No filter applied" UX confusion.** Tooltip on Download button: `Downloads the full atlas — view filters do not apply.` Implementation note for T032: this tooltip is the secondary disabled-state copy fallback when state === enabled; verify with QA.

- **R10 — Snapshot-for-diff use case is hypothetical.** S9 telemetry validates A-PAIN-2 post-launch; no engineering risk pre-launch.

- **R11 — Concurrent downloads from same tab.** Local React state per surface; menu closes on selection; downloads serialize naturally. No engineering required.

- **R12 — Browser blocks synthetic anchor click as popup.** Covered by T001 spike; if surfaced, F1 fallback engineered post-spike.

- **R13 — Print stylesheet conflicts with editor browser extensions.** Standard CSS only; no exotic features. T047 manual gate verifies.

## 8. Suggested Team Structure

**Single-developer feasibility:** the entire plan (50 tasks, M1→M4) is achievable by one Developer agent in pipeline mode. The dependency graph is mostly linear with clear gates, and task scope is bounded.

**Parallelization opportunity:** after M1 (Group 4 complete), the format adapters in E3 (T019/T021/T023 + their tests T020/T022/T024) and the download trigger in E4 (T025/T027/T029 + tests T026/T028/T030) are fully independent of one another. A second Developer agent can take E4 in parallel with E3 once T011 and T002 are in place. Surface integrations (T036/T037) can also parallelize once their full dependency set lands. T040 + T041 (integration tests on widget + panel) parallelize trivially.

**Recommended:** start single-Developer through M1 (T001 is the gate — no parallelism possible). After M1, evaluate whether to spawn a second Developer for the E3 + E4 parallel group; this typically saves a half-day on a 5-day estimate. If a second Developer is unavailable, sequential pipeline is fine.

**QA Specialist (07):** enriches sections 9 + 10 in step 2 of /task-breakdown; rewires Depends-on for TDD (RED before GREEN). At /test the same agent runs T046 (telemetry distribution), T047 (HTML print manual gate), T048 (host-frame visual smoke).

**UI Designer (05):** signs off on T047 (HTML print preview) and T048 (host-frame visual smoke vs POC).

**Team Lead (00):** signs off on T044 (bundle delta) and the antimetric guard at /ship (DoD-6).

## 9. TDD and quality contract

This is the test contract that governs all PRD-001 implementation. Where it conflicts with the LD's prose, this section wins.

### 9.1 RED → GREEN → REFACTOR mandate

Every task in § 10 marked `unit | integration | UI` follows the cycle:
1. **RED.** Author the test file FIRST. The assertion(s) must fail in a meaningful way (typically `import-error` because the implementation file does not exist yet, or behavioral mismatch). Do NOT pre-skip the assertion. Verify the test runs and fails before moving on.
2. **GREEN.** Author the minimum implementation that turns the test green. Resist scope creep — features not asserted by a test do not exist yet.
3. **REFACTOR.** Once green, refactor for clarity, dedup, and module-cap (NFR-5.1). Re-run the test suite — must stay green.

**No production code before a failing test for that behavior.** If the developer finds themselves typing implementation without a corresponding RED assertion, stop, write the assertion first, watch it fail, then resume.

### 9.2 Per-layer rules

| Layer | Modules | Test runner / env | Mocking |
|-------|---------|--------------------|---------|
| **Pure functions** | T004 schema-version, T009 surface-context, T011 header-builder, T013 filename-builder, T015 size-estimator, T017 build-export, T019/T021/T023 format adapters, T005 tenant-identity | Vitest, jsdom (per `vitest.config.ts`) | None — no SDK, no React, no DOM beyond what `Blob` requires. Fixtures plain TS objects. |
| **DOM-touching modules** | T025 trigger-download, T027 detect-failure | Vitest, jsdom | `vi.spyOn(URL, 'createObjectURL')`, `vi.spyOn(URL, 'revokeObjectURL')`, `vi.spyOn(HTMLAnchorElement.prototype, 'click')`. **Fake timers** (`vi.useFakeTimers()`) for the 5 s heuristic. |
| **Clipboard fallback** | T029 fallback-clipboard | Vitest, jsdom | `vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } })`. |
| **React components** | T032 download-button, T033 format-picker-menu, T034 why-popover, T035 export-toasts | Vitest + `@testing-library/react` + `@testing-library/user-event` + jsdom | Behavior-driven: assert open/close/select/keyboard interactions. NEVER assert on internal state, internal class names that don't carry semantic meaning, or implementation details. |
| **Surface integrations** | T036 widget-surface, T037 panel-surface | Vitest + RTL + jsdom | Mock `URL.createObjectURL`, capture synthetic `<a>` element via `vi.spyOn(document, 'createElement')` or by querying `document.body` after click. Read Blob via `text()`. Existing `MarketplaceProvider` test pattern from `panel-surface.test.tsx` is the precedent. |
| **Telemetry** | T007 telemetry kinds, T031 emit helpers | Vitest, jsdom | Assert event-type emission + payload shape via the existing telemetry mock pattern in `core/__tests__/telemetry.test.ts`. Use `vi.spyOn(console, 'info')` for the `[CUA]` mirror. |
| **Schema-stability (DoD-3)** | T042 schema-stability | Vitest, jsdom | Re-export an unchanged atlas twice with different `exportedAt`; assert byte-identical except the `exported_at` substring (after stripping that line). |
| **Accessibility (WCAG 2.1 AA)** | T038, T039 | Vitest + RTL + user-event | Keyboard reach: `userEvent.tab()` lands on trigger. Arrow-key menu nav. Escape closes menu/popover. Tab order respects DOM order (data-out before data-mutation per UI § 4.8). `aria-label` and `aria-describedby` assertions per the disabled-state copy table. |

### 9.3 Runtime contrast assertion rule

For any component that paints with theme tokens (`bg-popover`, `text-warning-foreground`, `--primary-foreground`, the partial-scan badge, the size-warning glyph, the sandbox-blocked toast variant), tests MUST assert *resolved* foreground/background contrast at runtime via `getComputedStyle()`, NOT just `toHaveClass(...)`. Rationale: `toHaveClass("bg-primary")` passes even when `--primary-foreground` collapses onto `--primary` in dark mode (Blok Nova preset has shipped this way at least once — QuickCopy Share Link strip). Pattern:

```ts
import { contrast } from '@/lib/contrast'; // WCAG relative-luminance helper
const el = screen.getByRole('button', { name: /download/i });
const cs = getComputedStyle(el);
expect(contrast(cs.color, cs.backgroundColor)).toBeGreaterThanOrEqual(4.5); // WCAG AA
```

Tests that only assert `toHaveClass("text-warning-foreground")` are CR-blockers. The contrast helper lives at `@/lib/contrast.ts` — Developer (08) creates it as part of the GREEN phase of T032 if absent (small, ~30 LOC, sRGB→linear→relative-luminance per WCAG 2.1).

### 9.4 SDK fixture provenance rule

Every fixture file for SDK-touching code (`tenant-identity.test.ts` in T006, any test that fakes `application.context` in T040 / T041, any test that constructs an `ApplicationResourceContext`) MUST include this comment at the top of the file:

```ts
// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79, 128-146
```

The cited lines (verified for this run) define:
- `ApplicationResourceContext` (lines 69-79): `resourceId`, `tenantId`, `tenantName?`, `tenantDisplayName?`, `context: { live, preview }`.
- `ApplicationContext` (lines 128-146): `id`, `url`, `resourceAccess?: ApplicationResourceContext[]` (preferred), `resources?: ApplicationResourceContext[]` (deprecated).

**Why:** RED → GREEN against a paraphrased fixture is the failure mode that shipped QuickCopy v0.1 broken with 167 passing tests. See rules `40-sdk-contracts.mdc` and `30-tdd.mdc`. Fixtures without provenance are CR-blockers.

### 9.5 DoD audit gates

Each gate must show green before /ship. The gate is enforced by the cited Task ID; QA / Team Lead inspects the artifact at /ship.

| Gate | Description | Enforced by |
|------|-------------|-------------|
| **DoD-3** | Re-export of an unchanged atlas produces byte-identical output except `exported_at`. | T042 (schema-stability test). |
| **DoD-5** | Bundle delta ≤ 20 KB gzipped — `next build` size diff against PRD-000 baseline. | T044 (bundle-size audit; verdict written to `smoke_outcomes.bundle_delta`). |
| **DoD-7** | `grep` for `atlas_export_schema_version` (and `ATLAS_EXPORT_SCHEMA_VERSION`) across `core/atlas/export/` returns only importers, never additional declarations. | T043 (`scripts/audit-schema-version.mjs`, chained into `npm run ci`). |
| **DoD-8** | Empty atlas (zero renderings) AND a zero-rendering page produce valid files in all three formats. | T049 + T020 case (h)/(i) + T022 case (n) + T024 case (m). |
| **DoD-9** | Telemetry distribution table (`export_attempt` / `export_success` / `export_fail` per surface and format) appears in the /test friction-log report. | T046. |

**Coverage targets per NFR-5.3:** ≥ 90 % statement coverage on `core/atlas/export/`. Tests are **meaningful** — no `expect(true).toBe(true)`, no identity checks (`expect(x).toBe(x)`), no tautologies. Each assertion checks behavior the user, contract, or DoD cares about. Trivial coverage padding (e.g. asserting `typeof fn === 'function'`) is a CR-blocker.

### 9.6 TDD applicability per task — non-TDD exceptions

The following tasks deliberately do not follow the RED-first cycle, with reason:

| Task | Reason TDD does not apply |
|------|--------------------------|
| T001 | Spike — runs on real Cloud Portal install; outcome is captured in friction log, not a unit test. |
| T001a | Spike-fixture cleanup — no behavior change; verified by `grep` for `T001-SPIKE-FIXTURE` returning zero matches + clean build/typecheck/lint. |
| T002 | Install task — `npx shadcn add @blok/sonner` is a single shell command; success/failure is the install itself + bundle-delta record. |
| T003 | Token provisioning in `app/globals.css` — no behavior to assert in unit tests; verified by T040 / T041 integration runtime contrast assertions and by T032 / T033 component tests. |
| T004 | Single-constant SoT (`export const ATLAS_EXPORT_SCHEMA_VERSION = 1 as const`) — too small for a dedicated RED test; T043 grep audit + T012 header-builder test (case g) covers behavior. |
| T031 | Thin delegating wrappers around `track()`. Behavior is asserted at integration layer (T040 / T041) — adding dedicated unit tests would be tautological re-assertion of the wrapper signature. |
| T034 | Why? popover — copy-table component. No dedicated unit test in plan; behavior asserted in T040 / T041 failure branches when surfaces trigger the popover. (Role narrowed under ADR-0021 — most blockers are now inline, not popover.) |
| T035 | Toast helpers — presentation wrappers around `sonner`'s API; behavior asserted at integration layer (T040 / T041). Per ADR-0021 only the cross-cutting blob-construction failure path runs through these helpers; per-action failures stay inline. |
| T042–T050 | Audits, manual gates, CI guards, CHANGELOG line — these ARE the tests / gates, not subjects of further tests. |

**TDD-applicable tasks added per ADR-0021:**

| Task | Type | RED → GREEN pair |
|------|------|------------------|
| T051 | unit | RED for T052 (`useSaveExport`) |
| T052 | unit | GREEN — depends on T051 |
| T053 | unit | RED for T054 (`useOpenExport`) |
| T054 | unit | GREEN — depends on T053 |
| T055 | unit | RED for T056 (`useCopyExport`) |
| T056 | unit | GREEN — depends on T055 |

### 9.7 Marketplace UI visual smoke

For the surface integrations (E5), the final test gate is a Playwright visual diff against the POC clickdummy at `pocs/poc-v1/`. This is layered ON TOP OF the integration tests — not a substitute. Toolchain note: Playwright MCP currently rejects `file://` URLs — substitute with screenshots loaded via `npx serve pocs/poc-v1/`. Host-frame canonical visual target invariants apply (per `sitecore:marketplace-sdk-host-frame-testing`):

- Inputs are mandatory and user-supplied — host URL + app origin must come from the user.
- Auth is interactive only — never script SSO; never persist storage state across runs.
- POC clickdummy is the first-run ground truth — `pocs/poc-v1/` resolved from `ui_design.selected_poc_path` in the run manifest.
- Do not silently promote host-frame screenshots to baselines — if the design has drifted, raise as a finding ("POC drift") and route back through `/architect`, do NOT invent a new baseline.
- Cross-origin iframe DOM read is restricted — when state coverage requires reading the frame's DOM, fall back to visual diff against the POC.

T048 owns this gate.

### 9.8 No-trivial-tests rule (signature behavior)

The following are CR-blockers when found in any test file authored as part of this PRD:

- `expect(true).toBe(true)` and any tautology of similar shape.
- `expect(typeof fn).toBe('function')` — does not exercise behavior.
- `expect(component).toBeTruthy()` standing alone — assert the rendered output, not the component reference.
- `toHaveClass("text-foo")` standing alone for theme-token-painted elements — must be paired with the runtime contrast assertion per § 9.3.
- Snapshot tests with no behavioral hook ("matches snapshot" only) — replace with explicit role-based queries.
- SDK fixtures lacking the `// source: node_modules/...` comment per § 9.4.

QA reviewer (07) flags these in /code-review and /test.

## 10. Per-task test specifications

One entry per Task ID for every code-touching task in § 4. Non-code tasks (spikes, audits, manual gates) labeled `manual-gate` or `audit` and described as such.

---

### T001 — Iframe-download mechanism verification spike (ADR-0017)

**Test type:** manual-gate (spike, not unit-testable).

**Verification criterion:** the canonical Blob + `URL.createObjectURL` + synthetic anchor + click + revoke mechanism works on a real Cloud Portal install on BOTH `xmc:dashboardblocks` (route `/widget`) AND `xmc:pages:context-panel` (route `/panel`), in the latest Chromium browser. Outcomes captured per surface in `friction-log-20260503T101441Z.md` under `download_smoke`. Hard fork to F1/F2/F3 if either surface returns `silent_block` or `console_error`.

**Provenance / fixtures:** N/A — runs against a live Cloud Portal install with a real test tenant; no fixture.

**Runtime contrast check:** N/A.

**Acceptance gate:** R-S1 / R1 / OQ-1 (PRD-001) — establishes the primary mechanism viability before the rest of the plan executes.

---

### T001a — Remove T001 spike fixtures from widget-surface and panel-surface

**Test type:** manual-gate (cleanup; no behavior change).

**Verification criterion:** `grep -r "T001-SPIKE-FIXTURE" products/component-usage-atlas/site/` returns zero matches; both surface files restored to their pre-T001 state; `npm run typecheck && npm run lint && npm run build` pass clean.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0021 § Verification (post-spike) — clean exit from spike state before T002+ resumes.

---

### T002 — Install `@blok/sonner` toast primitive

**Test type:** manual-gate (install verification + bundle-delta record).

**Verification criterion:** `components/ui/sonner.tsx` exists; `<Toaster />` mounted on widget + panel layouts; `npm run lint && npm run typecheck` pass; bundle delta recorded in friction log under `bundle_smoke`.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** OQ-UI-1 / R-S3 (sonner install).

---

### T003 — Provision missing Blok tokens (`--shadow-popover`, `--color-sonner-success`)

**Test type:** manual-gate (CSS provisioning + runtime verification).

**Verification criterion:** `app/globals.css` declares both tokens (sourced from Blok registry or aliased with inline comment); POC clickdummy renders without missing-variable warnings in browser console. Runtime resolution verified indirectly by T038 / T039 contrast assertions.

**Provenance / fixtures:** Blok theme registry (run `sitecore:blok-theming` skill to confirm canonical values).

**Runtime contrast check:** N/A at this task; downstream T038 / T039 / T040 / T041 enforce.

**Acceptance gate:** R-S4 (token gaps); UI § 4.7.3.

---

### T004 — Create export module directory + `schema-version.ts` SoT

**Test type:** audit (single-constant declaration; no behavioral test).

**Verification criterion:** file exports exactly `ATLAS_EXPORT_SCHEMA_VERSION = 1 as const`; comment block cites ADR-0019 and bump rules. Behavior verified at use-sites: T012 (header-builder) imports the constant and asserts `1`; T043 grep audit confirms single declaration.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** IS-13 / DoD-7 (single source of truth — enforced by T043).

---

### T005 — `requireTenantIdentity` resolver (ADR-0020) — GREEN

**Test type:** unit (GREEN; depends on T006 RED).

**Scenarios:** see T006.

**Provenance / fixtures:** see T006.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0020; AC-1.4 (tenant-name fallback canonicalized at the resolver layer); FR-3 / FR-9.

---

### T006 — RED unit tests for `requireTenantIdentity`

**Test type:** unit.

**Scenarios:**
- **Happy path** — `requireTenantIdentity({ resourceAccess: [{ resourceId: 'r1', tenantId: 'abc1234567', tenantName: 'Acme', context: { live: 'L', preview: 'P' } }], ... })` → `{ tenantId: 'abc1234567', tenantName: 'Acme' }`. *(suggested file: `core/__tests__/tenant-identity.test.ts`)*
- **Missing tenant name** — `tenantName: undefined` → `{ tenantId, tenantName: null }`. NOT the fallback string.
- **Empty tenant name** — `tenantName: ''` → `{ tenantId, tenantName: null }`.
- **Null context** — `requireTenantIdentity(null)` throws `AtlasNoContextError`.
- **Empty resourceAccess** — `{ resourceAccess: [] }` throws `AtlasNoContextError`.
- **Missing tenantId** — `{ resourceAccess: [{ tenantId: '' }] }` throws `AtlasNoContextError`.
- **Error class identity** — the thrown `AtlasNoContextError` instance is the same class re-exported from `core/context-resolver`.

**Provenance / fixtures:** `// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79, 128-146` at file top. Fixture matches `ApplicationContext` shape exactly.

**Runtime contrast check:** N/A (pure function, no DOM).

**Acceptance gate:** ADR-0020 + DoD on tenant-name fallback (AC-1.4).

---

### T007 — Extend telemetry kinds (GREEN)

**Test type:** unit (GREEN; depends on T008 RED).

**Scenarios:** see T008.

**Provenance / fixtures:** N/A (telemetry kinds are project-internal; no SDK fixture).

**Runtime contrast check:** N/A.

**Acceptance gate:** FR-9 + ADR-0013 (telemetry stays in-iframe).

---

### T008 — RED unit tests for new telemetry event kinds

**Test type:** unit.

**Scenarios:**
- **Buffer attempt event** — `track({ kind: 'export_attempt', surface: 'widget', format: 'json', atlasSize: 12345 })` is buffered; `getBuffer()` returns it. *(suggested file: `core/__tests__/telemetry.test.ts`)*
- **Buffer fail event** — `track({ kind: 'export_fail', surface: 'panel', format: 'csv', errorCode: 'sandbox_blocked_download' })` is buffered with errorCode preserved.
- **FIFO ordering** — three events tracked in order; `getBuffer()` returns them in same order.
- **Console mirror** — `vi.spyOn(console, 'info')` captures `[CUA]` + payload after each `track()`.
- **Type conformance** — `track({ kind: 'export_attempt', ... })` typechecks (parity with `core/__tests__/telemetry-conformance.test.ts` pattern).

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** FR-9 / NFR-6.2 + ADR-0013.

---

### T009 — `SurfaceContext` type + `cloneSurfaceContext` (GREEN)

**Test type:** unit (GREEN; depends on T010 RED).

**Scenarios:** see T010.

**Provenance / fixtures:** N/A (project-internal type).

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0016 (purity contract — clone enables click-time snapshot).

---

### T010 — RED unit tests for `surface-context.ts`

**Test type:** unit.

**Scenarios:**
- **Reference identity** — `cloneSurfaceContext(ctx) !== ctx` AND structurally equal. *(suggested file: `core/atlas/export/__tests__/surface-context.test.ts`)*
- **Array independence** — mutating `clone.languagesScanned.push('xx')` does NOT affect `ctx.languagesScanned.length`.
- **Widget round-trip** — widget context (no `panelPage`) → `cloneSurfaceContext` → assertion-equal.
- **Panel round-trip** — panel context (with `panelPage`) → clone → `panelPage` deeply equal.
- **Deep partial-info clone** — mutating `clone.partialInfo.cancelReason` does NOT affect `ctx.partialInfo.cancelReason`.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0016 + AC-2.7 (mid-scan navigation contract — clone load-bearing).

---

### T011 — Header builder (GREEN)

**Test type:** unit (GREEN; depends on T012 RED).

**Scenarios:** see T012.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** § 10.1 declared field order; IS-13 (schema constant import); IS-14 (deterministic field order).

---

### T012 — RED unit tests for `header-builder.ts`

**Test type:** unit.

**Scenarios:**
- **Widget surface field** — `header.surface === 'widget'`; no panel-specific fields. *(suggested file: `core/atlas/export/__tests__/header-builder.test.ts`)*
- **Panel surface field** — `header.surface === 'panel'`; header itself surface-agnostic — caller appends body.
- **Partial flag** — `is_partial: true` produces populated `partial_info` object (AC-1.6).
- **Byte-identical determinism** — same ctx + same `exportedAt` produces byte-identical `JSON.stringify(header)` (DoD-3 prerequisite).
- **Null tenant_name** — when `ctx.tenant.tenantName === null`, header carries `tenant.tenant_name: null` (NOT fallback string).
- **Field order** — `Object.keys(JSON.parse(JSON.stringify(header)))` exactly matches the § 10.1 declared order array.
- **Schema constant import** — `header.atlas_export_schema_version === 1` and is sourced from `import { ATLAS_EXPORT_SCHEMA_VERSION }` (IS-13).

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** § 10.1 + ADR-0019 + AC-1.4 (null fallback at header layer).

---

### T013 — Filename builder (GREEN)

**Test type:** unit (GREEN; depends on T014 RED).

**Scenarios:** see T014.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** FR-6 / § 9.4 / IS-17 / ADR-0020 (canonical fallback).

---

### T014 — RED unit tests for `filename-builder.ts`

**Test type:** unit.

**Scenarios:**
- **Widget all-collections** — `atlas-acme-widget-all-collections-20260503T101441Z.json`. *(suggested file: `core/atlas/export/__tests__/filename-builder.test.ts`)*
- **Widget collection scope (IS-17)** — name + id → `atlas-acme-widget-marketing-3a8f2bc-...json`.
- **Tenant fallback** — name missing → `atlas-tenant-abcd123-widget-all-collections-...json`.
- **Panel page name present** — `atlas-acme-panel-home-page-...html`.
- **Panel page name missing** — `atlas-acme-panel-page-9f8e7d6-...html`.
- **Page-name truncation** — 80-char page name → 60-char truncate + `-${pageId.slice(-7)}` suffix.
- **Total length cap** — very-long inputs always produce ≤ 200-char filename.
- **ISO compact** — timestamp segment `YYYYMMDDTHHMMSSZ`, no `:` or `-` inside.
- **Format extension switch** — `.json` / `.csv` / `.html`.
- **IS-17 collision** — two collections with identical display names produce different filenames (collision suffix from `collectionId.slice(-7)`).

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** FR-6 / § 9.4 / IS-17.

---

### T015 — Size estimator (GREEN)

**Test type:** unit (GREEN; depends on T016 RED).

**Scenarios:** see T016.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** UI § 4.2 size-tier table; A-UI-1 perf budget.

---

### T016 — RED unit tests for `size-estimator.ts`

**Test type:** unit.

**Scenarios:**
- **Empty atlas** — `0` bytes (or near); tier `none`. *(suggested file: `core/atlas/export/__tests__/size-estimator.test.ts`)*
- **Tiny fixture** — 1 KB JSON → tier `none`.
- **Mid fixture** — 7 MB → tier `muted`.
- **Large fixture** — 80 MB → tier `warning`.
- **Boundary precision** — 4.99 MB → `none`, 5.00 MB → `muted`, 49.99 MB → `muted`, 50.00 MB → `warning`.

**Provenance / fixtures:** N/A — synthetic JSON-stringifiable shape, NOT real 80 MB data.

**Runtime contrast check:** N/A.

**Acceptance gate:** UI § 4.2 size-tier table.

---

### T017 — `buildExport` (GREEN)

**Test type:** unit (GREEN; depends on T018 RED).

**Scenarios:** see T018.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0016 purity contract; DoD-3 byte-identity prerequisite.

---

### T018 — RED unit tests for `build-export.ts`

**Test type:** unit.

**Scenarios:**
- **Format dispatch** — JSON → `formats/json` adapter; CSV → `formats/csv`; HTML → `formats/html`. Use `vi.mock('@/core/atlas/export/formats/json', ...)` etc. *(suggested file: `core/atlas/export/__tests__/build-export.test.ts`)*
- **Filename matches format** — returned `filename` ends in correct extension.
- **MIME on Blob** — `blob.type` matches the format MIME.
- **Singleton-read prohibition (ADR-0016)** — `vi.spyOn` on `@/core/atlas-store`'s `getAtlasState` confirms zero calls during `buildExport` invocation.
- **No `URL.createObjectURL` in buildExport** — `vi.spyOn(URL, 'createObjectURL')` confirms zero calls (trigger's job, not buildExport's).
- **Byte-identity** — identical inputs produce Blob bodies with identical `.text()` (DoD-3 / AC-4.4 prereq at orchestration layer).

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0016 + DoD-3.

---

### T019 — JSON adapter (GREEN)

**Test type:** unit (GREEN; depends on T020 RED).

**Scenarios:** see T020.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** § 10.1 schema; IS-13; IS-14; IS-18; AC-2.5; AC-4.4 prereq.

---

### T020 — RED unit tests for JSON adapter

**Test type:** unit.

**Scenarios:**
- **Renderings sorted by ID** — IS-14. *(suggested file: `core/atlas/export/__tests__/json.test.ts`)*
- **Pages sorted by page_id** — IS-14.
- **Datasources sorted by datasource_id** — IS-14.
- **Panel body shape** — `body.page` + `body.renderings[]` with `cross_tenant_pages[]` sorted.
- **Partial flag** — `is_partial: true` produces populated `partial_info` (AC-1.6).
- **Null tenant_name** — `tenant.tenant_name: null` in JSON when SDK lacked name.
- **Skipped pages sorted** — `skipped_pages[]` sorted by `page_id`.
- **Empty atlas (IS-18)** — `body.renderings: []` + populated header.
- **Zero-rendering panel page (AC-2.5)** — `body.renderings: []` and panel page metadata still present.
- **Schema constant** — `atlas_export_schema_version: 1` from imported constant.
- **Byte-identical** — re-export same inputs → same JSON string (AC-4.4 prereq).
- **Top-level field order** — `format: 'json'` field at documented position; `Object.keys(parsed)` matches § 10.1 declared order.
- **IS-17 visible at JSON layer** — two collections same name, different IDs, both present and distinguishable in `body.collections[]`.

**Provenance / fixtures:** N/A (JSON adapter is pure-data; atlas fixtures are project-internal).

**Runtime contrast check:** N/A.

**Acceptance gate:** § 10.1 + IS-13/14/17/18 + AC-1.4/1.6/2.5/4.4 + DoD-3/8.

---

### T021 — CSV adapter (GREEN)

**Test type:** unit (GREEN; depends on T022 RED).

**Scenarios:** see T022.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** § 10.2 schema; R4 (formula injection); IS-18; AC-4.4 prereq.

---

### T022 — RED unit tests for CSV adapter

**Test type:** unit.

**Scenarios:**
- **Header block** — widget produces 9 `#`-prefixed lines (10 with skipped footer). *(suggested file: `core/atlas/export/__tests__/csv.test.ts`)*
- **Widget column order** — exactly matches § 10.2 widget table.
- **Panel column order** — exactly matches § 10.2 panel table.
- **RFC 4180 — comma quoting** — `Foo, Bar` field wraps in `"..."`.
- **RFC 4180 — quote doubling** — `Foo"Bar` field becomes `"Foo""Bar"`.
- **RFC 4180 — newline quoting** — multi-line field wraps.
- **R4 — formula `=`** — `=SUM(...)` field gets leading `'`.
- **R4 — formula `@`** — `@cmd` field gets leading `'`.
- **R4 — formula `+`** — `+1` field gets leading `'`.
- **R4 — formula `-`** — `-1` field gets leading `'`.
- **Tenant fallback in `# Tenant:`** — when null name, line emits `tenant-${tenantId.slice(-7)}` (ADR-0020 fallback at CSV layer).
- **Schema-version line** — `# Schema version: 1` from imported constant.
- **No BOM** — first byte is not `0xFEFF`.
- **Empty atlas (IS-18)** — header block + zero data rows.
- **Skipped footer** — `# skipped_pages: 3` when 3 skipped.
- **R4 regression — number `0`** — numeric `0` field NOT prefixed with `'` (only string-typed fields with leading `=`/`+`/`-`/`@` are guarded).
- **R4 regression — numeric `-1`** — numeric value `-1` not prefixed with `'`.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** § 10.2 + R4 + IS-13/18 + AC-4.4.

---

### T023 — HTML adapter (GREEN)

**Test type:** unit (GREEN; depends on T024 RED).

**Scenarios:** see T024.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A at the adapter layer (string output); print-stylesheet visual contrast verified by T047.

**Acceptance gate:** § 10.3 + § 4.7 print stylesheet; R6 (XSS); AC-3.2 (no remote); IS-18; AC-4.4 prereq.

---

### T024 — RED unit tests for HTML adapter

**Test type:** unit.

**Scenarios:**
- **Doctype + closing** — output starts `<!doctype html>`, ends `</html>`. *(suggested file: `core/atlas/export/__tests__/html.test.ts`)*
- **Title** — `<title>` includes tenant + surface.
- **Summary `<dl>`** — all required `<dt>/<dd>` pairs present (Tenant, Surface, Scope, Languages scanned, Page (panel only), Scan timestamp, Exported at, Sites, Pages, Renderings, Datasources, Partial scan when partial).
- **R6 — `<script>` escape** — `<script>alert(1)</script>` → `&lt;script&gt;alert(1)&lt;/script&gt;`.
- **R6 — `&` escape** — `&amp;`.
- **R6 — `'` escape** — `&#39;`.
- **R6 — `"` escape** — `&quot;`.
- **R6 — `>` escape** — `&gt;`.
- **Print `@media`** — `<style>` contains `@media print`.
- **Print thead** — `thead { display: table-header-group }`.
- **Print partial badge** — `print-color-adjust: exact` on `.badge-partial`.
- **Partial badge element** — `<span class="badge-partial">Partial scan — N of M pages</span>` (AC-1.6).
- **Empty-state element** — `<p class="empty-state if-empty">(No renderings found.)</p>` (IS-18 / DoD-8).
- **Skipped-pages element** — `<p class="if-skipped">N pages skipped: ...</p>`.
- **Tenant fallback in `<dd>`** — `tenant-${tenantId.slice(-7)}` when SDK null.
- **Footer text** — `<footer>` says `Schema version 1 — generated by Component Usage Atlas.`
- **No `<script>`** — output has zero `<script>` elements (NFR-4.3).
- **No remote URLs** — no `http://` / `https://` in `<link>`, `<script>`, `@import` (AC-3.2).
- **R6 — attribute-context XSS** — display name `</a><script>` interpolated into any attribute (data-*, id, etc.) is HTML-escaped, NOT rendered as raw markup.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A at the adapter layer; T047 verifies at print preview.

**Acceptance gate:** § 10.3 + § 4.7 + R6 + AC-3.2 + IS-18 + DoD-8.

---

### T025 — `triggerDownload` (GREEN)

**Test type:** unit (GREEN; depends on T026 RED).

**Scenarios:** see T026.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0017 primary mechanism; AC-5.3 (sandbox-blocked code).

---

### T026 — RED unit tests for `triggerDownload`

**Test type:** unit.

**Scenarios:**
- **Happy path** — anchor created, appended, clicked, removed; `revokeObjectURL` called; outcome `started`. *(suggested file: `core/atlas/export/download/__tests__/trigger-download.test.ts`)*
- **`createObjectURL` throws** — outcome `failed`, errorCode `blob_construction_failed`.
- **`a.click()` throws** — cleanup happens, outcome `failed`, errorCode `sandbox_blocked_download` (AC-5.3).
- **Anchor parented to body** — appended, not detached.
- **Anchor display none** — `a.style.display === 'none'`.
- **Microtask cleanup** — anchor present synchronously after `await triggerDownload(...)` resolves; gone after `await Promise.resolve()`.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0017 + AC-5.3.

---

### T027 — `detectFailure` (GREEN)

**Test type:** unit (GREEN; depends on T028 RED).

**Scenarios:** see T028.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0017 detection contract.

---

### T028 — RED unit tests for `detectFailure`

**Test type:** unit (with `vi.useFakeTimers()`).

**Scenarios:**
- **Short-circuit on failed trigger** — outcome already `failed` → returns `{ result: 'fail', errorCode: 'sandbox_blocked_download' }`. *(suggested file: `core/atlas/export/download/__tests__/detect-failure.test.ts`)*
- **5 s success** — outcome `started`; advance 5000 ms; resolves `success`.
- **4999 ms pending** — promise still pending at 4999 ms (verify via Promise.race against `setTimeout(resolve, 0)`).
- **errorCode propagation** — fail-path errorCode preserved.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0017 detection contract; FR-9 attempt:success ratio prerequisite.

---

### T029 — `fallbackClipboard` (GREEN)

**Test type:** unit (GREEN; depends on T030 RED).

**Scenarios:** see T030.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0017 F2 fallback (engineered only if T001 forks).

---

### T030 — RED unit tests for `fallbackClipboard`

**Test type:** unit.

**Scenarios:**
- **Success path** — `writeText` resolves → `{ result: 'success' }`. *(suggested file: `core/atlas/export/download/__tests__/fallback-clipboard.test.ts`)*
- **Failure path** — `writeText` rejects → `{ result: 'fail', errorCode: 'clipboard_blocked' }`.
- **Large string** — 10 MB JSON string round-trips with no truncation.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0017 F2.

---

### T031 — Telemetry emit helpers

**Test type:** non-TDD (thin wrappers; behavior covered by T040 / T041).

**Scenarios:** N/A — covered indirectly at integration layer.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** FR-9 / NFR-6.2 emission shape verified at T040 / T041 integration tests.

---

### T032 — `<DownloadButton>` (GREEN)

**Test type:** UI (GREEN; depends on T038 RED).

**Scenarios:** see T038.

**Provenance / fixtures:** N/A (presentation only; props are project-internal).

**Runtime contrast check:** see T038 case (j).

**Acceptance gate:** UI § 4.1; NFR-3.3 (a11y); A-UI-4 (refresh-with-prior treatment).

---

### T033 — `<FormatPickerMenu>` (GREEN)

**Test type:** UI (GREEN; depends on T039 RED).

**Scenarios:** see T039.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** see T039 case (j).

**Acceptance gate:** UI § 4.2.

---

### T034 — `<WhyPopover>`

**Test type:** UI (non-TDD; behavior covered by T040 / T041 sandbox-blocked branches).

**Scenarios:** N/A directly — the popover is rendered by the failure toast in the integration tests; per-error-code copy is asserted from the toast → popover render.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** if popover surfaces visual regression in /test or /code-review, add a runtime contrast assertion against `bg-popover` foreground/background.

**Acceptance gate:** UI § 4.6.

---

### T035 — Toast helpers

**Test type:** non-TDD (delegating wrappers; behavior covered by T040 / T041).

**Scenarios:** N/A — integration tests assert toast invocation paths.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A directly; T040 case (g) sandbox-blocked toast contrast asserted via `getComputedStyle()` if visual regression risk surfaces.

**Acceptance gate:** UI § 4.3 / 4.4 / 4.5.

---

### T036 — Wire into `widget-surface.tsx` (GREEN)

**Test type:** integration (GREEN; depends on T040 RED).

**Scenarios:** see T040.

**Provenance / fixtures:** see T040.

**Runtime contrast check:** delegated to T038 / T039 component-level contrast assertions.

**Acceptance gate:** AC-1.1 (refresh-with-prior); AC-1.6 (partial); FR-1 / FR-2 / FR-9 integration; UI § 4.8 (insertion point).

---

### T037 — Wire into `panel-surface.tsx` (GREEN)

**Test type:** integration (GREEN; depends on T041 RED).

**Scenarios:** see T041.

**Provenance / fixtures:** see T041.

**Runtime contrast check:** delegated to T038 / T039.

**Acceptance gate:** AC-2.5 (zero-rendering); AC-2.7 (mid-scan navigation); FR-1 / FR-2 / FR-9 integration; UI § 4.8.

---

### T038 — RED component tests for `<DownloadButton>`

**Test type:** UI (component test).

**Scenarios:**
- **Widget label** — `Download` label rendered at desktop width. *(suggested file: `components/atlas/__tests__/download-button.test.tsx`)*
- **Panel icon-only** — panel variant icon-only with tooltip.
- **`disabled-no-data` tooltip** — `No data — start a scan first.`
- **`disabled-scan-in-progress-no-prior` tooltip** — `Scan in progress — finish the scan to download.`
- **`disabled-panel-loading` tooltip** — `Loading current page…`
- **`constructing` spinner** — icon swapped for inline spinner.
- **`aria-label`** — `Download snapshot` always present.
- **`aria-describedby` on disabled** — points to visually-hidden `<span>` with reason copy (NFR-3.3).
- **Keyboard reach** — Tab focuses trigger; Enter opens menu; Escape closes.
- **Runtime contrast (per § 9.3)** — when state === `enabled`, `getComputedStyle()` of trigger shows resolved foreground:background contrast ≥ 4.5:1 (WCAG AA). Use `@/lib/contrast.ts` helper.
- **Tab order** — Download trigger DOM-precedes Refresh button (UI § 4.8 — data-out before data-mutation).

**Provenance / fixtures:** N/A — presentation component, no SDK fixture.

**Runtime contrast check:** YES — case (j) above.

**Acceptance gate:** UI § 4.1; NFR-3 (a11y); UI § 4.8 (tab order).

---

### T039 — RED component tests for `<FormatPickerMenu>`

**Test type:** UI (component test).

**Scenarios:**
- **JSON/CSV/HTML order** — three items in fixed order. *(suggested file: `components/atlas/__tests__/format-picker-menu.test.tsx`)*
- **JSON anatomy** — `mdiCodeBraces`, title `JSON`, suffix `.json`, description `Full data, machine-readable`.
- **CSV anatomy** — `mdiTable`, title `CSV`, `.csv`, `Lite data, spreadsheet-friendly`.
- **HTML anatomy** — `mdiFileDocumentOutline`, title `HTML`, `.html`, `Lite data, printable / shareable`.
- **Tier `none`** — `<5 MB` → no annotation rendered.
- **Tier `muted`** — 5–50 MB → ` · ~N MB` muted annotation.
- **Tier `warning`** — `≥50 MB` → warning glyph + ` · ~N MB — Large, may take a moment`.
- **`onSelect` fires** — click + Enter both fire `onSelect(format)`.
- **Menu width** — widget 320 px, panel 280 px.
- **Runtime contrast (per § 9.3)** — warning-tier annotation `text-warning-fg` foreground vs menu-item background contrast ≥ 4.5:1.
- **Keyboard nav (WCAG)** — arrow-down between items, arrow-up reverse, Enter selects, Escape closes.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** YES — case (j).

**Acceptance gate:** UI § 4.2; NFR-3 (a11y).

---

### T040 — RED integration test for widget surface end-to-end

**Test type:** integration.

**Scenarios:**
- **JSON download** — filename matches pattern; Blob body parses; `atlas_export_schema_version === 1`; `surface === 'widget'`; renderings sorted. *(suggested file: `components/atlas/__tests__/widget-surface-export.test.tsx`)*
- **CSV download** — filename `.csv`; body has `# Schema version: 1`; column header row; rows sorted by `rendering_id`.
- **HTML download** — filename `.html`; body starts `<!doctype html>`; print stylesheet present; display names HTML-escaped.
- **Telemetry** — `export_attempt` + `export_success` in `getBuffer()` after each download with `surface: 'widget'`.
- **Empty atlas (DoD-8 / IS-18)** — valid file produced; success toast says `... — empty atlas.`
- **Refresh-with-prior (FR-1.2 / AC-1.1)** — button stays enabled DURING refresh; resolved Blob carries the PREVIOUS atlas's `scan_timestamp`.
- **Sandbox-blocked path (AC-5.3 / R1)** — simulate `triggerDownload` returning `{ outcome: 'failed', errorCode: 'sandbox_blocked_download' }` → sandbox-blocked toast renders with `[Retry, Copy JSON, Why?]`; `emitExportFail` fired with `errorCode: 'sandbox_blocked_download'`.
- **SDK fixture provenance** — fixture file carries `// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79, 128-146` at top.

**Provenance / fixtures:** SDK fixture for `application.context.resourceAccess[0]` MUST cite `node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79, 128-146`.

**Runtime contrast check:** delegated to T038 / T039.

**Acceptance gate:** AC-1.1 / 1.6 / 4.1 / 5.3; FR-1 / 2 / 9; DoD-8 / 9; IS-18.

---

### T041 — RED integration test for panel surface end-to-end + AC-2.7

**Test type:** integration.

**Scenarios:**
- **Panel JSON download** — `body.page` populated; `body.renderings[]` includes `cross_tenant_pages[]`. *(suggested file: `components/atlas/__tests__/panel-surface-export.test.tsx`)*
- **Panel CSV/HTML lite columns** — row count equals page renderings.
- **Mid-scan navigation (AC-2.7)** — click Download → JSON → fire async event changing `activePageId` mid-flight → assert resolved Blob carries the CLICK-TIME page (`body.page.page_id` matches old, not new).
- **Zero-rendering page (AC-2.5)** — `body.renderings: []`; success toast (per UI § 11.7).
- **Telemetry** — `surface: 'panel'` on attempt + success events.
- **Disabled-panel-loading state** — while per-page fetch in flight, button renders `disabled-panel-loading` with `Loading current page…` tooltip; menu does not open on click.
- **SDK fixture provenance** — fixture comment present.

**Provenance / fixtures:** SDK fixture for `application.context.resourceAccess[0]` cites `node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79, 128-146`.

**Runtime contrast check:** delegated to T038 / T039.

**Acceptance gate:** AC-2.5 / 2.7 / 4.1 / 5.3; FR-1 / 2 / 9; ADR-0016 (click-time clone load-bearing).

---

### T042 — Schema-stability re-export test (DoD-3 / AC-4.4)

**Test type:** integration / regression.

**Scenarios:**
- **JSON byte-identity** — same inputs, two `exportedAt` values → bodies differ only on `exported_at` line; `diff` after stripping it is empty. *(suggested file: `core/atlas/export/__tests__/schema-stability.test.ts`)*
- **CSV byte-identity** — same; `Exported at:` line is the only delta.
- **HTML byte-identity** — same; `<dt>Exported at</dt>` `<dd>` value the only delta.
- **Field order identical** — `Object.keys(JSON.parse(body))` array equals across two runs (JSON only).
- **Sort order identical** — sample renderings + pages + datasources arrays equal across two runs.
- **Shuffled-input determinism** — feeding the atlas with shuffled input arrays produces identical sorted output (IS-14).

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** DoD-3 + AC-4.4 + IS-14.

---

### T043 — Schema-version grep audit (DoD-7)

**Test type:** audit (CI guard).

**Verification criterion:** `scripts/audit-schema-version.mjs` exits non-zero when any file outside `core/atlas/export/schema-version.ts` (excluding `__tests__/`) declares a literal `1` for the schema version OR contains the constant name `ATLAS_EXPORT_SCHEMA_VERSION` followed by `=` (only the SoT file may declare; everywhere else must be import-only). Wired into `npm run ci`. Synthetic violation: temporarily declare `const SCHEMA = 1;` in another file → expect non-zero exit.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** DoD-7 / IS-13.

---

### T044 — Bundle-size audit (DoD-5 / NFR-1.4)

**Test type:** manual-gate (CI-adjacent build delta).

**Verification criterion:** delta ≤ 20 KB gzipped between PRD-000 baseline `next build` chunk sizes and the post-PRD-001 build. Friction log `bundle_smoke.final` populated; manifest `smoke_outcomes.bundle_delta` set; `verdict: 'pass' | 'fail'`. If fail, /ship blocked; /architect amendment task opened.

**Provenance / fixtures:** N/A — uses real build output.

**Runtime contrast check:** N/A.

**Acceptance gate:** DoD-5 / NFR-1.4.

---

### T045 — Antimetric guard wiring (DoD-6)

**Test type:** audit (CI guard).

**Verification criterion:** `scripts/check-antimetrics.mjs` extended with three new forbidden patterns (`downloads per minute` family, `total bytes exported` family, `format diversity per editor` family). Audit passes on post-implementation tree; fails when synthetic violation introduced.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** DoD-6.

---

### T046 — Telemetry distribution check (DoD-9)

**Test type:** smoke / friction-log assertion.

**Verification criterion:** at end of /test smoke pass, `friction-log-*.md` contains `export_telemetry_smoke` table with attempt count per surface+format, success count, fail count per errorCode, attempt:success ratio. If any `sandbox_blocked_download` count > 0 in smoke pass, raise as P0 finding (R1).

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** DoD-9 / NFR-6.2.

---

### T047 — HTML print preview manual gate (DoD-4)

**Test type:** manual-gate.

**Verification criterion:** export a representative HTML on widget surface (≥500 pages, ≥2 sites), open in latest Chromium + Firefox + (Safari or skip-with-note) at A4 + Letter paper size, save as PDF. Verify per-browser per-paper-size: (a) thead repeats per page; (b) rows do not split across pages; (c) partial-scan badge keeps background color (`-webkit-print-color-adjust: exact`); (d) typography legible at 11 pt body / 10 pt table; (e) zero remote network requests fire (DevTools network tab). UI Designer signs off on visual parity with `pocs/poc-v1/html-output-sample.html`. Friction log `html_print_smoke` populated.

**Provenance / fixtures:** N/A — uses real generated HTML.

**Runtime contrast check:** YES — verified visually at print preview (partial-scan badge, footer text colors).

**Acceptance gate:** DoD-4 / AC-3.3 / AC-3.4.

---

### T048 — Host-frame visual smoke against POC clickdummy

**Test type:** manual-gate (visual regression).

**Verification criterion:** invoke `sitecore:marketplace-sdk-host-frame-testing` skill with user-supplied host URL + POC clickdummy at `pocs/poc-v1/`. Compare clipped host-frame screenshots vs POC for: widget header default (`widget.html`); widget format-picker open at 3 size tiers (S2/S2b/S2c); panel header + format picker (S4/S5); success toast (S6); sandbox-blocked toast (S8) IF spike forced this code path; Why? popover (S9) IF spike forced. Drift > 4 px or color delta > 3 ΔE → finding raised. POC drift findings route back through /architect — do NOT silently re-baseline. Auth interactive only — never script SSO. Cross-origin DOM read restricted — fall back to visual diff. Friction log `host_frame_smoke` populated.

**Provenance / fixtures:** Live host URL + POC `pocs/poc-v1/`.

**Runtime contrast check:** delegated — visual inspection at host frame + POC parity.

**Acceptance gate:** UI parity gate; per `sitecore:marketplace-sdk-host-frame-testing` invariants.

---

### T049 — Empty-atlas + zero-rendering-page integration test (DoD-8 / IS-18 / AC-2.5)

**Test type:** integration.

**Scenarios:**
- **Empty atlas JSON** — `body.renderings: []`; populated header (IS-18). *(suggested file: `core/atlas/export/__tests__/empty-state.test.ts`)*
- **Empty atlas CSV** — header block + column header + zero data rows.
- **Empty atlas HTML** — `<p class="empty-state if-empty">(No renderings found.)</p>`.
- **Zero-rendering panel page (AC-2.5)** — `body.renderings: []`; panel page metadata still present.
- **Widget success toast on empty** — `... — empty atlas.`
- **Panel success toast on zero-rendering page** — per UI § 11.7.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** DoD-8 / IS-18 / AC-2.5.

---

### T050 — CHANGELOG schema-version line

**Test type:** manual-gate (documentation discipline per ADR-0019).

**Verification criterion:** `CHANGELOG.md` under v1.0 / PRD-001 section contains: `Schema: atlas export schema introduced at v1 — see ADR-0019.` /document agent (09) downstream picks this up.

**Provenance / fixtures:** N/A.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0019 CHANGELOG discipline.

---

### T051 — RED unit tests for `useSaveExport` hook

**Test type:** unit (with `vi.useFakeTimers()` for the 1.4 s revert window).

**Scenarios:**
- **Initial idle status** — `status === 'idle'` at mount. *(suggested file: `core/atlas/export/hooks/__tests__/use-save-export.test.tsx`)*
- **Sandbox unsupported (current)** — `save({ blob, filename })` flips to `'saving'` then to `'unsupported'` (defer detection-policy specifics to T052).
- **Sandbox supported (future-state simulation)** — stub the feature-detection probe to indicate downloads are supported; assert `status` flips `'saving' → 'saved' → 'idle'` after 1.4 s revert window (mirror pageshot `use-download-image.ts:115-121`).
- **Unmount cleanup** — unmounting during the revert window cancels the timer.
- **Idempotency** — concurrent `save()` calls during the `'saving'` window are no-ops.

**Provenance / fixtures:** Reference implementation at `products/pageshot/site/next-app/components/use-download-image.ts`.

**Runtime contrast check:** N/A (pure hook).

**Acceptance gate:** ADR-0021 § The three actions / FR-10.

---

### T052 — `useSaveExport` hook (GREEN)

**Test type:** unit (GREEN; depends on T051 RED).

**Scenarios:** see T051.

**Provenance / fixtures:** N/A. Cite `products/pageshot/site/next-app/components/use-download-image.ts:99-110` in leading comment.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0017 § Primary mechanism + ADR-0021 § The three actions / FR-10.

---

### T053 — RED unit tests for `useOpenExport` hook

**Test type:** unit (with `vi.useFakeTimers()` for the 1.4 s revert + 60 s revoke).

**Scenarios:**
- **Initial idle status** — `status === 'idle'` at mount. *(suggested file: `core/atlas/export/hooks/__tests__/use-open-export.test.tsx`)*
- **Open success** — `open()` flips to `'opening'`; `vi.spyOn(window, 'open')` returns a non-null mock window; status flips to `'opened'` then back to `'idle'` after 1.4 s.
- **Open blocked (popup blocker)** — `window.open` returns `null` → status flips to `'blocked'` (sticky for the session); subsequent `open()` calls are no-ops.
- **60 s revoke deferral** — `URL.revokeObjectURL` not called until `vi.advanceTimersByTime(60_000)`.
- **Idempotency** — concurrent `open()` calls during the `'opening'` window are no-ops.

**Provenance / fixtures:** Reference implementation at `products/pageshot/site/next-app/components/use-open-image.ts:62`.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0021 § The three actions / FR-11.

---

### T054 — `useOpenExport` hook (GREEN)

**Test type:** unit (GREEN; depends on T053 RED).

**Scenarios:** see T053.

**Provenance / fixtures:** N/A. Cite `products/pageshot/site/next-app/components/use-open-image.ts:62` in leading comment.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0021 § The three actions / FR-11.

---

### T055 — RED unit tests for `useCopyExport` hook

**Test type:** unit (with `vi.useFakeTimers()` for the 1.8 s revert window).

**Scenarios:**
- **Text path** (`mode: 'text'`) — `status` flips `'idle' → 'copying' → 'copied' → 'idle'`; `navigator.clipboard.writeText` called with the text. *(suggested file: `core/atlas/export/hooks/__tests__/use-copy-export.test.tsx`)*
- **HTML path** (`mode: 'html'`) — `navigator.clipboard.write` called with one `ClipboardItem` carrying `'text/html'` + `'text/plain'` peer entries.
- **Capability detection** — `available: false` when text path lacks `navigator.clipboard.writeText` or html path lacks `ClipboardItem`.
- **Sticky `'denied'`** — first `copy()` rejection → status `'denied'`; second `copy()` call is a no-op (no further attempt at `clipboard.write`).
- **Unsupported initial status** — `status === 'unsupported'` at mount when `available === false`.
- **Idempotency** — concurrent `copy()` calls during the `'copying'` window are no-ops.

**Provenance / fixtures:** Reference implementation at `products/pageshot/site/next-app/components/use-copy-image.ts:128-148` (note divergence: pageshot uses `image/png` ClipboardItem; atlas uses `text/*`). SDK fixture provenance comment is **NOT required** (clipboard is a browser API, not an SDK).

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0021 § The three actions / FR-12.

---

### T056 — `useCopyExport` hook (GREEN)

**Test type:** unit (GREEN; depends on T055 RED).

**Scenarios:** see T055.

**Provenance / fixtures:** N/A. Cite `products/pageshot/site/next-app/components/use-copy-image.ts:128-148` in leading comment.

**Runtime contrast check:** N/A.

**Acceptance gate:** ADR-0021 § The three actions / FR-12.

---

## Handoff Metadata

- **Canonical run manifest:** `products/component-usage-atlas/project-planning/workflow/run-20260503T101441Z.json`
- **Source PRD:** `products/component-usage-atlas/project-planning/PRD/prd-001.md`
- **Source PRD-minimal:** `products/component-usage-atlas/project-planning/PRD/prd-minimal-001.md`
- **Source architecture:** ADRs only — minimal track (ADR-0001 through ADR-0020; ADRs 0015–0020 introduced by this PRD's run)
- **Source UI design:** `products/component-usage-atlas/project-planning/ui-design/ui-design-20260503T101441Z-v1.md`
- **Winning POC:** `products/component-usage-atlas/pocs/poc-v1/`
- **Recommended next command:** `/task-breakdown` step 2 — QA Specialist (07) enrichment (sections 9 + 10 + TDD Depends-on rewire)
- **Recommended next input file:** N/A — QA enriches this file in place; no separate qa-report.md on minimal track
