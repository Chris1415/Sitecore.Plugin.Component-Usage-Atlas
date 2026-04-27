// T024 — Pure function: produce the four-field atlas core from page refs
// + per-page settled component-fetch results.
//
// Algorithm (per architecture § 4.3):
//   - Single deterministic pass over `pageRefs[i]` paired with
//     `componentResults[i]` (matching index).
//   - Fulfilled results contribute `RenderingUsage` rows (keyed by the
//     SDK's `componentId` per ADR-0005) and `DatasourceUsage` rows
//     (keyed by the literal `dataSource` string per ADR-0006).
//   - Rejected results land in `skipped[]` with a classified reason and
//     do NOT contribute to either index.
//   - Unknown renderings (no `renderingId` on the record) get a
//     synthetic ID `unknown:<page-id>:<placeholder>:<index>` so the
//     widget can group them under the "(unknown rendering)" virtual row
//     (T081, M3+) without losing per-placement detail.
//
// Pure: no SDK imports beyond the type module, no React, no console.

import { classifyError } from '@/core/error-classifier';
import type {
  Atlas,
  ComponentRecord,
  DatasourceId,
  DatasourceUsage,
  PageRef,
  RenderingId,
  RenderingUsage,
  Skipped,
} from '@/lib/sdk/types';

export type BuildIndicesResult = {
  readonly renderingIndex: Map<RenderingId, RenderingUsage>;
  readonly datasourceIndex: Map<DatasourceId, DatasourceUsage>;
  readonly skipped: Skipped[];
  readonly totals: Atlas['totals'];
};

type RenderingAccumulator = {
  renderingId: RenderingId;
  displayName: string;
  isUnknown: boolean;
  pages: PageRef[];
  datasourceSet: Set<DatasourceId>;
};

type DatasourceAccumulator = {
  datasourceId: DatasourceId;
  displayName: string;
  isMissing: boolean;
  pages: PageRef[];
  renderingSet: Set<RenderingId>;
};

const synthesizeUnknownId = (
  pageId: string,
  placeholderKey: string | undefined,
  index: number,
): RenderingId => `unknown:${pageId}:${placeholderKey ?? '_'}:${index}`;

export function buildIndices(
  pageRefs: ReadonlyArray<PageRef>,
  componentResults: ReadonlyArray<PromiseSettledResult<ReadonlyArray<ComponentRecord>>>,
): BuildIndicesResult {
  const renderingAcc = new Map<RenderingId, RenderingAccumulator>();
  const datasourceAcc = new Map<DatasourceId, DatasourceAccumulator>();
  const skipped: Skipped[] = [];
  const distinctSites = new Set<string>();

  const upperBound = Math.min(pageRefs.length, componentResults.length);

  for (let i = 0; i < upperBound; i += 1) {
    const page = pageRefs[i]!;
    const result = componentResults[i]!;
    distinctSites.add(page.siteId);

    if (result.status === 'rejected') {
      skipped.push({
        pageId: page.pageId,
        pageName: page.pageName,
        siteId: page.siteId,
        siteName: page.siteName,
        reason: classifyError(result.reason),
      });
      continue;
    }

    const components = result.value;
    components.forEach((component, placementIndex) => {
      const isUnknown = !component.renderingId;
      const renderingId = component.renderingId
        ?? synthesizeUnknownId(page.pageId, component.placeholderKey, placementIndex);
      const displayName = component.renderingName ?? '(unknown rendering)';

      let r = renderingAcc.get(renderingId);
      if (!r) {
        r = {
          renderingId,
          displayName,
          isUnknown,
          pages: [],
          datasourceSet: new Set(),
        };
        renderingAcc.set(renderingId, r);
      }
      r.pages.push({
        pageId: page.pageId,
        pageName: page.pageName,
        sitePath: page.sitePath,
        siteId: page.siteId,
        siteName: page.siteName,
        placeholderKey: component.placeholderKey,
      });

      const dsId = component.datasourceId;
      if (typeof dsId === 'string' && dsId.length > 0) {
        r.datasourceSet.add(dsId);

        let d = datasourceAcc.get(dsId);
        if (!d) {
          d = {
            datasourceId: dsId,
            displayName: dsId, // resolved separately if at all in v1
            isMissing: false,
            pages: [],
            renderingSet: new Set(),
          };
          datasourceAcc.set(dsId, d);
        }
        d.pages.push({
          pageId: page.pageId,
          pageName: page.pageName,
          sitePath: page.sitePath,
          siteId: page.siteId,
          siteName: page.siteName,
          placeholderKey: component.placeholderKey,
        });
        d.renderingSet.add(renderingId);
      }
    });
  }

  const renderingIndex = new Map<RenderingId, RenderingUsage>();
  for (const [id, acc] of renderingAcc) {
    renderingIndex.set(id, {
      renderingId: acc.renderingId,
      displayName: acc.displayName,
      isUnknown: acc.isUnknown,
      pages: acc.pages,
      datasources: Array.from(acc.datasourceSet),
      totalUsages: acc.pages.length,
    });
  }

  const datasourceIndex = new Map<DatasourceId, DatasourceUsage>();
  for (const [id, acc] of datasourceAcc) {
    datasourceIndex.set(id, {
      datasourceId: acc.datasourceId,
      displayName: acc.displayName,
      isMissing: acc.isMissing,
      pages: acc.pages,
      renderings: Array.from(acc.renderingSet),
    });
  }

  const totals: Atlas['totals'] = {
    sites: distinctSites.size,
    pages: pageRefs.length,
    renderings: renderingIndex.size,
    datasources: datasourceIndex.size,
    skipped: skipped.length,
  };

  return { renderingIndex, datasourceIndex, skipped, totals };
}
