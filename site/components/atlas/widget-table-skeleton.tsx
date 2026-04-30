'use client';

// S17 — `<WidgetTableSkeleton />`.
//
// Rendered inside the widget zone-3 while the scan is in flight and the
// atlas hasn't produced any rendering rows yet. Replaces the previous
// path which fell through to `<AtlasEmptyState mode="empty-tenant" />`
// (a "No published pages · Create widget" CTA — wrong for Atlas, and
// alarming when shown mid-scan).
//
// The skeleton mirrors the widget table column layout so the reflow when
// real rows arrive is invisible. Rows have a subtle pulse animation; no
// text leaks through (aria-hidden — screen readers should hear the
// scan-status-bar progress instead).

import type * as React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

const ROW_COUNT = 8;

function Bar({ widthClass }: { widthClass: string }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 rounded bg-muted/70 ${widthClass} animate-pulse`}
    />
  );
}

function NumBar(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-8 rounded bg-muted/70 animate-pulse ml-auto"
    />
  );
}

export function WidgetTableSkeleton(): React.ReactElement {
  // Vary widths per row so the column doesn't look like a flat block.
  const widths = ['w-40', 'w-28', 'w-36', 'w-44', 'w-32', 'w-24', 'w-40', 'w-28'];

  return (
    <div
      className="widget-skeleton flex flex-col gap-2"
      role="status"
      aria-label="Loading rendering atlas"
    >
      <div className="widget-toolbar px-4 pt-3">
        <div className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
      </div>

      <Table size="sm" containerClassName="border border-border">
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
          {Array.from({ length: ROW_COUNT }).map((_, i) => (
            <TableRow
              key={i}
              data-testid="widget-table-skeleton-row"
              className="cursor-default"
            >
              <TableCell>
                <Bar widthClass={widths[i % widths.length] ?? 'w-32'} />
              </TableCell>
              <TableCell className="text-right">
                <NumBar />
              </TableCell>
              <TableCell className="text-right">
                <NumBar />
              </TableCell>
              <TableCell className="text-right">
                <NumBar />
              </TableCell>
              <TableCell>
                <span
                  aria-hidden="true"
                  className="inline-block h-5 w-16 rounded-full bg-muted/70 animate-pulse"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
