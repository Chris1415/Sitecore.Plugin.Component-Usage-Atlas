// T022 — Pages enumerator (one site → flat list of pages).
//
// Thin wrapper around `lib/sdk/queries.ts::queryAllPagesBySite`. The
// hard work — path mapping, abort handling, name derivation — happens
// in the wrapper. This module exists to give the engine an
// orchestration seam that mirrors `sites-enumerator` and
// `components-fetcher` (so swapping the SDK boundary in Phase 2 only
// changes the queries module).
//
// Per OQ-A2 (M2 friction log T005): the SDK returns a FLAT
// `Array<PageModel>` with NO pagination — there is no continuation
// token. The earlier § 4c-6.5 prose hinting at a paginated loop is
// dead code in v1. We do NOT loop — we make ONE call per (site,
// language) pair.
//
// Per-site failure tolerance: if `queryAllPagesBySite` rejects, the
// caller (T027 scan-engine) collects the failure as a site-level
// fault (NOT a page-level skip — sites without pages don't surface in
// `Atlas.skipped` because we never knew which page IDs belonged to
// them). This module just propagates the error.
//
// SDK shape source:
//   `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-agent/types.gen.d.ts`
//     - `SitesGetAllPagesBySiteResponses[200] = Array<PageModel>`
//     - `PageModel = { id: string; path: string }`

import type { ClientSDK } from '@sitecore-marketplace-sdk/client';

import { queryAllPagesBySite } from '@/lib/sdk/queries';
import type { PageStub, Site } from '@/lib/sdk/types';

export async function enumeratePages(
  client: ClientSDK,
  contextId: string,
  site: Site,
  language: string,
  signal: AbortSignal,
): Promise<ReadonlyArray<PageStub>> {
  return queryAllPagesBySite(
    client,
    contextId,
    {
      siteId: site.siteId,
      siteName: site.siteName,
      collectionId: site.collectionId,
    },
    language,
    signal,
  );
}
