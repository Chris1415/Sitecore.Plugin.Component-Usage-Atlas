# Click targets — Quiet Affordance (poc-v1)

Every clickable element across every frame in this POC, with the named
post-state file each click leads to. Generic post-state labels like "menu
opens" are forbidden — every distinct click target lands on its own named
frame (S10 lesson from PRD-000).

## index.html

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| index.html | "S1 — Widget default" link | navigates to widget default | widget.html |
| index.html | "S2 — Format picker (small atlas)" link | navigates to small-atlas menu open | widget-menu-open.html |
| index.html | "S2b — Format picker (5–50 MB)" link | navigates to large-tier menu open | widget-menu-large.html |
| index.html | "S2c — Format picker (≥ 50 MB)" link | navigates to huge-tier menu open | widget-menu-huge.html |
| index.html | "S4 — Panel default" link | navigates to panel default | panel.html |
| index.html | "S5 — Panel format picker" link | navigates to panel menu open | panel-menu-open.html |
| index.html | "S6 — Success toast" link | navigates to success toast (JSON) | toast-success.html |
| index.html | "S6b — Success (empty atlas)" link | navigates to empty-atlas success toast | toast-success-empty.html |
| index.html | "S7 — Generic failure toast" link | navigates to generic failure toast | toast-failure-generic.html |
| index.html | "S8 — Sandbox-blocked toast" link | navigates to sandbox-blocked toast | toast-failure-sandbox.html |
| index.html | "S9 — Why? popover open" link | navigates to popover-open frame | popover-why-sandbox.html |
| index.html | "S11 / S12 — HTML output sample" link | opens self-contained export artifact | html-output-sample.html |
| index.html | "click-targets.md" link | opens this enumeration | click-targets.md |

## widget.html

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| widget.html | breadcrumb "← Back to index" | returns to index | index.html |
| widget.html | `.atlas-download-button` (Blok outline neutral sm) | opens format picker (small atlas) | widget-menu-open.html |
| widget.html | "Refresh atlas" button | (visual stub — no-op for the POC) | widget.html |
| widget.html | footer "Back to index" | returns to index | index.html |

## widget-menu-open.html (S2 — small atlas, < 5 MB)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| widget-menu-open.html | breadcrumb "← Back to index" | returns to index | index.html |
| widget-menu-open.html | `.atlas-download-button` (aria-expanded=true) | closes menu | widget.html |
| widget-menu-open.html | `[data-format="json"]` menu item | triggers JSON download | toast-success.html |
| widget-menu-open.html | `[data-format="csv"]` menu item | triggers CSV download | toast-success-csv.html |
| widget-menu-open.html | `[data-format="html"]` menu item | triggers HTML download | toast-success-html.html |
| widget-menu-open.html | "Refresh atlas" button | (visual stub) | widget-menu-open.html |
| widget-menu-open.html | footer "Back to index" | returns to index | index.html |

(Also documented per spec § 4.2: Escape / outside-click closes the menu and
restores focus to the trigger → widget.html. Modeled by re-clicking the
expanded trigger.)

## widget-menu-large.html (S2b — 5–50 MB tier)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| widget-menu-large.html | breadcrumb "← Back to index" | returns to index | index.html |
| widget-menu-large.html | `.atlas-download-button` (aria-expanded=true) | closes menu | widget.html |
| widget-menu-large.html | `[data-format="json"]` menu item | triggers JSON download | toast-success.html |
| widget-menu-large.html | `[data-format="csv"]` menu item | triggers CSV download | toast-success-csv.html |
| widget-menu-large.html | `[data-format="html"]` menu item | triggers HTML download | toast-success-html.html |
| widget-menu-large.html | "Refresh atlas" button | (visual stub) | widget-menu-large.html |
| widget-menu-large.html | footer "Back to index" | returns to index | index.html |

## widget-menu-huge.html (S2c — ≥ 50 MB tier)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| widget-menu-huge.html | breadcrumb "← Back to index" | returns to index | index.html |
| widget-menu-huge.html | `.atlas-download-button` (aria-expanded=true) | closes menu | widget.html |
| widget-menu-huge.html | `[data-format="json"]` menu item | triggers JSON download (large) | toast-success.html |
| widget-menu-huge.html | `[data-format="csv"]` menu item | triggers CSV download (large) | toast-success-csv.html |
| widget-menu-huge.html | `[data-format="html"]` menu item | triggers HTML download (large) | toast-success-html.html |
| widget-menu-huge.html | "Refresh atlas" button | (visual stub) | widget-menu-huge.html |
| widget-menu-huge.html | footer "Back to index" | returns to index | index.html |

## panel.html (S4 — Panel default)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| panel.html | breadcrumb "← Back to index" | returns to index | index.html |
| panel.html | `.atlas-download-button` (icon-only ghost) | opens format picker | panel-menu-open.html |
| panel.html | "3 skipped" warning button | (visual stub — would open skipped drawer) | panel.html |
| panel.html | footer "Back to index" | returns to index | index.html |

## panel-menu-open.html (S5 — Panel format picker)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| panel-menu-open.html | breadcrumb "← Back to index" | returns to index | index.html |
| panel-menu-open.html | `.atlas-download-button` (aria-expanded=true) | closes menu | panel.html |
| panel-menu-open.html | `[data-format="json"]` menu item | triggers JSON download | toast-success.html |
| panel-menu-open.html | `[data-format="csv"]` menu item | triggers CSV download | toast-success-csv.html |
| panel-menu-open.html | `[data-format="html"]` menu item | triggers HTML download | toast-success-html.html |
| panel-menu-open.html | "3 skipped" warning button | (visual stub) | panel-menu-open.html |
| panel-menu-open.html | footer "Back to index" | returns to index | index.html |

## toast-success.html (S6 — JSON success)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| toast-success.html | breadcrumb "← Back to index" | returns to index | index.html |
| toast-success.html | `.atlas-download-button` | re-opens format picker | widget-menu-open.html |
| toast-success.html | footer "Back to index" | returns to index | index.html |

(Toast itself has no actions on success per spec § 4.3; auto-dismiss after
4 s — modeled by user navigating away.)

## toast-success-csv.html (S6 — CSV success)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| toast-success-csv.html | breadcrumb "← Back to index" | returns to index | index.html |
| toast-success-csv.html | `.atlas-download-button` | re-opens format picker | widget-menu-open.html |
| toast-success-csv.html | footer "Back to index" | returns to index | index.html |

## toast-success-html.html (S6 — HTML success)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| toast-success-html.html | breadcrumb "← Back to index" | returns to index | index.html |
| toast-success-html.html | inline link "html-output-sample.html" | opens artifact | html-output-sample.html |
| toast-success-html.html | `.atlas-download-button` | re-opens format picker | widget-menu-open.html |
| toast-success-html.html | footer "Back to index" | returns to index | index.html |

## toast-success-empty.html (S6b — Empty atlas)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| toast-success-empty.html | breadcrumb "← Back to index" | returns to index | index.html |
| toast-success-empty.html | `.atlas-download-button` | re-opens format picker | widget-menu-open.html |
| toast-success-empty.html | footer "Back to index" | returns to index | index.html |

## toast-failure-generic.html (S7 — Generic failure)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| toast-failure-generic.html | breadcrumb "← Back to index" | returns to index | index.html |
| toast-failure-generic.html | `[data-action="retry"]` (Retry) | re-attempts; modeled as a fresh success | toast-success.html |
| toast-failure-generic.html | `[data-action="why"]` (Why?) | (visual stub — no popover frame for generic; would mirror the sandbox popover anatomy) | toast-failure-generic.html |
| toast-failure-generic.html | `.atlas-download-button` | re-opens format picker | widget-menu-open.html |
| toast-failure-generic.html | footer "Back to index" | returns to index | index.html |

## toast-failure-sandbox.html (S8 — Sandbox-blocked)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| toast-failure-sandbox.html | breadcrumb "← Back to index" | returns to index | index.html |
| toast-failure-sandbox.html | `[data-action="retry"]` (Retry) | re-attempts; modeled as a fresh JSON success | toast-success.html |
| toast-failure-sandbox.html | `[data-action="copy-json"]` (Copy JSON to clipboard) | clipboard write succeeds; toast collapses to "Copied JSON to clipboard." (modeled by empty-success variant) | toast-success-empty.html |
| toast-failure-sandbox.html | `[data-action="why"]` (Why?) | opens Why? popover | popover-why-sandbox.html |
| toast-failure-sandbox.html | `.atlas-download-button` | re-opens format picker | widget-menu-open.html |
| toast-failure-sandbox.html | footer "Back to index" | returns to index | index.html |

## popover-why-sandbox.html (S9 — Why? popover open)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| popover-why-sandbox.html | breadcrumb "← Back to index" | returns to index | index.html |
| popover-why-sandbox.html | `[data-action="why"]` (re-click trigger) | closes popover | toast-failure-sandbox.html |
| popover-why-sandbox.html | `[data-action="retry"]` (Retry) | re-attempts | toast-failure-sandbox.html |
| popover-why-sandbox.html | `[data-action="copy-json"]` (Copy JSON) | clipboard write succeeds | toast-success-empty.html |
| popover-why-sandbox.html | `[data-action="open-friction-log"]` (View friction log) | (visual stub — would open ADR-0013 ring buffer view) | popover-why-sandbox.html |
| popover-why-sandbox.html | `.atlas-download-button` | re-opens format picker | widget-menu-open.html |
| popover-why-sandbox.html | footer "Back to index" | returns to index | index.html |

(Also per spec § 4.6: Escape / outside-click closes popover and restores focus
to the Why? action button → toast-failure-sandbox.html.)

## html-output-sample.html (S11 / S12 — HTML export artifact)

| Screen | Element | Click → | Post-state file/anchor |
|--------|---------|---------|------------------------|
| html-output-sample.html | (no clickable elements) | — | — |

The HTML export is intentionally interaction-free per AC-3.2 / NFR-4.3: no
JS, no remote assets, no inline anchors. Recipient prints to PDF via the
browser's native print dialog → DoD-4 contract.
