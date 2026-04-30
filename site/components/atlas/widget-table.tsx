'use client';

// T041 / T042 — `<WidgetTable />`. Search-first rendering table.
//
// Composes Blok @blok/table + @blok/search-input with the M4
// `<RenderingNameCell />` for the first column. Rows are sorted by
// Total usages (descending) and filtered client-side by `query`
// (case-insensitive substring match on display name) — no `client.query`
// fires on type. Click a row → `onSelectRendering(renderingId)`. Empty
// result renders `<AtlasEmptyState />` with the appropriate mode.
//
// The surface (T040) wires:
//   - `query` from local state (debounced via the surface's onChange)
//   - `searchDisabled = atlasState.kind === 'scanning' && no priorAtlas`
//   - `onSelectRendering` → opens `<UsageDrawer />`.
//
// POC visual anchors: `.widget-data`, `.widget-toolbar`, `.table`,
// `.rendering-cell` — preserved on wrappers so the v2 clickdummy ↔
// implementation diff is easy.

import type * as React from 'react';
import { Fragment, useMemo } from 'react';
import type { ClientSDK } from '@sitecore-marketplace-sdk/client';
import { mdiMagnify } from '@mdi/js';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  SearchInput,
  SearchInputField,
  SearchInputLeftElement,
} from '@/components/ui/search-input';
import { Icon } from '@/lib/icon';
import { Badge } from '@/components/ui/badge';
import { RenderingNameCell } from '@/components/atlas/rendering-name-cell';
import { AtlasEmptyState } from '@/components/atlas/empty-state';
import { RenderingInlineDetail } from '@/components/atlas/rendering-inline-detail';
import { WidgetTableSkeleton } from '@/components/atlas/widget-table-skeleton';
import { computeCollisions } from '@/lib/collisions';
import type { Atlas, RenderingUsage } from '@/lib/sdk/types';
import { cn } from '@/lib/utils';

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

export type WidgetTableProps = {
  readonly renderings: ReadonlyMap<string, RenderingUsage>;
  readonly query: string;
  readonly density: 'compact' | 'comfortable';
  readonly searchDisabled: boolean;
  // S17 — when true, render the skeleton instead of the empty-state CTA;
  // surface passes `state.kind === 'scanning' && !atlas`.
  readonly isScanning?: boolean;
  readonly onQueryChange?: (next: string) => void;
  readonly onSelectRendering: (renderingId: string) => void;
  // D2 v1 — inline expansion (replaces the right-side drawer on the
  // dashboard surface). The widget surface owns expand state; we render
  // <RenderingInlineDetail /> as a fullspan row directly under the
  // matching rendering.
  readonly expandedRenderingId?: string | null;
  readonly atlas?: Atlas | null;
  readonly forbiddenPageIds?: ReadonlySet<string>;
  readonly onCollapse?: () => void;
  readonly onNavigatePage?: (pageId: string) => void;
  // S22 — passed through to <RenderingInlineDetail /> so it can resolve
  // GUID datasource names via the Authoring API instead of showing
  // "Unnamed item" / a short-id fallback.
  readonly client?: ClientSDK | null;
  readonly contextId?: string | null;
};

function rarityBadge(usage: RenderingUsage): React.ReactElement {
  if (usage.totalUsages === 1) {
    return (
      <Badge colorScheme="warning" size="sm">
        unique
      </Badge>
    );
  }
  if (usage.totalUsages < 5) {
    return (
      <Badge colorScheme="neutral" size="sm">
        rare
      </Badge>
    );
  }
  return (
    <Badge colorScheme="primary" size="sm">
      common
    </Badge>
  );
}

export function WidgetTable({
  renderings,
  query,
  density,
  searchDisabled,
  isScanning,
  onQueryChange,
  onSelectRendering,
  expandedRenderingId,
  atlas,
  forbiddenPageIds,
  onCollapse,
  onNavigatePage,
  client,
  contextId,
}: WidgetTableProps): React.ReactElement {
  const allRenderings = renderings;

  // T081 — collapse all isUnknown:true entries into ONE virtual row
  // labeled "(unknown rendering)". The synthetic group's `renderingId`
  // is the FIRST member's ID — onSelectRendering(virtualId) routes the
  // drawer to that synthetic record, and the drawer's per-page rows
  // expand the placeholder breakdown via the `unknown:<page>:<placeholder>:<index>`
  // synthetic key (the ID itself encodes the breakdown).
  const filteredAndSorted = useMemo(() => {
    const all = Array.from(renderings.values());
    const knowns: RenderingUsage[] = [];
    const unknowns: RenderingUsage[] = [];
    for (const r of all) {
      if (r.isUnknown) unknowns.push(r);
      else knowns.push(r);
    }

    let virtual: RenderingUsage | null = null;
    if (unknowns.length > 0) {
      const firstId = unknowns[0]!.renderingId;
      const totalUsages = unknowns.reduce((acc, u) => acc + u.totalUsages, 0);
      const pages = unknowns.flatMap((u) => u.pages);
      const datasources = Array.from(
        new Set(unknowns.flatMap((u) => u.datasources)),
      );
      virtual = {
        renderingId: firstId,
        displayName: '(unknown rendering)',
        isUnknown: true,
        totalUsages,
        pages,
        datasources,
      };
    }

    const candidates: RenderingUsage[] = virtual ? [...knowns, virtual] : knowns;
    const filtered = query.trim()
      ? candidates.filter((r) =>
          r.displayName.toLowerCase().includes(query.toLowerCase()),
        )
      : candidates;
    return filtered.slice().sort((a, b) => b.totalUsages - a.totalUsages);
  }, [renderings, query]);

  const isEmptyAtlas = renderings.size === 0;
  const hasMatches = filteredAndSorted.length > 0;

  // M1 fix from code-review-20260428T110500Z: compute the collision map
  // ONCE here and hand it to every `<RenderingNameCell />` so the row
  // render path stays O(1) per row instead of O(N) per row (the inner
  // `Array.from(allRenderings.values())` previously made the table
  // O(N²) overall).
  //
  // m_NEW3 fix from test-report-20260428T122500Z: exclude `isUnknown`
  // entries from the collision input. Multiple unknowns share the
  // display name "(unknown rendering)" but are collapsed into ONE
  // virtual row whose `renderingId` matches the first member's ID.
  // Including them would make `computeCollisions` see N synthetic
  // entries colliding on the same name and append a `· <last-7-of-id>`
  // suffix to the virtual row — making it appear as if the placeholder
  // collides with itself.
  const collisionMap = useMemo(
    () =>
      computeCollisions(
        Array.from(allRenderings.values()).filter((r) => !r.isUnknown),
      ),
    [allRenderings],
  );

  return (
    <div
      className={cn(
        'widget-data flex flex-col gap-2',
        density === 'compact' ? 'density-compact' : 'density-comfortable',
      )}
    >
      <div className="widget-toolbar px-4 pt-3">
        <SearchInput aria-label="Search renderings">
          <SearchInputLeftElement>
            <Icon path={mdiMagnify} />
          </SearchInputLeftElement>
          <SearchInputField
            type="search"
            placeholder={
              searchDisabled
                ? 'Search will activate when scan completes…'
                : `Search ${renderings.size} renderings…`
            }
            disabled={searchDisabled}
            value={query}
            onChange={(e) => onQueryChange?.(e.target.value)}
          />
        </SearchInput>
      </div>

      {isEmptyAtlas ? (
        // S17: while the scan is in flight and the atlas hasn't produced
        // rows yet, render a skeleton instead of the "empty tenant" CTA.
        // The empty CTA is reserved for the post-scan-zero-result case.
        isScanning ? (
          <div className="widget-skeleton-wrap px-4 pt-3 pb-4">
            <WidgetTableSkeleton />
          </div>
        ) : (
          <div className="widget-empty py-8">
            <AtlasEmptyState
              mode="empty-tenant"
              title="No renderings found"
              description="The scan finished but didn't find any renderings on this tenant's pages. Refresh once more or check the skipped pages list for blockers."
            />
          </div>
        )
      ) : !hasMatches ? (
        <div className="widget-empty py-8">
          <AtlasEmptyState mode="no-results" query={query} />
        </div>
      ) : (
        <Table
          size={density === 'compact' ? 'sm' : 'md'}
          containerClassName="border border-border"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Rendering</TableHead>
              <TableHead className="text-right">Placements</TableHead>
              <TableHead className="text-right">Pages</TableHead>
              <TableHead className="text-right">Datasources</TableHead>
              <TableHead>Rarity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.map((r) => {
              const isExpanded = expandedRenderingId === r.renderingId;
              const distinctPages = new Set(r.pages.map((p) => p.pageId)).size;
              return (
                <Fragment key={r.renderingId}>
                  <TableRow
                    tabIndex={0}
                    onClick={() => onSelectRendering(r.renderingId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectRendering(r.renderingId);
                      }
                    }}
                    className={cn(
                      'cursor-pointer',
                      isExpanded && 'bg-primary/10',
                    )}
                    data-rendering-id={r.renderingId}
                    aria-expanded={isExpanded}
                  >
                    <TableCell>
                      <RenderingNameCell
                        renderingId={r.renderingId}
                        renderingName={r.displayName}
                        allRenderings={allRenderings}
                        collisionMap={collisionMap}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {NUMBER_FORMATTER.format(r.totalUsages)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {NUMBER_FORMATTER.format(distinctPages)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {NUMBER_FORMATTER.format(r.datasources.length)}
                    </TableCell>
                    <TableCell>{rarityBadge(r)}</TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow
                      data-testid="rendering-inline-detail-row"
                      className="hover:bg-transparent"
                    >
                      <TableCell colSpan={5} className="p-0">
                        <RenderingInlineDetail
                          rendering={r}
                          atlas={atlas ?? null}
                          forbiddenPageIds={forbiddenPageIds}
                          onClose={() => onCollapse?.()}
                          onNavigate={(pageId) => onNavigatePage?.(pageId)}
                          client={client ?? null}
                          contextId={contextId ?? null}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
