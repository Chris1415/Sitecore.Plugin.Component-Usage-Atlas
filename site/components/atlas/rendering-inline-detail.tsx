'use client';

// D2 / v1 — `<RenderingInlineDetail />`.
//
// Inline expansion panel rendered directly under the open row in the
// widget table (replaces the right-side drawer on the dashboard surface,
// which wastes the wide canvas). Anatomy mirrors `pocs/poc-widget-detail-v1`:
//
//   - Header: rendering name + summary (distinct pages · placements · datasources) + Close button.
//   - Direct-bindings affordance.
//   - Two-column body:
//       Left  — Direct rendering usage · N pages
//               One row per UNIQUE page (S14 dedupe by pageId), with `×N`
//               badge when multiple placements exist on that page.
//       Right — Datasources · M
//               One row per distinct datasource bound by any placement of
//               this rendering, color-tagged + page-count badge.
//
// Click a page row → emits `onNavigate(pageId)`; the widget surface wires
// that to `client.mutate('pages.context', { params: { itemId } })`.
//
// Stays surface-agnostic — the widget surface owns expand/collapse state.

import type * as React from 'react';
import { useMemo, useState } from 'react';
import type { ClientSDK } from '@sitecore-marketplace-sdk/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DirectBindingsAffordance } from '@/components/atlas/direct-bindings-affordance';
import { datasourceTagColor } from '@/lib/datasource-tag';
import { dedupePages } from '@/lib/dedupe-pages';
import { cn } from '@/lib/utils';
import { useDatasourceNames } from '@/core/use-datasource-names';
import type { Atlas, RenderingUsage } from '@/lib/sdk/types';

export type RenderingInlineDetailProps = {
  readonly rendering: RenderingUsage;
  readonly atlas: Atlas | null;
  readonly forbiddenPageIds?: ReadonlySet<string>;
  readonly onClose: () => void;
  readonly onNavigate: (pageId: string) => void;
  // S22 — when the surface threads its SDK client + contextId, the inline
  // detail lazily resolves GUID/path-shaped datasources to real Sitecore
  // display names via the Authoring API (matches panel-surface behaviour).
  readonly client?: ClientSDK | null;
  readonly contextId?: string | null;
};

export function RenderingInlineDetail({
  rendering,
  atlas,
  forbiddenPageIds,
  onClose,
  onNavigate,
  client,
  contextId,
}: RenderingInlineDetailProps): React.ReactElement {
  const dedupedPages = useMemo(() => dedupePages(rendering.pages), [rendering.pages]);

  // S19/S20 — internal hover state so hovering a datasource row on the
  // right lights up the matching page rows on the left. `pagesByDsId`
  // maps a datasource id → the set of page ids that bind it (computed
  // from the atlas's datasource index, scoped to pages this rendering
  // appears on).
  const [hoveredDatasourceId, setHoveredDatasourceId] = useState<string | null>(
    null,
  );
  const pagesByDsId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!atlas) return map;
    const renderingPageIds = new Set(rendering.pages.map((p) => p.pageId));
    for (const dsId of rendering.datasources) {
      const ds = atlas.datasourceIndex.get(dsId);
      if (!ds) continue;
      const ids = new Set<string>();
      for (const p of ds.pages) {
        if (renderingPageIds.has(p.pageId)) ids.add(p.pageId);
      }
      map.set(dsId, ids);
    }
    return map;
  }, [atlas, rendering.datasources, rendering.pages]);
  const affinedPageIds: ReadonlySet<string> | null = hoveredDatasourceId
    ? pagesByDsId.get(hoveredDatasourceId) ?? null
    : null;

  const resolvedDatasourceNames = useDatasourceNames(
    client ?? null,
    contextId ?? null,
    rendering.datasources,
  );

  const datasources = rendering.datasources.map((dsId) => {
    const known = atlas?.datasourceIndex.get(dsId);
    const resolved = resolvedDatasourceNames.get(dsId);
    return {
      datasourceId: dsId,
      displayName: resolved ?? known?.displayName ?? dsId,
      pageCount: known ? new Set(known.pages.map((p) => p.pageId)).size : null,
      tag: datasourceTagColor(dsId),
    };
  });

  return (
    <div
      className="rendering-inline-detail border-b border-border bg-primary/5 border-l-[3px] border-l-primary px-5 py-4"
      data-testid="rendering-inline-detail"
      role="region"
      aria-label={`Usage details for ${rendering.displayName}`}
    >
      <div className="detail__head flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold">{rendering.displayName}</div>
          <div className="text-muted-foreground text-xs mt-0.5">
            {dedupedPages.length} page{dedupedPages.length === 1 ? '' : 's'} ·{' '}
            {rendering.totalUsages} placement
            {rendering.totalUsages === 1 ? '' : 's'} ·{' '}
            {rendering.datasources.length} datasource
            {rendering.datasources.length === 1 ? '' : 's'}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          colorScheme="neutral"
          size="sm"
          onClick={onClose}
          data-testid="rendering-inline-detail-close"
          aria-label="Collapse rendering detail"
        >
          Close ▴
        </Button>
      </div>

      <div className="mb-3">
        <DirectBindingsAffordance />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="flex flex-col min-h-0">
          <h4 className="text-muted-foreground mb-2 text-xs uppercase tracking-wide font-semibold sticky top-0 bg-primary/5 py-1 z-10">
            Direct rendering usage · {dedupedPages.length} page
            {dedupedPages.length === 1 ? '' : 's'}
          </h4>
          {dedupedPages.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No pages currently use this rendering.
            </p>
          ) : (
            <div
              className="flex flex-col max-h-72 overflow-y-auto pr-1"
              data-testid="rendering-inline-detail-pages-scroll"
            >
              {dedupedPages.map((p) => {
                const isForbidden = forbiddenPageIds?.has(p.pageId) ?? false;
                const isAffined = affinedPageIds?.has(p.pageId) ?? false;
                return (
                  <button
                    key={p.pageId}
                    type="button"
                    data-testid="rendering-inline-detail-page-row"
                    data-affined={isAffined ? 'true' : undefined}
                    disabled={isForbidden}
                    onClick={() => !isForbidden && onNavigate(p.pageId)}
                    className={cn(
                      'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-2 py-2 text-left hover:bg-card disabled:opacity-50 transition-colors',
                      isAffined && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium truncate">
                        {p.pageName}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs truncate block">
                        {p.siteName} · {p.sitePath}
                      </span>
                    </span>
                    {p.placements > 1 ? (
                      <Badge colorScheme="primary" size="sm">
                        ×{p.placements}
                      </Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col min-h-0">
          <h4 className="text-muted-foreground mb-2 text-xs uppercase tracking-wide font-semibold sticky top-0 bg-primary/5 py-1 z-10">
            Datasources · {datasources.length}
          </h4>
          {datasources.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No datasources bound by this rendering.
            </p>
          ) : (
            <div
              className="flex flex-col max-h-72 overflow-y-auto pr-1"
              data-testid="rendering-inline-detail-datasources-scroll"
            >
              {datasources.map((d) => {
                const isHovered = hoveredDatasourceId === d.datasourceId;
                return (
                <div
                  key={d.datasourceId}
                  data-testid="rendering-inline-detail-ds-row"
                  data-datasource-id={d.datasourceId}
                  data-hovered={isHovered ? 'true' : undefined}
                  onMouseEnter={() => setHoveredDatasourceId(d.datasourceId)}
                  onMouseLeave={() => setHoveredDatasourceId(null)}
                  className={cn(
                    'grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-2 py-2 transition-colors',
                    isHovered && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: d.tag }}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium truncate">
                      {d.displayName}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs truncate block">
                      {d.datasourceId}
                    </span>
                  </span>
                  {d.pageCount !== null ? (
                    <Badge colorScheme="neutral" size="sm">
                      {d.pageCount} page{d.pageCount === 1 ? '' : 's'}
                    </Badge>
                  ) : null}
                </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
