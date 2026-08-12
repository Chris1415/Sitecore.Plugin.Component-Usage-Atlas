/**
 * Per-page components fetcher — the engine-side seam over queryComponentsOnPage.
 * The wrapper already owns rate-limit retry, the 12s per-page timeout, the
 * envelope unwrap and the field renames; errors propagate to the concurrency
 * pool. See docs/build-decisions.md#failure-classification.
 */

import type { ClientSDK } from '@sitecore-marketplace-sdk/client';

import type { ScanSurface } from '@/core/scan-config';
import { queryComponentsOnPage } from '@/lib/sdk/queries';
import type { ComponentRecord, PageStub } from '@/lib/sdk/types';

export async function fetchComponents(
  client: ClientSDK,
  contextId: string,
  page: PageStub,
  signal: AbortSignal,
  surface?: ScanSurface,
): Promise<ReadonlyArray<ComponentRecord>> {
  return queryComponentsOnPage(
    client,
    contextId,
    page.pageId,
    page.language,
    signal,
    surface,
  );
}
