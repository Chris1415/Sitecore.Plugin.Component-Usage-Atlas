// T016 — RED unit tests for `core/atlas/export/size-estimator.ts`
// (lifts to GREEN at T015).
//
// Per § 10 T016: 5 case groups. The estimator is heuristic per A-UI-1
// (use `JSON.stringify(atlas).length / 1.4` as the body-size proxy);
// the tier function classifies via § 4.2 boundaries:
//   < 5 MB        → 'none'   (no annotation)
//   5 ≤ s < 50 MB → 'muted'  (size text only)
//   ≥ 50 MB       → 'warning' (size text + warning glyph)
//
// We test BOTH `estimateAtlasSizeBytes` and `sizeAnnotationTier` for
// each tier — neither can be a tautology per § 9.8.
//
// SDK fixture provenance: N/A — uses synthetic JSON-stringifiable
// shapes, not real SDK responses.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  estimateAtlasSizeBytes,
  sizeAnnotationTier,
} from '@/core/atlas/export/size-estimator';
import type { Atlas } from '@/lib/sdk/types';

// Stub `performance.now()` so elapsed is always 0. The estimator falls back to
// `pages * 8 KB` when stringify time exceeds the 250ms budget — fine in
// production, but stringifying a 112 MB synthetic atlas in jsdom under full-
// suite GC pressure can slip past that threshold and downgrade the estimate
// to 0 (synthetic atlases use totals.pages = 0). The fallback path is
// covered separately; this suite tests the heuristic path deterministically.
beforeEach(() => {
  vi.spyOn(performance, 'now').mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const FIVE_MB = 5 * 1024 * 1024;
const FIFTY_MB = 50 * 1024 * 1024;

const emptyAtlas = (): Atlas => ({
  scope: { kind: 'all-collections' },
  scannedAt: 1_700_000_000_000,
  isPartial: false,
  renderingIndex: new Map(),
  datasourceIndex: new Map(),
  skipped: [],
  totals: { sites: 0, pages: 0, renderings: 0, datasources: 0, skipped: 0 },
});

/**
 * Build a synthetic atlas whose `JSON.stringify(...).length` lands at
 * approximately `targetBytes`. The estimator divides the stringify
 * length by 1.4 (heuristic), so we size the synthetic payload ~1.4×
 * the desired estimate. We bypass the type system (cast to Atlas) so
 * we can stuff the totals and a single fat string field with arbitrary
 * size — the estimator only cares about the JSON.stringify length, not
 * the structural validity of the atlas.
 */
const synthAtlasOfStringifyLength = (targetStringifyBytes: number): Atlas => {
  // overhead from the wrapping `{}`, "filler":"" etc.
  const overhead = 32;
  const fillerLen = Math.max(0, targetStringifyBytes - overhead);
  const filler = 'x'.repeat(fillerLen);
  return {
    ...emptyAtlas(),
    // Cast through unknown — the estimator reads `JSON.stringify(atlas)`,
    // so the structural extra prop is fine for the heuristic test.
    ...({ filler } as unknown as Partial<Atlas>),
  } as Atlas;
};

describe('estimateAtlasSizeBytes', () => {
  it('empty atlas → near 0 bytes; tier "none"', () => {
    const atlas = emptyAtlas();
    const bytes = estimateAtlasSizeBytes(atlas);
    expect(bytes).toBeGreaterThanOrEqual(0);
    expect(bytes).toBeLessThan(FIVE_MB);
    expect(sizeAnnotationTier(bytes)).toBe('none');
  });

  it('tiny fixture (~1 KB JSON) → tier "none"', () => {
    const atlas = synthAtlasOfStringifyLength(1024);
    const bytes = estimateAtlasSizeBytes(atlas);
    // 1024 / 1.4 ≈ 731 bytes — well under 5 MB
    expect(bytes).toBeLessThan(FIVE_MB);
    expect(sizeAnnotationTier(bytes)).toBe('none');
  });

  it('mid fixture (~7 MB body) → tier "muted"', () => {
    // We want `bytes` (after / 1.4 division) to land between 5 MB and
    // 50 MB. Choose stringify length ≈ 10 MB → bytes ≈ 7.14 MB.
    const atlas = synthAtlasOfStringifyLength(10 * 1024 * 1024);
    const bytes = estimateAtlasSizeBytes(atlas);
    expect(bytes).toBeGreaterThanOrEqual(FIVE_MB);
    expect(bytes).toBeLessThan(FIFTY_MB);
    expect(sizeAnnotationTier(bytes)).toBe('muted');
  });

  it('large fixture (~80 MB body) → tier "warning"', () => {
    // stringify length ~112 MB → bytes ~80 MB
    const atlas = synthAtlasOfStringifyLength(112 * 1024 * 1024);
    const bytes = estimateAtlasSizeBytes(atlas);
    expect(bytes).toBeGreaterThanOrEqual(FIFTY_MB);
    expect(sizeAnnotationTier(bytes)).toBe('warning');
  });
});

describe('sizeAnnotationTier — boundary precision', () => {
  it('4.99 MB → "none"', () => {
    expect(sizeAnnotationTier(FIVE_MB - 1)).toBe('none');
  });

  it('exactly 5.00 MB → "muted"', () => {
    expect(sizeAnnotationTier(FIVE_MB)).toBe('muted');
  });

  it('49.99 MB → "muted"', () => {
    expect(sizeAnnotationTier(FIFTY_MB - 1)).toBe('muted');
  });

  it('exactly 50.00 MB → "warning"', () => {
    expect(sizeAnnotationTier(FIFTY_MB)).toBe('warning');
  });
});
