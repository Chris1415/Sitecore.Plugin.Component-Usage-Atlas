# Atlas Snapshot Export

> Added in PRD-001 (2026-05-05). See `docs/decisions.md` — Snapshot Export theme (ADR-0015 through ADR-0021) for the architectural decisions behind this feature.

Both the Dashboard Widget and the Page Context Panel let editors take a portable snapshot of the atlas out of the iframe. The same action cluster appears on each surface: a **format picker** followed by **Save**, **Open**, and **Copy**.

## Why it exists

- **Diff across time** — snapshot today, snapshot after a publish or refactor, diff the outputs to see what changed in component usage.
- **Share without XM Cloud access** — hand the HTML to stakeholders (PMs, designers, agency partners) who don't have a Cloud Portal seat, or print to PDF.
- **Feed downstream tools** — CSV into spreadsheets and BI dashboards; JSON into refactor scripts, content audits, or migration tooling.

The export is built purely from the in-memory atlas at click time — no extra SDK calls, no backend, no data leaving the iframe beyond what the editor explicitly saves, opens, or copies (ADR-0016 click-time clone).

## Format types

| Format | Best for | Notes |
|--------|----------|-------|
| **JSON** | Refactor scripts, diffing, machine consumers | Full data — every rendering, page list, datasource list, plus panel-surface page metadata. Schema-versioned (`atlas_export_schema_version: 1`); deterministic key + array order so two snapshots of an unchanged atlas diff cleanly (DoD-3). |
| **CSV** | Spreadsheets, BI tools, quick filtering | Flat lite columns. RFC 4180 quoting. OWASP-style formula-injection guard (string fields starting with `= + - @` are prefixed with `'`). UTF-8, no BOM. |
| **HTML** | Sharing with non-Sitecore stakeholders, PDF | Single self-contained file — inlined CSS, no remote assets, no JavaScript, no remote fonts. Dedicated print stylesheet (11 pt body, repeating table headers, partial-scan badge with `print-color-adjust: exact`). Doubles as the PDF path via the browser's "Save as PDF" print dialog (no client-side PDF library — see ADR-0018). |

The format picker shows a **size hint** when the atlas is large: muted size text from 5–50 MB; warning glyph + "large, may take a moment" from 50 MB up. Below 5 MB no hint is shown.

## Action cluster — Save / Open / Copy

| Action | What it does | Current status |
|--------|--------------|----------------|
| **Save** | Writes a file to the user's Downloads folder via `Blob` + `URL.createObjectURL` + synthetic `<a download>` | Rendered **disabled** — the Cloud Portal host does not pass `allow-downloads` in the iframe sandbox. Tooltip points the editor at Open or Copy. The hook is fully implemented; the moment the platform adds `allow-downloads`, Save lights up with no code change (ADR-0017 + ADR-0021). |
| **Open** | Opens the snapshot in a new browser tab via `window.open` of a Blob URL | Primary path today. Sticky `'blocked'` state if the browser blocks popups for the iframe. |
| **Copy** | Copies the snapshot to the clipboard | `navigator.clipboard.writeText` for JSON / CSV; `ClipboardItem` with `text/html + text/plain` peers for HTML so paste targets get the right flavor. Sticky `'denied'` for the session if the user rejects the clipboard permission prompt. |

The three-action pattern mirrors the sibling **Pageshot** product and was adopted after the T001 spike (2026-05-04) confirmed the canonical Save path is silently blocked in today's iframe sandbox (ADR-0021).

## Filename convention

```
atlas-<tenantSlug>-<surface>-<scope>-<ISO>.<ext>     # widget
atlas-<tenantSlug>-panel-<pageSlug>-<ISO>.<ext>       # panel
```

Tenant slug falls back to `tenant-<last-7-of-tenantId>` when the SDK does not expose a tenant name — resolved via `application.context.resourceAccess[0]`, per ADR-0020.

## Module location

The export module lives at `core/atlas/export/` alongside the existing core engine modules:

```
core/atlas/export/
├── schema-version.ts       # ADR-0019 single source of truth for ATLAS_EXPORT_SCHEMA_VERSION
├── surface-context.ts      # ADR-0016 click-time clone shape
├── header-builder.ts       # Shared metadata block across formats
├── filename-builder.ts     # Slug rules per ADR-0020
├── size-estimator.ts       # Tiered size hint for the format picker
├── build-export.ts         # Pure function — atlas → Blob (ADR-0016)
├── formats/
│   ├── json.ts             # Full data schema; deterministic key order
│   ├── csv.ts              # RFC 4180; formula-injection guard
│   └── html.ts             # Self-contained + print stylesheet; XSS-safe
├── download/
│   ├── trigger-download.ts # ADR-0017 § Primary mechanism
│   └── detect-failure.ts   # 5-second heuristic per ADR-0017 § Detection contract
├── hooks/
│   ├── use-save-export.ts  # Save (future-proof, disabled today)
│   ├── use-open-export.ts  # Open via window.open
│   └── use-copy-export.ts  # Copy via navigator.clipboard
└── telemetry/
    └── events.ts           # emitExportAttempt / Success / Fail wrappers
```

## CI guards added by this feature

- `npm run check:schema-version` — DoD-7: verifies `ATLAS_EXPORT_SCHEMA_VERSION` is declared in exactly one file (ADR-0019).
- `npm run audit:anti-metric` — extended to block three new vanity-KPI strings (`downloads/minute`, `total bytes exported`, `format diversity per editor`) in addition to PRD-000's list.

## Known limitations

- **Save is disabled** — the Marketplace iframe sandbox omits `allow-downloads`. No workaround at the app level; this is a platform-level constraint. Open and Copy are the primary paths today.
- **Bundle delta** — the three-action egress is structurally heavier than the original single-Download spec. The cumulative gzipped delta is estimated at ~38 KB vs the 20 KB cap (NFR-1.4). Tracked for re-measurement with `next-bundle-analyzer`; cap amendment may follow (see `project-planning/workflow/current-run.json` `smoke_outcomes.bundle_cap_dod5`).
- **T047 HTML print-preview gate** — manual Chromium + Firefox + Safari pass against `pocs/poc-v1/html-output-sample.html` is pending; accepted as a permanent caveat on PRD-001 close.
