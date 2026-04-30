// T026 RED+GREEN — Inline tests for `core/atlas-freeze.ts`.
//
// Behaviors covered (per § 10 T026 + § 4 T026):
//   1. `freezeAtlas(atlas)` returns the same atlas reference (in-place
//      freeze — implementation choice; we picked in-place to avoid
//      wasted clones on a hot path).
//   2. The returned object is `Object.isFrozen(...)`.
//   3. Attempting to mutate the renderingIndex Map throws (Maps cannot
//      be naturally frozen — the wrapper replaces `set` / `delete` /
//      `clear` with throwing stubs in dev so tests catch UI mutations).
//   4. The same applies to `datasourceIndex` and `skipped`.

import { describe, expect, it } from 'vitest';

import { freezeAtlas } from '@/core/atlas-freeze';
import type { Atlas } from '@/lib/sdk/types';

const buildAtlas = (): Atlas => ({
  scope: { kind: 'all-collections' },
  scannedAt: 1_700_000_000_000,
  isPartial: false,
  renderingIndex: new Map([
    [
      'r1',
      {
        renderingId: 'r1',
        displayName: 'Hero',
        isUnknown: false,
        pages: [],
        datasources: [],
        totalUsages: 0,
      },
    ],
  ]),
  datasourceIndex: new Map([
    [
      'd1',
      {
        datasourceId: 'd1',
        displayName: 'Hero datasource',
        isMissing: false,
        pages: [],
        renderings: [],
      },
    ],
  ]),
  skipped: [],
  totals: { sites: 0, pages: 0, renderings: 1, datasources: 1, skipped: 0 },
});

describe('freezeAtlas', () => {
  it('returns the same atlas reference (in-place freeze)', () => {
    const atlas = buildAtlas();
    const frozen = freezeAtlas(atlas);
    expect(frozen).toBe(atlas);
  });

  it('marks the returned root as frozen', () => {
    const atlas = freezeAtlas(buildAtlas());
    expect(Object.isFrozen(atlas)).toBe(true);
  });

  it('throws when mutating the renderingIndex Map via .set()', () => {
    const atlas = freezeAtlas(buildAtlas());
    expect(() =>
      (atlas.renderingIndex as Map<string, never>).set('r2', null as never),
    ).toThrow();
  });

  it('throws when calling .delete() on the renderingIndex Map', () => {
    const atlas = freezeAtlas(buildAtlas());
    expect(() => (atlas.renderingIndex as Map<string, never>).delete('r1')).toThrow();
  });

  it('throws when calling .clear() on the datasourceIndex Map', () => {
    const atlas = freezeAtlas(buildAtlas());
    expect(() => (atlas.datasourceIndex as Map<string, never>).clear()).toThrow();
  });

  it('throws when pushing onto skipped (read-only array)', () => {
    const atlas = freezeAtlas(buildAtlas());
    expect(() => (atlas.skipped as Array<never>).push(null as never)).toThrow();
  });
});
