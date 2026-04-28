// T023 — Per-page components fetcher.
//
// Thin orchestration wrapper around
// `lib/sdk/queries.ts::queryComponentsOnPage`. The wrapper already
// handles:
//
//   - Rate-limit retries (`withBackoff`, ADR-0012 — base 250ms, max 4
//     retries, jitter ±20%).
//   - Per-page timeout (`PER_PAGE_TIMEOUT_MS = 12_000` per ADR-0012).
//   - OQ-A1 envelope unwrap (`result.data?.data?.components ?? []`).
//   - Field renames into `ComponentRecord` (componentId → renderingId,
//     componentName → renderingName, dataSource → datasourceId,
//     placeholder → placeholderKey).
//   - Abort propagation via `signal`.
//
// This module's job is to live as the engine-side seam: the engine's
// `runWithConcurrency` pool calls `() => fetchComponents(client, ctx,
// page, signal)`. Errors propagate to the pool, which maps them to
// `Promise.allSettled` rejected slots; the index-builder then
// classifies via `error-classifier.ts` and pushes them into
// `Atlas.skipped` per FR-7.2.
//
// SDK shape source (cited fully in queries.ts):
//   `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-agent/types.gen.d.ts`
//     - `PagesGetComponentsOnPageResponses[200] = GetPageComponentsResponse`
//     - `ComponentModel = { id, componentId, componentName, dataSource?, placeholder?, ... }`

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
