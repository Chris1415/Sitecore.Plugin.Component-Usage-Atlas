# Cloud Portal Registration — Component Usage Atlas

> One Marketplace app registration covers both surfaces (ADR-0004). This doc covers the extension-point paths, required API scopes, role requirements, and smoke-test status.

## Extension-point paths

When registering the app in **Cloud Portal → App Studio**, paste these surface paths into the corresponding extension-point configuration:

| Extension point | Path |
|-----------------|------|
| `xmc:dashboardblocks` (Dashboard Widget) | `/widget` |
| `xmc:pages:context-panel` (Page Context Panel) | `/panel` |

Both extension points were registered as part of PRD-000 and are unchanged by PRD-001.

## Required API access scopes

Request these XMC scopes at registration time:

- `xmc.agent.read` — read access to the agent endpoints (`sitesGetSitesList`, `sitesGetAllPagesBySite`, `pagesGetComponentsOnPage`).
- `xmc.sites.read` — read access to site / collection metadata (`listCollections`, `retrieveSite`).

No write scopes are needed. The atlas is pull-only by design (ADR-0002).

## Required role to install

Installing the app at the organization level requires **Organization Admin** or **Organization Owner** role on the Sitecore tenant. Editors do not need elevated rights to use the surfaces once the app is installed.

## Smoke-test status

Real-tenant smoke (deploy → register → clipped-iframe screenshot vs POC on five host-frame-testing axes) is the final verification gate before the app is considered shipped end-to-end. Status is recorded in `project-planning/workflow/current-run.json` under `smoke_outcomes`.

| Gate | Outcome | Notes |
|------|---------|-------|
| `T092_vercel_deploy` | — | — |
| `T093_cloud_portal_registration` | — | — |
| `T094_real_tenant_smoke` | `pass_with_caveats` | Verified against `solo-website` via ngrok dev origin. |
| `T113_manual_test_plan` | — | — |
| `t047_html_print_preview` | `skipped` (won't-do) | Manual print-preview gate; accepted caveat on PRD-001 close. |
| `t048_host_frame_smoke` | `skipped` (won't-do) | Host URL not supplied + POC re-spin needed; accepted caveat. |
| `live_walkthrough` | `skipped` (won't-do) | Accepted caveat on PRD-001 close. |
| `bundle_cap_dod5` | `skipped` (won't-do) | ~38 KB estimated vs 20 KB cap; accepted caveat, re-measure with `next-bundle-analyzer` in a future PRD. |

See [`docs/operations.md`](operations.md) for the full list of accepted caveats and their remediation paths.
