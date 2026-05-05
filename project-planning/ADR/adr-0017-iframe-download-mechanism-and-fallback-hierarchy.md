# ADR-0017: Iframe download mechanism + fallback hierarchy

## Status

**Accepted, then superseded in part by ADR-0021 on 2026-05-04** — see § Amendment 1 at bottom. The primary mechanism (`Blob + URL.createObjectURL + synthetic <a download>`) is **not viable** in the current Sitecore Marketplace iframe sandbox: T001 spike (2026-05-04) confirmed `silent_block` on both `xmc:dashboardblocks` and `xmc:pages:context-panel`. The platform-level constraint is documented in `pageshot/site/next-app/components/use-open-image.ts:7-15`: "the iframe sandbox lacks `allow-downloads`; will start working when the host adds that sandbox token." ADR-0021 adopts the pageshot three-action egress pattern (Save + Open + Copy) — Save is kept in code as a future-proof affordance; Open and Copy are the user-visible primary actions until the platform unblocks downloads.

## Context

PRD-001 (Atlas Snapshot Export) ships a single Download button on each of the two surfaces (`xmc:dashboardblocks` widget, `xmc:pages:context-panel` panel). The button must produce a real file the editor can save to disk — JSON, CSV, or HTML.

The Sitecore Marketplace iframe is sandboxed. Marketplace's documented sandbox attributes have historically allowed `allow-downloads` (per the Marketplace SDK lifecycle skill), but this has never been **executed and verified end-to-end** for the two specific extension points the atlas registers. PRD-001 R1 / OQ-1 / § 9.5 mark this as a P0 verification spike: the architect must confirm the mechanism works on a real Cloud Portal install on **both** extension points before implementation begins.

Two failure modes are plausible:

1. The browser silently swallows the download (the `<a download>` click resolves but no save dialog appears, no Blob is written).
2. The iframe sandbox raises a console error and the `<a>` click is rejected.

Either failure invalidates the entire feature. The export module is moot if the editor cannot save the Blob. PRD-001 explicitly calls out the anti-pattern *"do not implement the export and 'test it later'"* — the spike runs first.

The architect must therefore commit to:
- A **canonical primary mechanism** that the implementer wires.
- A **defined fallback hierarchy** to apply if the spike (or later real-world evidence) shows the primary mechanism is blocked.
- A **verification protocol** that the upcoming task breakdown elevates to T001 — the very first executable task — so implementation cannot proceed past it without proof.

## Decision

### Primary mechanism

The download is constructed as:

```
1. const blob = new Blob([body], { type: mime });
2. const url = URL.createObjectURL(blob);
3. const a = document.createElement('a');
4.   a.href = url;
5.   a.download = filename;
6.   a.style.display = 'none';
7. document.body.appendChild(a);   // mandatory — detached anchors are no-ops in some browsers
8. a.click();
9. queueMicrotask(() => {
10.   a.remove();
11.   URL.revokeObjectURL(url);
12. });
```

This is the canonical mechanism for iframe-safe downloads in modern browsers and is what PRD-001 § 9.5 / FR-3.1–FR-3.2 already prescribe. No `data:` URLs (size-limited, awkward in sandboxed iframes), no `window.open` for the primary path (popups are even more aggressively sandboxed than downloads).

### Verification spike (T001 of the upcoming task breakdown)

The spike is **not** an architecture deliverable in this run — it is the first task `/task-breakdown` will inscribe and `/implement` will execute. This ADR specifies the spike's contract so it cannot be hand-waved:

- Add a temporary "Download test fixture" button on each surface that runs the primary mechanism with a 1KB synthetic Blob.
- Deploy a build to the existing Cloud Portal install on a real test tenant.
- Open the widget at the Dashboard, click the test button. Expected: browser save dialog appears OR file lands in the Downloads folder per the editor's browser settings.
- Open the panel on a Pages canvas, click the test button. Same expectation.
- Capture the result for **both** surfaces in the friction log under a new `download_smoke` section: `{ surface, result: 'success' | 'silent_block' | 'console_error', browser, timestamp, console_excerpt? }`.
- Remove the temporary button before the next commit. The fixture is a spike, not a feature.

If both surfaces report `success`, the primary mechanism stands and `/implement` proceeds with FR-3.1 unchanged.

If either surface reports a non-success outcome, this ADR is amended with an addendum naming which fallback the implementation will use, and the corresponding telemetry codes are wired (per AC-5.3 `sandbox_blocked_download`).

### Fallback hierarchy (applied in order if spike fails)

**F1 — `Blob + URL.createObjectURL` opened in a new tab via `window.open(url, '_blank')`.** No `<a download>` attribute, no synthetic click. The editor lands on the Blob URL in a new tab and uses the browser's native "Save page as" affordance. Worse UX (extra step, the editor cannot dictate the filename via `download` attribute), but a strict superset of capability — if downloads are blocked but new-tab navigation is not, F1 still ships the data. `download` attribute is lost; HTML opens directly in the new tab (acceptable — editors can print-to-PDF from there); JSON / CSV typically display as text or trigger a save prompt depending on browser MIME handling.

**F2 — Clipboard copy fallback (JSON-only).** If popups are also blocked, the toast surfaces a single `Copy JSON to clipboard` action (PRD-001 § 11.4 already lists this as the emergency fallback). CSV and HTML are unrecoverable on this fallback — the editor is told explicitly. This satisfies the "no silent failures" NFR (`export.fail` with `errorCode: 'sandbox_blocked_download'` plus a usable escape hatch).

**F3 — Hard-fail with surfaced error.** Both surfaces show a Blok error toast: *"Downloads are blocked in this app's iframe. Contact Sitecore support to enable downloads."* Telemetry logs `export.fail` per AC-5.3. The feature is non-viable without escalation; PRD-001 R1 escalation path activates.

The implementation wires **only the primary mechanism initially**. F1/F2/F3 are engineered if and only if the spike fails. Engineering all three speculatively adds complexity that 99% of installs will never need.

### Detection contract

The implementation **must** detect failure (not silently swallow it):
- Wrap the primary mechanism in a try/catch over `Blob` construction and the synthetic click.
- After `a.click()`, schedule a 5s timeout that inspects whether the Blob URL was revoked and whether telemetry observed a `dom.beforeunload`-style indicator the download started. If neither: log `export.fail` with `errorCode: 'sandbox_blocked_download'`. The toast in AC-1.7 fires.
- This 5s heuristic is imperfect (success doesn't fire a synchronous event) but is the best portable detection until the verification spike narrows the actual failure mode.

## Consequences

### Easier

- Implementation is unambiguous: write FR-3.1 once, run the spike, record the outcome. No speculative defensive code paths.
- The verification spike is procedurally enforced (it's T001), so the feature cannot ship undocumented sandbox behavior.
- Fallback hierarchy is named in advance, so a spike-failure outcome doesn't trigger a panic redesign — it slots into one of three known branches.

### Harder

- The team must actually run the spike on a real install. A simulated test (Storybook, headless browser without the Marketplace iframe context) does not satisfy DoD-1. This is by design: the very thing the spike validates is the iframe sandbox interaction.
- If the spike flips to "blocked" after launch (e.g. Sitecore Marketplace tightens sandbox policy), the F-hierarchy applies retroactively and a follow-on PR ships the chosen fallback. Operationally, the friction-log smoke check must include the download verification on every release going forward.
- Telemetry detection of download failure is best-effort. The 5s heuristic produces false negatives (slow user, slow disk) and false positives (some browsers don't fire detectable signals on success). This is acceptable for a v1 because `export.attempt` always fires and operators can compute attempt-vs-success ratios across N samples.

### Neutral

- The fallback hierarchy is documented but not implemented in v1 — code-size impact is zero unless a spike failure forces F1/F2/F3 in.
- Existing telemetry codes (`export.fail` with errorCode union per AC-5.3) already cover the spike's failure modes. No new event types needed.

## Date

2026-05-03

---

## Amendment 1 — 2026-05-04 — Spike outcome + supersession by ADR-0021

### Spike outcome

T001 spike (the first task of the `/task-breakdown` execution order — codified by this ADR) ran on 2026-05-04 against the existing Cloud Portal install on a real test tenant. Two-pass verification:

**Pass 1 — F0 primary mechanism (synthetic `<a download>` click):**
- `xmc:dashboardblocks` (route `/widget`): `silent_block`. Click handler fires; `a.click()` returns synchronously; no save dialog; no file in Downloads; no console error.
- `xmc:pages:context-panel` (route `/panel`): `silent_block` (same evidence).

**Diagnostic confirmation (with `console.info` instrumentation):**
Both `[CUA-SPIKE] runDownloadSpike fired` AND `[CUA-SPIKE] a.click() returned` log lines fire on both surfaces — confirming the JS path executes end-to-end, but the iframe sandbox swallows the download. This is the textbook `silent_block` outcome at AC-5.3 / `errorCode: 'sandbox_blocked_download'`.

### Root cause

The Sitecore Marketplace iframe is mounted with a `sandbox` attribute that does **not** include `allow-downloads`. The host-frame's omission is intentional (the user reports this as a "known limitation in permissions") and outside this app's control. Pageshot's `use-open-image.ts:7-15` documents the same constraint independently: *"the iframe sandbox lacks `allow-downloads`; will start working when the host adds that sandbox token."*

### Decision (as superseded)

The F1/F2/F3 fallback hierarchy as originally drafted (single-mechanism cascade with Save → window.open → clipboard → hard-fail) is **superseded** by ADR-0021's three-action egress pattern. The substantive shifts:

| Aspect | Original ADR-0017 | After ADR-0021 |
|--------|-------------------|----------------|
| User-visible actions | One: "Download" button | Three: Save / Open / Copy (per pageshot pattern) |
| Save (canonical anchor click) | Primary | Future-proof; kept in code; status `disabled` with tooltip until platform adds `allow-downloads` |
| Open (`window.open`) | F1 fallback (only if F0 fails) | First-class user action — primary egress in current sandbox |
| Copy (clipboard) | F2 fallback | First-class user action — secondary egress for non-popup environments |
| Hard-fail toast | F3 fallback | Removed; the three-action surface is itself the fail-safe |
| Failure detection | 5s `URL.createObjectURL` revoke heuristic | Per-action: `window.open` returns `null` → `'blocked'`; `navigator.clipboard.write` rejects → `'denied'` |

### What stays from this ADR

- The canonical Save mechanism specification (§ Primary mechanism, lines 1-12 in the original) is still the contract for the `useSaveExport` hook (renamed from "Download" to "Save" in the new pattern). Implementation matches the original ADR's pseudocode.
- The verification spike contract (run on real Cloud Portal install on both extension points) is still mandatory — see ADR-0021 § Verification for the F1/F2 spike conditions.
- The detection heuristic for the Save-blocked case still applies, but is now used to flip the Save button's status to `'disabled'` with a "Downloads are blocked in this iframe — use Open or Copy instead" tooltip, NOT to surface a hard-failure toast. The Save action is informational at the moment, not throw-away code.

### What this ADR no longer mandates

- The F1/F2/F3 sequential cascade. Replaced by parallel exposition of all three actions at once.
- The hard-fail toast (F3). Removed.
- The "engineer F1 only if F0 fails" lazy-evaluation policy. Replaced by upfront engineering of all three.

See ADR-0021 for the new pattern's full decision and consequences.
