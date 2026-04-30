// T106 — RED tests for `lib/collisions.ts` (lifts to GREEN at T045).
//
// Per § 10 T045: 6 scenarios. Pure utility — given a list of
// RenderingUsage rows, return a Map<RenderingId, { suffix: '· <last-7>' | null }>
// where collisions (same display name across distinct IDs) get suffixed
// and singletons stay null.

import { describe, it, expect } from 'vitest';
import { computeCollisions } from '@/lib/collisions';
import type { PageRef, RenderingUsage } from '@/lib/sdk/types';

const ru = (
  renderingId: string,
  displayName: string,
  pages: ReadonlyArray<PageRef> = [],
): RenderingUsage => ({
  renderingId,
  displayName,
  isUnknown: false,
  pages,
  datasources: [],
  totalUsages: pages.length,
});

describe('computeCollisions', () => {
  it('distinct names → no suffixes (all entries have suffix === null)', () => {
    const out = computeCollisions([
      ru('id-aaaaaaa', 'Hero'),
      ru('id-bbbbbbb', 'Card'),
      ru('id-ccccccc', 'Footer'),
    ]);

    expect(out.get('id-aaaaaaa')?.suffix).toBeNull();
    expect(out.get('id-bbbbbbb')?.suffix).toBeNull();
    expect(out.get('id-ccccccc')?.suffix).toBeNull();
  });

  it('two same name → both rows get `· <last-7>` suffix', () => {
    const out = computeCollisions([
      ru('id-1234567', 'Hero'),
      ru('id-abcdefg', 'Hero'),
    ]);

    expect(out.get('id-1234567')?.suffix).toBe('· 1234567');
    expect(out.get('id-abcdefg')?.suffix).toBe('· abcdefg');
  });

  it('three same name → all three suffixed (last-7 of the rendering ID)', () => {
    // last-7 of 'aaaaaaa1' (8 chars) is 'aaaaaa1'.
    const out = computeCollisions([
      ru('aaaaaaa1', 'Hero'),
      ru('bbbbbbb2', 'Hero'),
      ru('ccccccc3', 'Hero'),
    ]);

    expect(out.get('aaaaaaa1')?.suffix).toBe('· aaaaaa1');
    expect(out.get('bbbbbbb2')?.suffix).toBe('· bbbbbb2');
    expect(out.get('ccccccc3')?.suffix).toBe('· cccccc3');
  });

  it('one rendering → no suffix', () => {
    const out = computeCollisions([ru('only-one', 'Solo')]);
    expect(out.get('only-one')?.suffix).toBeNull();
  });

  it('empty input → empty Map', () => {
    const out = computeCollisions([]);
    expect(out.size).toBe(0);
  });

  it('pure: calling twice with same input returns equal entries', () => {
    const input = [ru('id-1234567', 'Hero'), ru('id-abcdefg', 'Hero')];
    const a = computeCollisions(input);
    const b = computeCollisions(input);
    expect(Array.from(a.entries())).toEqual(Array.from(b.entries()));
  });
});
