# ADR-0012: Scan concurrency = 8; exponential backoff with jitter on rate-limit; 12s per-page timeout

## Status

Accepted

## Context

The scan engine fans out across the active tenant by calling `xmc.agent.pagesGetComponentsOnPage` once per page. PRD FR-1.6 sets the initial concurrency cap at 8 and instructs `Promise.allSettled` for partial-failure tolerance. The architecture phase needs to lock concrete numbers so the Lead Developer's § 4c-3 (Tasks & Sequencing) and the QA Specialist's test plan can cite exact thresholds.

Three numbers must be decided:

1. **Concurrency cap** — how many simultaneous `xmc.agent.pagesGetComponentsOnPage` calls run at peak. Too low: scan time is unnecessarily long. Too high: agent endpoint rate-limits or saturates the editor's connection.
2. **Backoff strategy on rate-limit signals** — when the agent endpoint returns 429 (or equivalent), what does the scan do? Silent retry-loops are forbidden per `xmc.md` § 12 anti-pattern; exponential backoff with jitter is the documented safe path.
3. **Per-page timeout** — how long a single `pagesGetComponentsOnPage` may pend before being classified as `skipped` with reason `timeout`. Too short: false-positive skips on slow agents. Too long: one slow page blocks a slot in the concurrency pool.

There is no documented hard rate limit for `xmc.agent.*` endpoints in the SDK skill set as of 2026-04-27. The numbers below are conservative defaults to be validated against a real tenant during initial scan testing.

## Decision

- **Concurrency cap: 8** simultaneous `xmc.agent.pagesGetComponentsOnPage` calls (FR-1.6 anchor; matches PRD).
- **Backoff: exponential with jitter** when a request returns 429 (or any documented rate-limit signal). Base delay 250ms, doubling each retry, **maximum 4 retries per request**, jitter ±20% of the computed delay. After 4 retries, the request is classified as `skipped` with reason `network_error` (per FR-7.2 typed reasons).
- **Per-page timeout: 12 seconds.** A single `pagesGetComponentsOnPage` call that does not resolve within 12s is aborted via per-request `AbortController` and lands in `skipped[]` with reason `timeout`. The slot is freed for the next page in the queue.
- **Cancel propagation:** the scan-level `AbortController` (per ADR-0010) cancels all in-flight requests; canceled requests do **not** appear in `skipped[]` — they are part of the explicit cancel-with-partial-results flow (US-1 AC-1.2).

Concretely in code:

```ts
const SCAN_CONCURRENCY = 8;
const PER_PAGE_TIMEOUT_MS = 12_000;
const RATE_LIMIT_BACKOFF = {
  baseMs: 250,
  maxRetries: 4,
  jitterPercent: 20,
};
```

These constants live in `core/scan-config.ts`. They are NOT exposed as user-facing settings in v1 (no editor-tunable concurrency); they are tunable in code for the dogfood team.

## Consequences

**Easier:**
- The Lead Developer's § 4c-3 and QA's test scenarios can cite exact numbers (e.g., "verify the scan resolves with 8 concurrent calls; verify a 429 triggers backoff up to 4 retries before classifying as skipped").
- Conservative defaults reduce risk of surprising the agent endpoint at first real-tenant scan.
- Backoff with jitter prevents thundering-herd on rate-limit recovery.
- `skipped[]` typed reasons (`forbidden`, `timeout`, `not_found`, `network_error`, `other`) give the editor surface enough information to render an actionable "Skipped N pages" sub-drawer per FR-7.2.

**Harder:**
- 8 concurrent on a 5k-page tenant means ~625 sequential rounds. At 12s each (worst case), that's 7,500s — clearly worse than acceptable. Mitigation: timeouts are worst-case; typical agent latency is much lower. If the real-tenant scan exceeds NFR-1.1's 30s target on 1k pages, this ADR is the first place to revisit.
- 250ms base backoff can cascade: a single 429 retried 4 times adds up to ~250 + 500 + 1000 + 2000 = 3.75s before classification. On a tenant under sustained rate-limiting, the scan slows visibly. Mitigation: surface the backoff state in the loading visualizer ("Slow connection — retrying" hint per AC-4.4).
- 12s per-page timeout means a slow site with one stalled page can hold a slot for 12s before being freed. With 8 slots, the worst case adds 12s to total scan time per stalled page. Acceptable for v1; revisit if R9 (deep page hierarchies / agent-endpoint timeouts) surfaces in real-tenant testing.

**Forbidden in this ADR:**
- Silent retry-loops without backoff (per `xmc.md` § 12 anti-pattern).
- Concurrency caps higher than 16 without an explicit ADR superseding this one — even if real-tenant testing suggests headroom, the agent-endpoint rate-limit story must be confirmed first.
- Removing the per-page timeout. A single stalled page must not block the scan indefinitely.
- Exposing concurrency as an editor-facing setting in v1. If user-tunable concurrency becomes valuable, that's a separate decision in Phase 2.

## Date

2026-04-27
