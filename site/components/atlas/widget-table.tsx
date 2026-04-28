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
import { useMemo } from 'react';
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
import type { RenderingUsage } from '@/lib/sdk/types';
import { cn } from '@/lib/utils';

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

export type WidgetTableProps = {
  readonly renderings: ReadonlyMap<string, RenderingUsage>;
  readonly query: string;
  readonly density: 'compact' | 'comfortable';
  readonly searchDisabled: boolean;
  readonly onQueryChange?: (next: string) => void;
  readonly onSelectRendering: (renderingId: string) => void;
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
  onQueryChange,
  onSelectRendering,
}: WidgetTableProps): React.ReactElement {
  const allRenderings = renderings;

  const filteredAndSorted = useMemo(() => {
    const all = Array.from(renderings.values());
    const filtered = query.trim()
      ? all.filter((r) =>
          r.displayName.toLowerCase().includes(query.toLowerCase()),
        )
      : all;
    return filtered
      .slice()
      .sort((a, b) => b.totalUsages - a.totalUsages);
  }, [renderings, query]);

  const isEmptyAtlas = renderings.size === 0;
  const hasMatches = filteredAndSorted.length > 0;

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
        <div className="widget-empty py-8">
          <AtlasEmptyState mode="no-shared" />
        </div>
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
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Used on</TableHead>
              <TableHead className="text-right">Datasources</TableHead>
              <TableHead>Rarity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.map((r) => (
              <TableRow
                key={r.renderingId}
                tabIndex={0}
                onClick={() => onSelectRendering(r.renderingId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectRendering(r.renderingId);
                  }
                }}
                className="cursor-pointer"
                data-rendering-id={r.renderingId}
              >
                <TableCell>
                  <RenderingNameCell
                    renderingId={r.renderingId}
                    renderingName={r.displayName}
                    allRenderings={allRenderings}
                  />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {NUMBER_FORMATTER.format(r.totalUsages)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {NUMBER_FORMATTER.format(r.pages.length)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {NUMBER_FORMATTER.format(r.datasources.length)}
                </TableCell>
                <TableCell>{rarityBadge(r)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
