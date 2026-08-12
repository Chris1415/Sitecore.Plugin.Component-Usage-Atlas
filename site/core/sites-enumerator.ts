/**
 * Sites enumerator. siteName is preserved on every returned Site because the
 * page-list endpoint keys by NAME, not id.
 *
 * The lean agent endpoint carries no collectionId and no displayName, so a
 * site's collection is resolved by cross-referencing the collections list.
 * See docs/build-decisions.md#double-unwrap.
 */

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
