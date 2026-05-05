# Architecture Decision Records

This directory holds ADRs for this product workspace.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| ADR-0001 | Use ADRs as architecture backbone | Accepted |
| ADR-0002 | Mode A iframe-only — no backend, no Mode B | Accepted |
| ADR-0003 | No persistence in v1 — live in-memory atlas | Accepted |
| ADR-0004 | Two surfaces in one Marketplace app — Dashboard Widget + Page Context Panel | Accepted |
| ADR-0005 | Identity model — rendering = definition ID, datasource = item ID | Accepted |
| ADR-0006 | Direct datasource bindings only in v1 | Accepted |
| ADR-0007 | Use Marketplace Client-Side scaffold (Scaffold 2) | Accepted |
| ADR-0008 | Stay on Next.js + Turbopack — do not switch to Vite | Accepted |
| ADR-0009 | Blok (Sitecore design system) as the UI layer; semantic tokens via registry | Accepted |
| ADR-0010 | Atlas state via module-level singleton + `useSyncExternalStore` pub/sub | Accepted |
| ADR-0011 | Loading visualization in v1 — branded animation | Accepted |
| ADR-0012 | Scan concurrency = 8; exponential backoff with jitter; 12s per-page timeout | Accepted |
| ADR-0013 | Telemetry stays in-iframe — `console.info` markers + in-memory ring buffer | Accepted |
| ADR-0014 | Root route `/` returns `notFound()`; smoke-test rule | Accepted |
| ADR-0015 | Export as v1 feature — supersedes PRD-000 OS-15 | Accepted |
| ADR-0016 | Atlas export construction is a pure function; `surfaceContext` is a click-time clone | Accepted |
| ADR-0017 | Iframe download mechanism + fallback hierarchy | Accepted (superseded in part by ADR-0021 on 2026-05-04 — Save mechanism preserved; F1/F2/F3 cascade replaced) |
| ADR-0018 | No client-side PDF library in v1; HTML + browser print is the only PDF route | Accepted |
| ADR-0019 | Atlas export schema versioning policy | Accepted |
| ADR-0020 | Tenant identity for exports resolves via `application.context.resourceAccess[0]` | Accepted |
| ADR-0021 | Three-action egress pattern (Save + Open + Copy) per pageshot precedent | Accepted |

## Next number

Use the next free four-digit id after the highest existing `adr-*.md`.
