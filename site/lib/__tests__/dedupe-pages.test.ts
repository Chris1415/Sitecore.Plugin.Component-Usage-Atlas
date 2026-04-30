// S14 — coverage for the page-list dedupe helper.

import { describe, it, expect } from 'vitest';
import { dedupePages } from '@/lib/dedupe-pages';
import type { PageRef } from '@/lib/sdk/types';

const ref = (over: Partial<PageRef> & { pageId: string }): PageRef => ({
  pageId: over.pageId,
  pageName: over.pageName ?? 'Page',
  sitePath: over.sitePath ?? '/',
  siteId: over.siteId ?? 's1',
  siteName: over.siteName ?? 'site',
});

describe('dedupePages', () => {
  it('returns one entry per distinct pageId with the placement count', () => {
    const out = dedupePages([
      ref({ pageId: 'p1', pageName: 'Home' }),
      ref({ pageId: 'p1', pageName: 'Home' }),
      ref({ pageId: 'p1', pageName: 'Home' }),
      ref({ pageId: 'p2', pageName: 'About' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ pageId: 'p1', placements: 3 });
    expect(out[1]).toMatchObject({ pageId: 'p2', placements: 1 });
  });

  it('preserves first-seen page metadata (name/site/path)', () => {
    const out = dedupePages([
      ref({ pageId: 'p1', pageName: 'Home',  sitePath: '/',     siteName: 'one' }),
      ref({ pageId: 'p1', pageName: 'OTHER', sitePath: '/x',    siteName: 'two' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      pageId: 'p1',
      pageName: 'Home',
      sitePath: '/',
      siteName: 'one',
      placements: 2,
    });
  });

  it('handles an empty input', () => {
    expect(dedupePages([])).toEqual([]);
  });
});
