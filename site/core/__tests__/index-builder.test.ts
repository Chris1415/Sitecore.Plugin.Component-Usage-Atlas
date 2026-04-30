// T100 — RED tests for `core/index-builder.ts` (lifts to GREEN at T024).
//
// Per § 9.1 / § 10 T024: 10 scenarios. The implementation under test is a
// pure function that ingests page refs + per-page settled component-fetch
// results and produces the four-field atlas core.
//
// These tests are committed in failing state and lifted by T024 (M3).

import { describe, it, expect } from 'vitest';
import { buildIndices } from '@/core/index-builder';
import type { ComponentRecord, PageRef } from '@/lib/sdk/types';

const makePage = (id: string, n: number): PageRef => ({
  pageId: id,
  pageName: `Page ${n}`,
  sitePath: `/page-${n}`,
  siteId: 'site-A',
  siteName: 'site-a',
});

const fulfilled = <T>(value: T): PromiseFulfilledResult<T> => ({
  status: 'fulfilled',
  value,
});

const rejected = (reason: unknown): PromiseRejectedResult => ({
  status: 'rejected',
  reason,
});

describe('buildIndices', () => {
  it('one rendering on N pages → renderingIndex has it once with pages.length === N', () => {
    const pages: PageRef[] = [makePage('p1', 1), makePage('p2', 2), makePage('p3', 3)];
    const results = pages.map(() =>
      fulfilled<ReadonlyArray<ComponentRecord>>([
        { placementId: 'plc-1', renderingId: 'r-hero', renderingName: 'Hero' },
      ]),
    );

    const out = buildIndices(pages, results);

    expect(out.renderingIndex.size).toBe(1);
    const usage = out.renderingIndex.get('r-hero');
    expect(usage).toBeDefined();
    expect(usage?.pages.length).toBe(3);
    expect(usage?.totalUsages).toBe(3);
  });

  it('datasource bound on rendering → both indices populated and cross-referenced', () => {
    const pages: PageRef[] = [makePage('p1', 1)];
    const results = [
      fulfilled<ReadonlyArray<ComponentRecord>>([
        {
          placementId: 'plc-1',
          renderingId: 'r-card',
          renderingName: 'Card',
          datasourceId: 'ds-1',
        },
      ]),
    ];

    const out = buildIndices(pages, results);

    const r = out.renderingIndex.get('r-card');
    const d = out.datasourceIndex.get('ds-1');
    expect(r?.datasources).toContain('ds-1');
    expect(d?.renderings).toContain('r-card');
  });

  it('per-page rejected promise → skipped[] entry with classified reason; renderings on that page NOT counted', () => {
    const pages: PageRef[] = [makePage('p1', 1), makePage('p2', 2)];
    const err = Object.assign(new Error('forbidden'), { status: 403 });
    const results = [
      fulfilled<ReadonlyArray<ComponentRecord>>([
        { placementId: 'plc-1', renderingId: 'r-hero', renderingName: 'Hero' },
      ]),
      rejected(err),
    ];

    const out = buildIndices(pages, results);

    expect(out.skipped.length).toBe(1);
    expect(out.skipped[0]?.pageId).toBe('p2');
    expect(out.renderingIndex.get('r-hero')?.pages.length).toBe(1);
  });

  it('unknown rendering → synthetic ID `unknown:<page-id>:<placeholder>:<index>` and isUnknown: true', () => {
    const pages: PageRef[] = [makePage('p1', 1)];
    const results = [
      fulfilled<ReadonlyArray<ComponentRecord>>([
        { placementId: 'plc-1', placeholderKey: 'main' },
      ]),
    ];

    const out = buildIndices(pages, results);

    expect(out.renderingIndex.size).toBe(1);
    const [first] = Array.from(out.renderingIndex.values());
    expect(first?.isUnknown).toBe(true);
    expect(first?.renderingId).toMatch(/^unknown:p1:main:0$/);
  });

  it('multiple unknowns on one page in different placeholders → distinct synthetic IDs', () => {
    const pages: PageRef[] = [makePage('p1', 1)];
    const results = [
      fulfilled<ReadonlyArray<ComponentRecord>>([
        { placementId: 'plc-1', placeholderKey: 'main' },
        { placementId: 'plc-2', placeholderKey: 'aside' },
      ]),
    ];

    const out = buildIndices(pages, results);

    expect(out.renderingIndex.size).toBe(2);
    const ids = Array.from(out.renderingIndex.keys());
    expect(ids).toEqual(expect.arrayContaining([
      expect.stringMatching(/^unknown:p1:main:0$/),
      expect.stringMatching(/^unknown:p1:aside:1$/),
    ]));
  });

  it('inherited / token / personalized bindings absent: no datasourceId on the record → datasourceIndex stays empty', () => {
    // FR-8.2 / E8-T4 / ADR-0006 — only direct (literal `dataSource`) bindings
    // count. Records that arrive without a `datasourceId` (because the SDK
    // only returns the placement-level `dataSource` string, see CATALOG Run 11
    // OQ-A1) must not contribute to the datasource index.
    const pages: PageRef[] = [makePage('p1', 1)];
    const results = [
      fulfilled<ReadonlyArray<ComponentRecord>>([
        { placementId: 'plc-1', renderingId: 'r-hero', renderingName: 'Hero' },
      ]),
    ];

    const out = buildIndices(pages, results);

    expect(out.datasourceIndex.size).toBe(0);
  });

  it('totals computed correctly: sites, pages, renderings, datasources, skipped', () => {
    const pages: PageRef[] = [
      { ...makePage('p1', 1), siteId: 's1' },
      { ...makePage('p2', 2), siteId: 's1' },
      { ...makePage('p3', 3), siteId: 's2' },
    ];
    const results = [
      fulfilled<ReadonlyArray<ComponentRecord>>([
        { placementId: 'a', renderingId: 'r1', renderingName: 'R1', datasourceId: 'd1' },
      ]),
      fulfilled<ReadonlyArray<ComponentRecord>>([
        { placementId: 'b', renderingId: 'r2', renderingName: 'R2' },
      ]),
      rejected(Object.assign(new Error('not_found'), { status: 404 })),
    ];

    const out = buildIndices(pages, results);

    expect(out.totals.sites).toBe(2);
    expect(out.totals.pages).toBe(3);
    expect(out.totals.renderings).toBe(out.renderingIndex.size);
    expect(out.totals.datasources).toBe(out.datasourceIndex.size);
    expect(out.totals.skipped).toBe(1);
  });

  it('deterministic ordering: same input twice yields identical key order', () => {
    const pages: PageRef[] = [makePage('p1', 1), makePage('p2', 2)];
    const results = [
      fulfilled<ReadonlyArray<ComponentRecord>>([
        { placementId: 'a', renderingId: 'r-a', renderingName: 'A' },
        { placementId: 'b', renderingId: 'r-b', renderingName: 'B' },
      ]),
      fulfilled<ReadonlyArray<ComponentRecord>>([
        { placementId: 'c', renderingId: 'r-a', renderingName: 'A' },
      ]),
    ];

    const o1 = buildIndices(pages, results);
    const o2 = buildIndices(pages, results);

    expect(Array.from(o1.renderingIndex.keys())).toEqual(Array.from(o2.renderingIndex.keys()));
  });

  it('empty input → all-empty atlas; totals.pages === 0', () => {
    const out = buildIndices([], []);
    expect(out.renderingIndex.size).toBe(0);
    expect(out.datasourceIndex.size).toBe(0);
    expect(out.skipped.length).toBe(0);
    expect(out.totals.pages).toBe(0);
    expect(out.totals.renderings).toBe(0);
    expect(out.totals.datasources).toBe(0);
    expect(out.totals.skipped).toBe(0);
  });

  // Note: scenario (j) "no SDK imports / React / console.* in source" is a
  // structural regression and is verified by `npm run lint` + cross-layer
  // import rule from § 4c-5 + the anti-metric guard at T075. Not asserted
  // inline — this is a build-time concern, not a run-time one.
});
