## Summary

- **Ship status:** `shipped_with_caveats` — forced by the smoke-outcomes gate (4 pending entries; none code defects).
- Adds editor-driven JSON / CSV / HTML egress from both atlas surfaces. **Architecture stays additive** — no new SDK calls, no new extension points, no backend, no Auth0 changes. ADR-0002 (Mode A iframe-only) and ADR-0003 (no persistence) hold.
- **Mid-implementation architectural fork** to the proven Pageshot three-action pattern (ADR-0021 supersedes-in-part ADR-0017): T001 spike confirmed the canonical download mechanism is silent-blocked in the Marketplace iframe sandbox (host omits `allow-downloads` — known platform-level limitation). Save renders disabled today as future-proof; Open + Copy ship as primary user-visible actions.

## Artifacts

- **PRD:** `project-planning/PRD/prd-001.md` (+ Amendment 1)
- **Ship report:** `project-planning/plans/ship-report-20260505T070000Z.md`
- **Task breakdown:** `project-planning/plans/task-breakdown-20260503T101441Z.md`
- **Code review:** `project-planning/plans/code-review-20260505T064100Z.md` (PASS, 0 critical, 0 major, 3 minor)
- **Test report:** `project-planning/plans/test-report-20260505T065000Z.md` (PASS WITH CAVEATS)
- **ADRs introduced:** 0015 (export-as-v1, supersedes PRD-000 OS-15), 0016 (pure construction + click-time clone), 0017 (download mechanism + Amendment 1), 0018 (no client-side PDF library), 0019 (schema-versioning policy), 0020 (tenant identity via `resourceAccess[0]`), 0021 (three-action egress per pageshot)

## Test plan

- [x] Lint and build pass (`npm run ci` end-to-end green)
- [x] All automated tests pass (463 across 61 files; +208 new behavioural tests)
- [x] Schema-version SoT audit passes (DoD-7, new `npm run check:schema-version` script)
- [x] Anti-metric guard extended with three new export-anti-metric patterns (DoD-6)
- [x] Network audit clean (DoD-1 via ADR-0013 in-iframe-only telemetry)
- [x] Load-bearing AC-2.7 mid-navigation click-time-clone test passes
- [x] Live UX feedback verified during this session: format-picker disabled state, Save tooltip on hover, Open auto-revert (noopener-null false positive), "16 other pages" counter bug fix, format-active indicator
- [ ] **Host-frame walkthrough** captured per `sitecore:marketplace-sdk-host-frame-testing` § 7 (clipped iframe screenshots for each PRD acceptance state, compared against the winning POC clickdummy on the 5 axes) — **deferred** (host URL not supplied; POC re-spin needed for action-cluster shape)
- [ ] **Live walkthrough** completed (≥5 min as a real editor) — drawers/modals/CTAs exercised; findings recorded as `S<n>` IDs in the test report — **deferred** (mandatory before status can transition to `shipped`)
- [ ] **HTML print-preview manual gate** (DoD-4) on Chromium + Firefox + Safari × A4 + Letter — **deferred** (manual multi-browser pass)
- [ ] **Bundle-cap escalation** (DoD-5 / NFR-1.4) — re-measure with `next-bundle-analyzer` for precise feature share, OR amend NFR-1.4 to reflect post-ADR-0021 architecture — **deferred** (planning/measurement decision; not a code defect)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
