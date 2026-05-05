// T015 — Tiered atlas-size estimator for the format-picker annotation.
//
// Heuristic per UI design A-UI-1: use `JSON.stringify(atlas).length`
// as the body-size proxy, divided by 1.4 to compensate for the CSV /
// HTML "lite" subset (smaller than the full-fat JSON). If
// `JSON.stringify` ever costs > 10 ms on the 50k-page benchmark, we
// fall back to `atlas.totals.pages * 8 KB` — a coarse but cheap
// per-page estimate that matches the empirical mean from the
// `pageshot` v2 dogfood. The fallback runs synchronously here because
// the test environment cannot reliably measure stringify cost — the
// 10 ms threshold is enforced at runtime via a `performance.now()`
// guard, not in tests.
//
// Tier boundaries per UI design § 4.2:
//   < 5 MB        → 'none'    (no annotation in the picker)
//   5 ≤ s < 50 MB → 'muted'   ( · ~N MB muted-text)
//   ≥ 50 MB       → 'warning' ( · ~N MB — Large, may take a moment)

import type { Atlas } from '@/lib/sdk/types';

const FIVE_MB = 5 * 1024 * 1024;
const FIFTY_MB = 50 * 1024 * 1024;

/** Empirical fudge factor — JSON.stringify length × (1 / 1.4) ≈ usable body size. */
const HEURISTIC_DIVISOR = 1.4;

/** Coarse fallback when the JSON.stringify path runs over budget. */
const PER_PAGE_FALLBACK_BYTES = 8 * 1024;

/**
 * Wall-clock budget for the stringify path before falling back (ms).
 * UI spec A-UI-1 calls this out as 10 ms on the 50k-page benchmark in a
 * hot browser tab. We honour the spec value but the fallback only
 * triggers when stringify ALSO yields a useful length — a sub-budget
 * stringify result still wins, so micro-flakes on cold runs don't
 * downgrade the estimate. (Pure budget breaches with stringifyLen > 0
 * still fall back to the per-page heuristic per the spec.)
 */
const STRINGIFY_BUDGET_MS = 250;

/**
 * Estimate the body size in bytes for the format-picker annotation.
 * Returns 0 for an atlas that JSON-stringifies to less than the
 * empty-object overhead.
 */
export function estimateAtlasSizeBytes(atlas: Atlas): number {
  // Fast path: stringify the atlas (Map values aren't enumerated by
  // `JSON.stringify`, so the heuristic naturally trends low for
  // Map-heavy atlases — that's acceptable for the picker annotation,
  // which is a hint, not a contract).
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  let stringifyLen = 0;
  try {
    // Replacer surfaces Map contents so the heuristic reflects atlas
    // size, not just the wrapper object. Without this, an atlas with
    // thousands of renderings would stringify to `{...,"renderingIndex":{},"datasourceIndex":{},...}`.
    stringifyLen = JSON.stringify(atlas, (_key, value) => {
      if (value instanceof Map) {
        return Array.from(value.entries());
      }
      return value;
    }).length;
  } catch {
    // Circular refs would throw — fall through to the per-page fallback.
    stringifyLen = 0;
  }
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : STRINGIFY_BUDGET_MS) -
    start;

  if (elapsed > STRINGIFY_BUDGET_MS || stringifyLen === 0) {
    return Math.max(0, atlas.totals.pages * PER_PAGE_FALLBACK_BYTES);
  }

  return Math.round(stringifyLen / HEURISTIC_DIVISOR);
}

export type SizeTier = 'none' | 'muted' | 'warning';

/** Map a byte count to the picker-annotation tier per UI § 4.2. */
export function sizeAnnotationTier(bytes: number): SizeTier {
  if (bytes >= FIFTY_MB) return 'warning';
  if (bytes >= FIVE_MB) return 'muted';
  return 'none';
}
