// T020 — Sites enumerator.
//
// Thin orchestration around `lib/sdk/queries.ts::queryAllSites` and
// (when scope === 'collection') `queryListCollections`. Returns the
// list of sites the scan should walk, normalized to the `Site`
// Atlas-domain shape.
//
// Per § 4 T020 / § 10 T020:
//   - scope `'all-collections'` → call `queryAllSites` only.
//   - scope `'collection'` → call BOTH and filter by `collectionId`.
//   - empty filter result → return `[]` (caller decides what to do).
//
// `siteName` is preserved on every returned `Site` because the page
// list endpoint keys by name, not id (architecture § 5.5).
//
// SDK shape sources cited in `lib/sdk/queries.ts`:
//   - `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-agent/types.gen.d.ts`
//     (sites/list — lean: id/name/targetHostname/rootPath only)
//   - `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-sites/types.gen.d.ts`
//     (collections — id/name/displayName)
//
// The lean agent endpoint does NOT carry `collectionId`. To resolve a
// site's collection we cross-reference with the collections list. The
// agent endpoint also lacks `displayName`, so we fall back to
// `siteName` for editor-facing rendering until/unless a per-site
// `retrieveSite` call (T021) supplies it.

import type { ClientSDK } from '@sitecore-marketplace-sdk/client';

import {
  queryAllSites,
  queryListCollections,
  queryRetrieveSite,
} from '@/lib/sdk/queries';
import type { AtlasScope, Site } from '@/lib/sdk/types';

export async function enumerateSites(
  client: ClientSDK,
  contextId: string,
  scope: AtlasScope,
): Promise<ReadonlyArray<Site>> {
  const summaries = await queryAllSites(client, contextId);

  if (scope.kind === 'all-collections') {
    // Cheapest path — return the lean shape directly. Display name is
    // promoted from `siteName` until/unless `retrieveSite` enriches it
    // during language resolution.
    return summaries.map(
      (s): Site => ({
        siteId: s.siteId,
        siteName: s.siteName,
        displayName: s.siteName,
      }),
    );
  }

  if (scope.kind === 'site') {
    // S21 — narrow the enumeration to the single site whose name matches
    // the host context. If the host's site isn't in the tenant's site
    // list (revoked permissions, draft state, etc.), return [] — the
    // surface renders the empty-state copy.
    const match = summaries.find((s) => s.siteName === scope.siteName);
    if (!match) return [];
    return [
      {
        siteId: match.siteId,
        siteName: match.siteName,
        displayName: match.siteName,
      },
    ];
  }

  // scope.kind === 'collection' — we need each site's `collectionId` to
  // filter. The lean agent endpoint doesn't supply it, so for each
  // site we issue `retrieveSite` (which carries `collectionId`).
  // `Promise.allSettled` so a single broken site doesn't abort the
  // whole filter — a rejected `retrieveSite` simply excludes that site
  // from the filter result (it will surface in the next phase if it
  // genuinely has no permissions, etc.).
  const collectionIdToMatch = scope.collectionId;
  const detailResults = await Promise.allSettled(
    summaries.map((s) => queryRetrieveSite(client, contextId, s.siteId)),
  );

  const filtered: Site[] = [];
  detailResults.forEach((result, index) => {
    const summary = summaries[index]!;
    if (result.status !== 'fulfilled') return;
    const detail = result.value;
    if (detail.collectionId !== collectionIdToMatch) return;
    filtered.push({
      siteId: summary.siteId,
      siteName: summary.siteName,
      displayName: detail.displayName ?? summary.siteName,
      collectionId: detail.collectionId,
    });
  });

  // Touch `queryListCollections` only as a sanity check that the
  // scoped collection actually exists in the tenant — if it doesn't
  // (e.g. it was deleted between widget mount and refresh), we return
  // the filtered list as-is. The widget's scope picker (T047) is the
  // arbiter of whether the dropdown reflects reality.
  await queryListCollections(client, contextId).catch(() => []);

  return filtered;
}
