/**
 * Pages enumerator. The SDK returns a FLAT array with NO pagination — there is
 * no continuation token, so this makes ONE call per (site, language) pair and
 * does not loop. A failure here is a SITE-level fault, not a page-level skip.
 * See docs/build-decisions.md#failure-classification.
 */

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
