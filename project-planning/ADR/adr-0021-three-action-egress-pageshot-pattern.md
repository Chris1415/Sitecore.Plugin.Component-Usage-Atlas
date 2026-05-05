# ADR-0021: Three-action egress pattern (Save + Open + Copy) per pageshot precedent

## Status

Accepted — supersedes ADR-0017 in part (the F1/F2/F3 cascade and the hard-fail toast). The Save mechanism specification from ADR-0017 § Primary mechanism is preserved and inherited by the `useSaveExport` hook.

## Context

T001 verification spike (2026-05-04) confirmed that the canonical browser download mechanism (`Blob + URL.createObjectURL + synthetic <a download>`) is **silent-blocked** on both Sitecore Marketplace extension points the atlas uses (`xmc:dashboardblocks` and `xmc:pages:context-panel`). Click handler fires; `a.click()` returns synchronously; no save dialog appears; no file lands in Downloads; no console error. The iframe sandbox does not include `allow-downloads`.

The user confirmed this is a **known platform-level limitation**, not a per-app bug. The same constraint is documented independently in the sibling Pageshot product:

```
products/pageshot/site/next-app/components/use-open-image.ts:7-15
"Exists as a workaround for the Sitecore Pages iframe sandbox lacking
 `allow-downloads`: while the 'Download' action will silently no-op
 inside the iframe until the host adds that sandbox token, `window.open`
 on a blob URL opens the PNG in a real top-level browsing context where
 the browser either downloads it directly or renders it inline for
 right-click → Save Image As. Requires `allow-popups` in the iframe
 sandbox."
```

Pageshot's solution — verified live in production — is to expose **three parallel actions** the editor can pick from:

| Pageshot hook | Mechanism | Status taxonomy |
|---------------|-----------|-----------------|
| `useDownloadImage` (`use-download-image.ts:99-110`) | Canonical anchor-click | `'idle' \| 'downloading' \| 'downloaded'` (no-op in current sandbox; preserved for future platform fix) |
| `useOpenImage` (`use-open-image.ts:62`) | `window.open(blobUrl, '_blank', 'noopener,noreferrer')` | `'idle' \| 'opening' \| 'opened' \| 'blocked'` |
| `useCopyImage` (`use-copy-image.ts:128-132`) | `navigator.clipboard.write([new ClipboardItem({ … })])` | `'idle' \| 'copying' \| 'copied' \| 'denied' \| 'unsupported'` (sticky `'denied'`) |

Atlas Snapshot Export inherits the same constraint (same iframe, same SDK, same sandbox attribute set). Adopting pageshot's pattern is the architectural-mirror move ADR-0021 captures.

## Decision

Atlas Snapshot Export ships **three first-class user-visible actions** per format, mirroring pageshot's pattern adapted to text artifacts (JSON / CSV / HTML) instead of pageshot's binary PNG.

### The three actions

1. **Save** — canonical `Blob + URL.createObjectURL + synthetic <a download> + click + revoke` (the mechanism specified in ADR-0017 § Primary mechanism). Future-proof: this action will start working the moment Sitecore adds `allow-downloads` to the Marketplace iframe sandbox. Until then, the action is **rendered as disabled** with a tooltip explaining the limitation and pointing the editor at Open / Copy. *No hard-fail toast.* The disabled state is persistent (the spike's outcome is captured at module-init time, not per-click), so editors don't have to discover the failure interactively.

2. **Open** — `window.open(blobUrl, '_blank', 'noopener,noreferrer')`. Opens the formatted artifact in a new top-level browsing context where the browser handles it natively: JSON renders as text in the new tab; CSV may render or download depending on browser config; HTML renders as the formatted document, which is now also the route to PDF (Ctrl+P → Save as PDF). On `null` return value (popup blocker / sandbox missing `allow-popups`) the action transitions to `'blocked'` and an inline message points at Copy.

3. **Copy** — text-format-aware. JSON and CSV use `navigator.clipboard.writeText(text)` — simpler than pageshot's `ClipboardItem` because the payload is plain text, not binary. HTML format uses `navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })])` so paste targets that understand HTML get formatted output and plain-text targets get the raw markup. On rejection: sticky `'denied'` for the session (mirrors pageshot's posture per `use-copy-image.ts:140-148`).

### UX shape

The format picker still drives selection (JSON / CSV / HTML). After format selection, the surface presents the **three action affordances** as a cluster (per pageshot's `ActionPill` precedent). The Save action's disabled state is visually distinct (Blok `disabled` token + tooltip). The Open and Copy actions are first-class and equally visible.

Implementation surface:

```
Surface header
  Format picker (Blok dropdown)  → JSON / CSV / HTML
  Once a format is chosen, render the action cluster:
    [Save] (disabled by default; tooltip explains)
    [Open] → primary affordance
    [Copy] → secondary affordance
```

Alternative composition (deferred to UI design re-spin): the three actions could be exposed inside the dropdown menu directly as `format × action` pills — but that's a UX optimization, not a contract. The contract is "three actions per format are user-visible."

### Hooks

Three hooks live under `core/atlas/export/hooks/` (or wherever the surface integrations land — see § 4c-5 in the amended task breakdown). Each takes the constructed `Blob` (from `buildExport(...)`) plus filename + format and returns its own status taxonomy:

```ts
useSaveExport({ blob, filename }):
  { status: 'idle' | 'saving' | 'saved' | 'unsupported', save: () => void }

useOpenExport({ blob }):
  { status: 'idle' | 'opening' | 'opened' | 'blocked', open: () => void }

useCopyExport({ text, htmlBlob? }):
  { status: 'idle' | 'copying' | 'copied' | 'denied' | 'unsupported',
    copy: () => Promise<void>, deniedMessage: string }
```

These mirror pageshot's hook shape — by deliberate convergence so the two products can later share the underlying primitives. Naming uses `Export` (not `Image`) since the artifact is a text/HTML export, not a screenshot.

### Telemetry

The existing event taxonomy (`export.attempt`, `export.success`, `export.fail`) carries through, with `errorCode` widened to:

```
'blob_construction_failed'      | unchanged
'sandbox_blocked_download'      | now applies to the Save action only
'browser_save_canceled'         | unchanged
'popup_blocked'                 | NEW — Open returned null
'clipboard_blocked'             | unchanged from PRD-001 § 11.4 mention
'unknown'                       | unchanged
```

Each action emits its own `export.attempt` and one of `export.success` / `export.fail` with the action name in the payload (`action: 'save' | 'open' | 'copy'`).

## Verification (post-spike)

**Save (F0)** is verified `silent_block` on both extension points by the T001 spike on 2026-05-04. No further verification needed — this ADR ships the action as `disabled` regardless until the platform unblocks.

**Open (F1)** inherits production proof from pageshot's `use-open-image.ts` (live, working, same iframe context). No fresh spike required at the architecture stage. A live-host smoke check at `/test` time (T048's host-frame visual smoke equivalent for this feature) confirms parity.

**Copy (F2)** inherits production proof from pageshot's `use-copy-image.ts` (live, working, sticky-denied posture). The atlas's text-format variant (`writeText` for JSON/CSV; `ClipboardItem` for HTML with text/plain peer) needs its own quick smoke at `/test`, since pageshot only ships the binary `ClipboardItem` path.

If any of Open or Copy is later found to be ALSO blocked at smoke time, the action's status flips to its `'blocked'` / `'denied'` value and the surface renders an inline explanation. The remaining unblocked action(s) carry the user. We do not engineer a fourth fallback.

## Consequences

### Easier

- **Editors get a working egress today**, not "after Sitecore adds `allow-downloads`." The Open action ships immediately and uses the browser's native handling for JSON / CSV / HTML.
- **HTML → PDF route is preserved.** Open in new tab → Ctrl+P → Save as PDF. ADR-0018 (no client-side PDF library) holds without change.
- **Future-proof for Save.** When Sitecore adds `allow-downloads`, the Save action transitions from disabled to enabled with no code change beyond a guard removal. The hook is fully implemented in code from day one.
- **Mirrors a proven pattern.** Pageshot ships this exact shape and it works. Risk is dramatically lower than inventing a fourth mechanism.
- **Hard-fail toast removed.** Per ADR-0017's original taxonomy F3 was a hard-fail UX. With three parallel actions exposed, there is always at least one path forward — no need to escalate "downloads are blocked" as a fatal toast.

### Harder

- **More UI surface.** The widget header and panel zone-2 now host three action affordances per format choice instead of one Download button. Bundle delta cap (NFR-1.4 ≤20 KB gzipped) is tighter — but pageshot ships all three within the same envelope, so the headroom exists.
- **Three success/failure status surfaces** to design + test. Each hook has its own taxonomy. The toast strategy from PRD-001 § 11.4 needs a re-shape: instead of one success toast and one failure toast, we have per-action affordances inline and shared toasts only for cross-cutting events (e.g. construction failed before any action ran).
- **HTML clipboard semantics are awkward.** Editors who copy HTML format and paste into a rich-text editor (Slack, email) get formatted markup; pasting into a code editor gets the raw HTML. Document this; A/B if friction.
- **Save's disabled state must be highly discoverable.** A grayed-out button with "Save" label invites the editor to "fix it" — the tooltip must be unambiguous. Copy: "Downloads are blocked in this iframe — use Open or Copy instead. (Save will work once Sitecore enables it.)"

### Neutral

- **No backend.** ADR-0002 (Mode A iframe-only, no backend) is preserved. Open + Copy are pure client-side hooks.
- **No new SDK calls.** ADR-0010 (atlas state via module-singleton) and ADR-0013 (telemetry in-iframe) hold without change.
- **PRD-001 G5 ("zero new architecture surface")** is still accurate at the deployment level — same Mode A, same scopes, no backend. The internal egress shape changes; the system architecture posture does not.

## Implications for downstream artifacts

- **PRD-001** carries an Amendment 1 referencing this ADR. The User Stories' "Download a snapshot" framing remains directionally correct; the acceptance criteria for filename / disabled state / failure handling shift to the three-action shape.
- **prd-minimal-001** carries the same amendment as a one-paragraph note in the "Key constraints & assumptions" section.
- **Task breakdown** is amended surgically: T001 spike marked `completed (F0 silent_block on both surfaces; verdict fork-to-pageshot-pattern)`; new tasks added under E5 for `useOpenExport` and `useCopyExport` hooks parallel to the existing Save hook; E5 surface integration tasks reshape from "single Download button + dropdown" to "format dropdown + three-action cluster"; E6 verification tasks add per-action smoke to the host-frame visual gate.
- **UI design spec v1** carries an Amendment 1 in § 7 noting the three-action shape. POC frame additions (action-cluster mock-ups + Save-disabled tooltip) are deferred to `/document` polish — the Developer building from the amended task breakdown does not need fresh POC frames to know what to construct.

## Date

2026-05-04
