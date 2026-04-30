// S14 — collapse a list of `PageRef` placements into one entry per distinct
// page, carrying the placement count. Used by all three detail surfaces
// (rendering drawer, datasource drawer, widget inline detail) so a page
// that hosts multiple placements of the same rendering / binds the same
// datasource multiple times shows up ONCE with an "×N" badge.

import type { PageRef } from '@/lib/sdk/types';

export type DedupedPage = {
  readonly pageId: string;
  readonly pageName: string;
  readonly siteName: string;
  readonly sitePath: string;
  readonly placements: number;
};

export function dedupePages(
  pages: ReadonlyArray<PageRef>,
): ReadonlyArray<DedupedPage> {
  type Acc = {
    pageId: string;
    pageName: string;
    siteName: string;
    sitePath: string;
    placements: number;
  };
  const seen = new Map<string, Acc>();
  for (const p of pages) {
    const existing = seen.get(p.pageId);
    if (existing) {
      existing.placements += 1;
      continue;
    }
    seen.set(p.pageId, {
      pageId: p.pageId,
      pageName: p.pageName,
      siteName: p.siteName,
      sitePath: p.sitePath,
      placements: 1,
    });
  }
  return Array.from(seen.values());
}
