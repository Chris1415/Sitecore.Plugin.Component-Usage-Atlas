# Implementation Runbook — Atlas Snapshot Export (PRD-001)

---
document_type: implementation_runbook
artifact_name: implementation-runbook-20260503T101441Z.md
generated_at: 2026-05-03T14:30:00Z
run_manifest: products/component-usage-atlas/project-planning/workflow/run-20260503T101441Z.json
source_inputs:
  - products/component-usage-atlas/project-planning/PRD/prd-minimal-001.md
  - products/component-usage-atlas/project-planning/plans/task-breakdown-20260503T101441Z.md
  - products/component-usage-atlas/pocs/poc-v1/ (visual source of truth — clickdummy)
consumed_by:
  - Engineering team (Developer 08 sub-agents executing T001–T050)
next_input:
  - products/component-usage-atlas/site/ (implementation target directory)
---

## 1. Implementation Scope

**Atlas Snapshot Export** — adds JSON / CSV / HTML download from both atlas surfaces (Dashboard Widget + Page Context Panel). Feature is purely additive on the PRD-000 baseline: no new SDK calls, no new extension points, no backend, no Auth changes. Architecture 4a (iframe Mode A) unchanged.

50 tasks across 6 epics, TDD-style ordering enforced by QA Specialist 07:
- **E1 — Spike + foundation:** T001 (iframe-download verification spike), T002 (`@blok/sonner` install), T003 (token gaps), T004 (`schema-version.ts` SoT), T005-T008 (tenant-identity + telemetry — TDD pairs).
- **E2 — Pure construction core:** SurfaceContext, build-export, header-builder, filename-builder, size-estimator. All RED→GREEN paired.
- **E3 — Format adapters:** JSON, CSV, HTML adapters with inlined print stylesheet. Each ≤300 LOC (NFR-5.1). RED→GREEN paired.
- **E4 — Download trigger + failure detection:** Blob+anchor primary mechanism, 5s detection heuristic, optional clipboard F2 fallback (engineered only if T001 fails).
- **E5 — Surface integrations:** download-button, format-picker-menu, why-popover composites; widget-surface + panel-surface integrations.
- **E6 — Tests + verification:** integration tests, schema-stability re-export test (DoD-3 / AC-4.4), bundle-size audit (DoD-5), HTML print-preview manual gate (DoD-4), empty-state tests (DoD-8), telemetry distribution check (DoD-9), antimetric guard (DoD-6), host-frame visual smoke against pocs/poc-v1/.

## 2. Canonical Inputs

- **prd_minimal:** `products/component-usage-atlas/project-planning/PRD/prd-minimal-001.md` — Developer 08's primary scope/orientation.
- **Task breakdown (QA-enriched, TDD):** `products/component-usage-atlas/project-planning/plans/task-breakdown-20260503T101441Z.md` (2191 lines, 50 tasks, § 9 TDD contract, § 10 per-task tests).
- **qa_report:** `null` — minimal track; enriched task breakdown is the test contract.
- **Winning POC clickdummy:** `products/component-usage-atlas/pocs/poc-v1/` — Developer 08 may open `widget-menu-open.html`, `panel-menu-open.html`, `toast-failure-sandbox.html`, `popover-why-sandbox.html`, `html-output-sample.html`, `poc.css` as visual reference. When § 4c-4 text and clickdummy diverge on visual details, clickdummy wins.
- **Architecture artifact:** `null` — minimal-track planning; ADRs 0009/0010/0013/0015–0020 carry architectural decisions, restated as one-liners in § 4c-2 of the task breakdown.

## 3. Target Directory Decision

**Implementation target:** `products/component-usage-atlas/site/` (existing — PRD-000 lives here).

The export module will land at `products/component-usage-atlas/site/core/atlas/export/` (no `src/` prefix per project convention; sibling to existing `core/` business-logic modules). The `requireTenantIdentity` helper at `products/component-usage-atlas/site/core/tenant-identity.ts`.

Path-string drift in ADR-0019 + prd-minimal-001 (cite `src/atlas/export/...`) noted as **R-S2** in task breakdown § 7. ADR-0019 patch deferred to `/document` per Lead Developer recommendation.

## 4. Planned Delivery Order

Per task breakdown § 5, **TDD-rewired execution order** (T001 → T050 with 17 RED-GREEN pairs and 27 parallel groups; TDD style mandates sequential within pairs).

**Mode of execution:** Sequential per Implement command "When NOT to parallelize: task_breakdown_style is `tdd`". Team Lead spawns Developer 08 sub-agents in **batches** corresponding to the natural epic boundaries to manage context budget across multiple sessions:

| Batch | Tasks | Description |
|-------|-------|-------------|
| Spike | T001 | Iframe-download verification spike — local code prep by Developer; user manually deploys + clicks; results recorded in friction log. **Hard fork** — non-success on either extension point routes to F1/F2/F3 fallback engineering before any T002+ work. |
| Foundation | T002–T008 | Toast install, token gaps, schema-version SoT, tenant-identity (RED+GREEN), telemetry events (RED+GREEN). |
| Core construction | T009–T020 | SurfaceContext, header-builder, filename-builder, size-estimator, build-export — each as RED+GREEN pair. |
| Format adapters | T021–T028 | JSON/CSV/HTML adapters as RED+GREEN pairs. |
| Download mechanics | T029–T035 | Trigger-download, detect-failure (RED+GREEN), clipboard helper, popover, toast helpers. |
| Surface integrations | T036–T041 | Download-button + format-picker (RED+GREEN), widget integration, panel integration. |
| Verification | T042–T050 | Schema-stability test, DoD-7 grep audit, bundle-size audit, antimetric guard, telemetry distribution check, host-frame visual smoke, HTML print-preview manual gate, empty-state tests, full CI run. |

Actual execution sequence (with timing) is recorded below as batches complete.

### Execution log

| Timestamp | Batch | Outcome | Notes |
|-----------|-------|---------|-------|
| 2026-05-03T14:30:00Z | Setup | done | Branch `prd-001` verified. Runbook initialized. Manifest `status: implementing`. |
| 2026-05-03T14:35:00Z | Spike (T001 local prep) | in progress | Developer 08 spawned to add temporary fixture buttons. |
| _pending_ | Spike (T001 user verification) | pending | Awaiting user deploy + click + report. |
| _pending_ | Foundation (T002–T008) | pending | Gated on T001 success. |
| _pending_ | Core construction (T009–T020) | pending | |
| _pending_ | Format adapters (T021–T028) | pending | |
| _pending_ | Download mechanics (T029–T035) | pending | |
| _pending_ | Surface integrations (T036–T041) | pending | |
| _pending_ | Verification (T042–T050) | pending | |

## 5. Verification Checklist

Per task breakdown § 9 (TDD and quality contract) + § 10 (per-task test specs):

- [ ] **T001 spike** verified on both `xmc:dashboardblocks` and `xmc:pages:context-panel` — friction log `download_smoke` section populated; manifest `smoke_outcomes.download_spike` recorded.
- [ ] **All 17 RED-GREEN pairs** — RED test exists and fails before GREEN implementation lands; GREEN passes without test edit.
- [ ] **DoD-3** (re-export byte-identity) — T042.
- [ ] **DoD-5** (bundle delta ≤20 KB gzipped) — T044.
- [ ] **DoD-7** (`atlas_export_schema_version` single-source-of-truth grep audit) — T043.
- [ ] **DoD-8** (empty atlas + zero-rendering page produce valid files) — T049 + T020/T022/T024.
- [ ] **DoD-9** (telemetry distribution table) — T046.
- [ ] **Host-frame visual smoke** against `pocs/poc-v1/` — T048 (auth interactive, POC is first-run ground truth, no silent baseline promotion).
- [ ] **HTML print-preview manual gate** in Chromium + Firefox + Safari at A4 + Letter — T047 (DoD-4).
- [ ] **`npm run ci`** passes — final gate before declaring implementation complete.
- [ ] **Anti-metric guard wiring** — T045 (DoD-6).
- [ ] **Runtime contrast assertions** for token-painted components (per § 9.3 rule).
- [ ] **SDK fixture provenance comments** at the top of every fixture file touching `application.context` (per § 9.4 rule).

## 6. Risks To Watch During Implementation

From task breakdown § 7:

- **R-S1 — T001 spike fork.** If iframe sandbox blocks the Blob+anchor mechanism on either extension point, **HARD STOP** and route to ADR-0017 amendment + F1/F2/F3 fallback engineering. Do not proceed to T002+ on a failed spike.
- **R-S2 — ADR-0019 path-string drift.** ADR-0019 cites `src/atlas/export/schema-version.ts`; actual path is `core/atlas/export/schema-version.ts`. Defer ADR-0019 patch to `/document`.
- **R1 (PRD)** — Iframe sandbox blocks Blob mechanism (covered by T001 spike).
- **R2 (PRD)** — Tenant name not exposed in `application.context.resourceAccess[0].tenantName`. Filename-builder fallback `tenant-${last-7-of-tenantId}` per ADR-0020 / FR-6 / § 9.4.
- **R5 (PRD)** — Schema v1 turns out wrong shape — single-source-of-truth + bump rules in ADR-0019.
- **R6 (PRD)** — HTML XSS via display names — escape every interpolated string per FR-2.3 / NFR-4.3 (covered by T024/T025 tests).
- **R-S3 (new)** — Bundle delta exceeds 20 KB gzipped — measured at T044; if breached, narrow the format adapters before declaring implementation complete.

## 7. Completion Criteria

Implementation is complete when:

1. T001 spike returns `success` on both surfaces (or F1/F2/F3 fallback ships per ADR-0017 amendment).
2. All 50 tasks in § 5 Execution Order are checked off in the execution log table above.
3. `npm run ci` passes (lint + typecheck + test + build + audit:network + audit:anti-metric).
4. Bundle delta vs PRD-000 baseline is ≤20 KB gzipped.
5. Friction log `download_smoke` + `bundle_smoke` sections populated.
6. Manifest `status: implemented`, `implementation.status: completed`, `stage_history` carries an `implemented` entry.

## 8. What Needs To Be Tested (global testing runbook)

**Source:** Task breakdown § 9 (TDD contract) + § 10 (per-task tests). No standalone `qa-report.md` — enriched task breakdown is the test contract.

### Test commands (from `package.json`)

| Command | Purpose |
|---------|---------|
| `npm run test` | Vitest run (unit + integration + UI) |
| `npm run test:watch` | Vitest watch mode for TDD inner loop |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint 9 |
| `npm run build` | `next build` |
| `npm run audit:network` | Network audit (verifies no unexpected egress) |
| `npm run check:antimetrics` | Anti-metric guard (DoD-6) |
| `npm run ci` | Full CI: lint + typecheck + test + build + audit:network + audit:anti-metric |

### Test scope

**Unit tests** (per § 10 — Vitest + jsdom):
- `core/__tests__/tenant-identity.test.ts` (T006 RED → T005 GREEN) — 6 cases incl. fixture provenance comment.
- `core/__tests__/telemetry.test.ts` extension (T008 RED → T007 GREEN) — new export event kinds.
- `core/atlas/export/__tests__/surface-context.test.ts` (T010 → T009).
- `core/atlas/export/__tests__/header-builder.test.ts` (T012 → T011) — declared-key-order assertion.
- `core/atlas/export/__tests__/filename-builder.test.ts` (T014 → T013) — slug rules + collision suffix.
- `core/atlas/export/__tests__/size-estimator.test.ts` (T016 → T015) — tiered classification.
- `core/atlas/export/__tests__/build-export.test.ts` (T018 → T017) — pure-function + click-time-clone integrity.
- `core/atlas/export/__tests__/json.test.ts` (T022 → T021).
- `core/atlas/export/__tests__/csv.test.ts` (T024 → T023) — RFC 4180 quoting + R4 formula injection mitigation.
- `core/atlas/export/__tests__/html.test.ts` (T026 → T025) — XSS escape + R6 mitigation; print-stylesheet inlined.
- `core/atlas/export/__tests__/trigger-download.test.ts` (T028 → T027) — mocked `URL.createObjectURL`.
- `core/atlas/export/__tests__/detect-failure.test.ts` (T030 → T029) — fake timers for the 5s heuristic.

**UI / component tests** (per § 10 — `@testing-library/react`):
- `components/atlas/__tests__/download-button.test.tsx` (T038 → T032) — runtime contrast assertion via `getComputedStyle`.
- `components/atlas/__tests__/format-picker-menu.test.tsx` (T039 → T033) — runtime contrast on item highlight.

**Integration tests:**
- `components/atlas/__tests__/widget-surface-export.test.tsx` (T040 → T036) — full download flow on widget; per-format frames cited from POC.
- `components/atlas/__tests__/panel-surface-export.test.tsx` (T041 → T037) — full download flow on panel; AC-2.7 mid-navigation behavior.
- Schema-stability re-export test (T042) — twice-export an unchanged atlas; assert byte-identical except `exported_at` (DoD-3 / AC-4.4).
- Empty-state integration (T049) — zero-rendering atlas + zero-rendering page (DoD-8 / IS-18 / AC-2.5).

**Manual / audit / smoke:**
- T001 spike — manual user verification on real Cloud Portal install.
- T043 — DoD-7 grep audit (`atlas_export_schema_version` declared exactly once).
- T044 — DoD-5 bundle-size audit (next build size diff vs PRD-000 baseline).
- T045 — anti-metric guard wiring verified (DoD-6).
- T046 — telemetry distribution table populated in /test report (DoD-9).
- T047 — DoD-4 HTML print-preview manual gate (Chromium + Firefox + Safari × A4 + Letter).
- T048 — host-frame visual smoke (`sitecore:marketplace-sdk-host-frame-testing`) against `pocs/poc-v1/`. **Toolchain note:** Playwright MCP rejects `file://` URLs — substitute `npx serve pocs/poc-v1/` for static-server-served frames.
- T050 — full `npm run ci` run.

### Coverage targets

- **Export module (`core/atlas/export/`):** ≥90% statement coverage per NFR-5.3.
- **Tenant identity resolver:** 100% (small surface, all branches enumerated by T006).
- **Format adapters:** 100% on ordering, escape, and partial-flag paths (deterministic-output guarantee).

### Non-trivial-test policy (per § 9.8 CR-blocker rule)

- No `expect(true).toBe(true)`.
- No `toHaveClass(...)` alone for token-painted components — always verify resolved contrast.
- No SDK-fixture file without `// source:` provenance comment.
- No snapshot-only tests for behavioral assertions.

## Handoff Metadata

- **Canonical run manifest:** `products/component-usage-atlas/project-planning/workflow/run-20260503T101441Z.json`
- **Implementation target directory:** `products/component-usage-atlas/site/`
- **Recommended next command:** `/code-review` (after `/implement` completes)
- **Recommended next input file:** the diff produced by this implementation pass; QA Specialist 07's enriched task breakdown remains the test contract for `/test`.
- **Branch:** `prd-001` (cut from `prd-000`; `main` now contains PRD-000's merged code as of `ec8281a`; rebase optional before PR opens)
- **Remote:** `https://github.com/Chris1415/Sitecore.Plugin.Component-Usage-Atlas.git`
