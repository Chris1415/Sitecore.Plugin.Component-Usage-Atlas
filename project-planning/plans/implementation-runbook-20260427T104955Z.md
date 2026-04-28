# Implementation Runbook — Component Usage Atlas

---
document_type: implementation_runbook
artifact_name: implementation-runbook-20260427T104955Z.md
generated_at: 2026-04-27T16:35:00Z
run_manifest: products/component-usage-atlas/project-planning/workflow/run-20260427T104955Z.json
source_inputs:
  - products/component-usage-atlas/project-planning/PRD/prd-minimal-000.md (primary scope/orientation)
  - products/component-usage-atlas/project-planning/plans/task-breakdown-20260427T104955Z.md (execution contract: § 4c, 77 tasks, § 5 RED-first order, §§ 9–10 TDD + per-task tests)
  - products/component-usage-atlas/pocs/poc-v2/ (canonical visual reference — clickdummy wins on visual divergence)
consumed_by:
  - Engineering Team (Developer 08 sub-agents per milestone)
next_input:
  - products/component-usage-atlas/site/
---

## 1. Implementation Scope

Build **Component Usage Atlas v0.1** — a Sitecore Marketplace app shipping two surfaces from one registration:

- **Dashboard Widget** (`xmc:dashboardblocks`) — component-centric search; tenant-wide rendering+datasource usage table; click-row drawer with per-page detail.
- **Page Context Panel** (`xmc:pages:context-panel`) — page-centric impact; per-rendering "+N other pages use this" counters; datasource impact group; missing-datasource warnings.

**Mode A iframe-only**, no backend, no persistence. Live in-memory atlas walks `xmc.agent.sitesGetSitesList → sitesGetAllPagesBySite → pagesGetComponentsOnPage` on demand. Wait absorbed by **v2 Console Operator** loading visual (CI-style segmented progress strip + numeric readout + cancel).

**Visual direction:** v2 Console Operator (`pocs/poc-v2/`) — dense scannable counters, build-pipeline aesthetic, real Blok semantic tokens only.

## 2. Canonical Inputs

- **`prd_minimal`:** `products/component-usage-atlas/project-planning/PRD/prd-minimal-000.md` (86 lines)
- **`task_breakdown` (TDD-enriched):** `products/component-usage-atlas/project-planning/plans/task-breakdown-20260427T104955Z.md` (2201 lines, 77 tasks, § 4c filled, §§ 9–10 populated)
- **`task_breakdown_pre_qa`:** snapshot at `task-breakdown-pre-qa-20260427T104955Z.md` (1453 lines — Lead Developer's pre-QA original)
- **`qa_report`:** `null` — minimal track; the task breakdown's §§ 4b, 9, 10 ARE the test contract
- **Winning POC:** `products/component-usage-atlas/pocs/poc-v2/` (open during UI implementation as visual reference; clickdummy wins on visual divergence)
- **Architecture / UI specs / ADRs:** **NOT loaded** — § 4c carries everything the Developer needs. If § 4c is insufficient, Developer escalates per `.agent/WORKFLOW.md` (Escalation protocol) — does not load upstream docs as a workaround.

## 3. Target Directory Decision

- **Repo root:** `products/component-usage-atlas/` (separate git repo with `prd-000` branch already checked out)
- **Implementation target:** `products/component-usage-atlas/site/`
- **State:** `site/` does not yet exist; will be created by T001 (scaffold).
- **Why `site/`:** convention from CLAUDE.md (`Implementation code lives in site/ by default`); keeps planning artifacts at the repo root cleanly separate from code.
- **Manifest record:** `implementation.target_directory: "site"` (already set).

## 4. Planned Delivery Order

`task_breakdown_style: tdd` → **sequential RED → GREEN → REFACTOR**, no parallel groups (per `/implement` § Parallel execution model — TDD blocks parallelization).

Authoritative execution order: § 5 of `task-breakdown-20260427T104955Z.md` lines 1316+. Driven in milestones:

| Milestone | Scope | Task IDs | Mode |
|---|---|---|---|
| **M1** | Scaffold + lifecycle hello-world | T001 → T011 (E1) | NON-CODE + 1 GREEN (T008) |
| **M2** | Domain types + SDK pin + scan-engine foundation | T012, T013, T005, T100–T106, T016, T103, T104, T014, T017, T018, T072, T019 | RED-first |
| **M3** | Scan engine end-to-end | T015, T020–T026, T030, T032, T031, T107, T027, T033 | RED-first |
| **M4** | UI primitives + collision util | T045, T108–T112, T044 | RED-first |
| **M5** | Widget surface + drawer + skipped-pages sub-drawer | T040–T048 (E4), T060–T065 (E6) | RED-first |
| **M6** | Panel surface + edge handling + telemetry + build/release | T050–T054 (E5), T080–T082 (E8), T072–T075 (E7), T090–T094 (E9) | RED-first |

Each milestone is one Developer (08) sub-agent invocation. After each milestone, the Team Lead verifies (lint + typecheck + test + build) and pauses for user check-in before launching the next.

**Within a milestone:** the Developer follows § 5 line-by-line. RED tests are committed in failing state; the GREEN task is the only thing that lifts them.

## 5. Verification Checklist

Per-milestone gate (Developer must report all green before declaring milestone done):

- [ ] All tasks in milestone scope completed per § 5 ordering.
- [ ] `npm run lint` exits 0.
- [ ] `npm run typecheck` exits 0 (where the milestone has TypeScript output).
- [ ] `npm run test` exits 0 (where tests exist for the milestone).
- [ ] `npm run build` exits 0 (where the milestone produces a buildable surface).
- [ ] Implementation runbook § 8 cross-referenced — all tests called out are implemented.
- [ ] No new files outside the planned task scope (no scope creep).
- [ ] Friction log updated when any planned step diverged or surfaced surprises.

Final-run gate (M6 exit):

- [ ] All 77 task IDs done or explicitly marked deferred-with-rationale.
- [ ] Anti-metric guard (DoD-4) active in CI per ADR-0013 / T075.
- [ ] `grep -RE 'fetch|XMLHttpRequest|sendBeacon'` over `core/ lib/ components/ app/` — every match is inside `client.query/mutate` (DoD-1).
- [ ] Real-tenant smoke (T094) recorded — host URL + clipped iframe screenshot vs poc-v2.
- [ ] `stage_history` `implemented` entry appended; `implementation.status: completed`.

## 6. Risks To Watch During Implementation

From PRD R1..R14 + architect-time OQs (folded into § 4c-6):

1. **OQ-A1** — `pagesGetComponentsOnPage` field-name divergence: RED tests T100/T107 are the regression hook. T005 verifies at scaffold time and writes findings to friction log + CATALOG.
2. **OQ-A2** — `sitesGetAllPagesBySite` pagination shape unverified. T005 confirms; pages-enumerator (T022) handles flat vs paginated.
3. **R1** — scan time at >2k-page tenants exceeds editor patience even with engaging loading. v2 Console Operator's CI-progress aesthetic was chosen partly to make the wait readable as "work being done." Phase-2 escape hatch is persistence via Standalone (out of scope).
4. **R2** — XMC rate-limit hits during real scans. ADR-0012 mitigation: concurrency 8 + `withBackoff` exponential backoff (T019, T104).
5. **Display-name collision** (FR-9) — `· <last-7-of-id>` suffix; tooltip exposes full ID. T106 RED + T045/T044 implementation.
6. **`@blok/toggle-group`** install may fail (per `components.md` "not in quickstart") — fallback density toggle in T065.
7. **Sandbox keyframe support** (OQ-V2-3) — verify CSS animations run inside the portal sandbox at T094.
8. **POC drift** — if implementation diverges from `pocs/poc-v2/` on visual specifics, raise as a finding ("POC drift") per QA Specialist host-frame-testing rule. Do not silently invent a new baseline.

## 7. Completion Criteria

Atlas v0.1 is "done" when:

- All 7 PRD success criteria pass (S1..S7 in prd-minimal § Success criteria).
- Both surfaces install in a real Cloud Portal tenant; clipped iframe screenshots match poc-v2 on the five host-frame-testing axes (layout, typography, color, component anatomy, state fidelity) within tolerance.
- Anti-metric guard passes (DoD-4).
- README documents the local-smoke-test rule (T011) and required API scopes (`xmc.agent.read`, `xmc.sites.read`).
- Run manifest reaches `status: implemented` with `implementation.status: completed` and `stage_history` entry appended.
- Branch `prd-000` is push-ready (deferred to `/ship`).

## 8. What Needs To Be Tested (global testing runbook)

`canonical_artifacts.qa_report` is `null` — the task breakdown's §§ 4b, 9, 10 are the test contract. `/test` reads them directly.

### Unit tests (Vitest + jsdom)

Scope: pure modules under `core/` and `lib/sdk/`.

| Module | RED task | Behaviors covered |
|---|---|---|
| `core/index-builder.ts` | T100 | Build atlas indices from raw scan results; rendering+datasource usage aggregation; reference counting |
| `core/error-classifier.ts` | T101 | Map XMC errors to typed `Skipped.reason` values: `forbidden`, `timeout`, `not_found`, `network_error`, `other` |
| `core/scan-state-machine.ts` | T102 | Transitions between `idle`, `scanning_sites`, `scanning_pages`, `scanning_components`, `complete`, `cancelled`, `error` |
| `core/concurrency-pool.ts` | T103 | Bounded parallelism (default 8); back-pressure; cancellation propagation |
| `core/scan-config.ts::withBackoff` | T104 | Exponential backoff retry math; jitter; max-retries cap; respects `AbortSignal` |
| `core/context-resolver.ts` (`requireContextId`) | T105 | Throws typed `AtlasNoContextError` when `application.context.sitecoreContextId` is absent — never silently returns; never `as string` |
| `lib/utils/collisions.ts` (`computeCollisions`) | T106 | Display-name collision detection by rendering ID; correct `· <last-7-of-id>` suffix; idempotent |
| `core/atlas-store.ts` | T030 inline | Module-singleton state; `setAtlasState` / `getAtlasState` / `subscribe`; immutability of returned state |
| `core/use-atlas-slice.ts` | T031 inline | React hook subscription; selective re-render on slice change only |
| `core/atlas-freeze.ts` | T026 inline | `Object.freeze` deep on atlas; defensive against mutation |
| `core/telemetry.ts::track` | T072 inline | Ring buffer emit; `console.info("[CUA]", event)`; NO `postMessage`; NO external network |

### Integration tests (Vitest + typed SDK stubs)

Scope: `core/scan-engine.ts::runScan` end-to-end against in-memory stubs of `@sitecore-marketplace-sdk/xmc`.

| RED task | Scenario |
|---|---|
| T107 | Happy-path scan over 3 sites × 50 pages × ~10 components per page → atlas built; counts correct |
| T107 | Per-page failure (forbidden / timeout / network) → page lands in `skipped[]` with typed reason; scan continues |
| T107 | Cancel mid-scan via shared `AbortController` → state transitions to `cancelled`; partial atlas preserved |
| T107 | Rate-limit (429) on SDK call → `withBackoff` retries; if exhausted, page lands in `skipped[]` with `network_error` reason |
| T107 | Missing `sitecoreContextId` → `AtlasNoContextError` surfaced; no silent fallback |

### UI / component tests (RTL + jsdom + jest-dom)

Scope: surface components rendered with real `@blok/*` primitives or test-utility wrappers. Mocks for SDK hooks.

| RED task | Component | Scenarios |
|---|---|---|
| T108 | `<CounterRow />` | Idle, loading, ready, zero, error states render correct semantic tokens; `aria-live` semantics; numeric formatting |
| T109 | `<ScanStatusBar />` | 3 segments (sites/pages/components) render correct active/pending/completed states; `aria-live="polite"`; numeric readout updates; cancel button accessible by keyboard |
| T110 | `<RenderingNameCell />` | Collision rendering with `· <last-7-of-id>` suffix; tooltip exposes full ID; non-collision case unaffected |
| T111 | Drawer rows | Forbidden / disabled rows render with reason chip and proper `aria-disabled`; click does not navigate |
| T112 | "Direct bindings only" affordance | Always visible on widget+panel surfaces; tooltip explains; matches ADR-0006 mandate |

### E2E / host-frame visual tests (Playwright MCP per `host-frame-testing.md`)

**Canonical visual target = clipped iframe inside live host. Standalone-localhost is NOT a substitute.**

| Task | Scenario |
|---|---|
| T094 (manual portion) | Real-tenant smoke: open Cloud Portal → tenant → widget extension; screenshot clipped iframe; diff vs `pocs/poc-v2/` on 5 axes (layout, typography, color, component anatomy, state fidelity); deviations → POC drift finding back through `/architect` |
| T094 | Same for panel extension on a representative page |
| T094 | Cancel-with-act flow on a real >500-page tenant |
| T094 | Permission-denied flow on a forbidden page → skipped row with `forbidden` reason chip |
| T094 | 60fps loading visual at scan time (manual devtools profiling per OQ-V2-3) |

If host URL + app origin are not supplied at `/test` time, record visual testing as **deferred — host URL not supplied** with **WARN** verdict (per QA Specialist identity). Never silently skip.

### Regression

- Full suite must pass before `/ship`. All passing RED→GREEN cycles count as regression coverage.
- `grep -RE 'fetch|XMLHttpRequest|sendBeacon' --include='*.ts' --include='*.tsx' core/ lib/ components/ app/` — every match must be inside `@sitecore-marketplace-sdk/*` calls (DoD-1, NFR-5.2).

### Test commands (set up at T003)

- `npm run test` — Vitest run (CI mode)
- `npm run test:watch` — Vitest watch
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — Next.js build

## M6 — completion summary (final implementation milestone)

M6 closed the implementation track. All 71 in-scope tasks are committed; T092-T094 are deferred to user-driven post-deploy steps because they require real Sitecore tenant credentials and a deployed Vercel URL.

### What M6 added

- **E5 Panel surface** — `panel-surface.tsx` (composes Zone 1/2/3, no Zone 4), `page-context-card.tsx`, `rendering-impact-list.tsx`, `datasource-impact-group.tsx`, `missing-datasource-warning.tsx`. Subscribes to `pages.context` (per `client.md` § 6a path A) on mount; per-page fetch on a SEPARATE `AbortBus` (OQ-A5) so the rendering stack paints in <1s even while the global scan is in flight; cleans up subscription + fetch on unmount.
- **E8 Edge handling** — `<DirectBindingsAffordance />` now mounted in panel Zone 2 in addition to widget Zone 2 (verified across all 4 atlas states); "(unknown rendering)" virtual row in `<WidgetTable />` collapses every `isUnknown:true` entry into one labeled row whose Total cell sums the synthetic group; forbidden-page handling in `<UsageDrawer />` honored on both surfaces (panel test asserts `client.mutate` is NOT called on a forbidden row).
- **E7 Telemetry verification** — `surface_mounted` events emitted by both `<WidgetSurface />` and `<PanelSurface />` on first mount; new `core/__tests__/telemetry-conformance.test.ts` enumerates every `TelemetryEventKind`, asserts no PII keys leak, asserts the ring buffer drops oldest beyond 500 (FIFO), AND runs the anti-metric guard as a vitest test (DoD-4) so the gate fires inside `npm run test` regardless of the npm script gate; `<DebugPanel />` reveals `getBuffer()` JSON when `?debug=1` is on the URL.
- **E9 Build / CI** — `scripts/check-antimetrics.mjs` (T075) plus `scripts/audit-network.mjs` (T091) plus `scripts/__tests__/*.test.mjs` driving each from a tmpdir fixture; new npm scripts `audit:network`, `audit:anti-metric`, `check:antimetrics` (alias for compat with the pre-existing breakdown text), and a composite `ci` script that chains lint + typecheck + test + build + audit:network + audit:anti-metric. Composite `npm run ci` exits 0.

### Test count delta

| Milestone | Tests | Files |
|---|---|---|
| M5 baseline | 166 | 25 |
| M6 GREEN | 216 | 32 |
| Delta | +50 | +7 |

### Verification gate (run from `site/`)

| Command | Result |
|---|---|
| `npm run lint` | exit 0 (2 pre-M6 warnings on Blok `<img>` — non-load-bearing) |
| `npm run typecheck` | exit 0 |
| `npm run test` | exit 0; 216/216 across 32 files |
| `npm run build` | exit 0; both `/widget` and `/panel` prerender as static |
| `npm run audit:network` | exit 0; 0 raw fetch/XHR/sendBeacon outside SDK |
| `npm run audit:anti-metric` | exit 0; 0 forbidden KPI strings |
| `npm run ci` | exit 0 (composite gate) |

### Deferred to user (T092-T094)

These three tasks are explicitly out of scope for the Developer agent and stay deferred on the run-manifest until a user-driven post-deploy session can drive them:

- **T092 — Configure Vercel project root.** Requires Vercel dashboard access; project root must be set to `products/component-usage-atlas/site`. Done once per repo — no code changes.
- **T093 — Cloud Portal registration paste.** Requires `Organization Admin` or `Organization Owner` role in a real Sitecore tenant; routes are `/widget` and `/panel`; scopes are `xmc.agent.read` + `xmc.sites.read`.
- **T094 — Real-tenant smoke test (host-frame).** Per `host-frame-testing.md`, the canonical visual test is the clipped iframe inside the live host. Requires user-supplied host URL + app origin; if missing at `/test` time, record as **deferred — host URL not supplied** with **WARN** verdict.

## Handoff Metadata

- Canonical run manifest: `products/component-usage-atlas/project-planning/workflow/run-20260427T104955Z.json`
- Implementation target directory: `products/component-usage-atlas/site/`
- Recommended next command: `/code-review` (after final M6 milestone), then `/test`, then `/ship`
- Recommended next input file: `products/component-usage-atlas/project-planning/plans/task-breakdown-20260427T104955Z.md` (Developer continues to drive § 5 execution order)
