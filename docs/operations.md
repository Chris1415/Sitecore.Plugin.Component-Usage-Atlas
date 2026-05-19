# Operations — Component Usage Atlas

> Operational guidance for developers, contributors, and anyone running or deploying the app. For architecture decisions see [`docs/architecture.md`](architecture.md). For Cloud Portal registration see [`docs/registration.md`](registration.md).

## Local smoke-test rule

Always hit one of the surface routes directly. The application root `/` returns Next.js `notFound()` by design (ADR-0014); a 404 there is correct, not a bug.

```bash
cd products/component-usage-atlas/site
npm run dev
# then open ONE of:
#   http://localhost:3000/widget   — Dashboard Widget surface
#   http://localhost:3000/panel    — Page Context Panel surface
# DO NOT open http://localhost:3000/ — it is unreachable on purpose.
```

Outside the Cloud Portal iframe, `<MarketplaceProvider>` shows its connecting loader and never resolves — that is expected. To exercise the real SDK handshake, install the app into a Cloud Portal tenant and load the surface from inside the portal.

## CI commands

```bash
npm run lint                 # ESLint
npm run typecheck            # tsc --noEmit
npm run test                 # Vitest (jsdom env)
npm run build                # Next.js production build (4 static routes)
npm run audit:network        # Grep gate — no raw fetch / XHR / sendBeacon outside SDK
npm run audit:anti-metric    # Grep gate — no forbidden vanity-KPI strings
npm run check:schema-version # DoD-7 — ATLAS_EXPORT_SCHEMA_VERSION declared in exactly one file
npm run ci                   # Composite: lint + typecheck + test + build + all audits
```

## Network egress rule

The app has **zero external network egress** beyond the Marketplace SDK. All HTTP calls route through `@sitecore-marketplace-sdk/xmc` methods. Direct `fetch`, `XMLHttpRequest`, and `sendBeacon` calls in `core/`, `lib/`, `components/`, and `app/` are a CI-failing violation caught by `npm run audit:network`.

Telemetry is entirely in-iframe: a 500-event FIFO ring buffer plus `console.info("[CUA]", …)` mirrors. No `postMessage` to the host frame. See ADR-0013.

## Theming

The app inherits Sitecore Blok's Nova preset via the shadcn registry. Dark / light / system theme are controlled by the host Cloud Portal frame — the app does not ship its own theme toggle. The `NEXT_PUBLIC_SHOW_THEME_TOGGLE` env var controls a local-only override for development.

## Debug panel

Append `?debug=1` to any surface URL to open the `<DebugPanel />` and inspect the in-memory telemetry ring buffer.

## Known limitations and accepted caveats

The following items were accepted as permanent caveats when PRD-001 was closed (2026-05-08). They are tracked in `project-planning/workflow/current-run.json` under `smoke_outcomes`.

| Item | Status | Notes |
|------|--------|-------|
| **Save action disabled** | Platform limitation | The Marketplace iframe sandbox omits `allow-downloads`. Open and Copy are the primary egress paths. No app-level fix is possible; the hook is future-proof and will auto-enable when the platform adds `allow-downloads`. |
| **Bundle delta vs NFR-1.4** | Accepted | Three-action egress (~38 KB gzipped estimated) exceeds the original 20 KB cap. Cap was sized for a single Download button; the three-action pattern is structurally heavier. Re-measure with `next-bundle-analyzer` or amend NFR-1.4 in a future PRD. |
| **T047 HTML print-preview** | Won't-do | Manual Chromium + Firefox + Safari pass against `pocs/poc-v1/html-output-sample.html` was not completed. Reference file exists; surface for a future revival if needed. |
| **T048 host-frame visual smoke** | Won't-do | Clipped iframe screenshot comparison against `pocs/poc-v1/` was not completed. Blocked on: (a) host URL not supplied and (b) POC re-spin required (existing frames show pre-fork single-Download UX). |
| **Live walkthrough** | Won't-do | Mandatory 5-minute real-editor drive of the installed app. Not completed; accepted with the PRD-001 close. |
