'use client';

// S16 — `<PanelRowSkeleton />`.
//
// Shared skeleton row used by `<RenderingImpactList />` and
// `<DatasourceImpactGroup />` while the per-page components fetch is
// in flight. Mirrors the `counter-row` grid layout so the swap-in of
// real rows produces no visible reflow.

import type * as React from 'react';

const ROW_COUNT = 4;

function Bar({ widthClass }: { widthClass: string }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 rounded bg-muted/70 ${widthClass} animate-pulse`}
    />
  );
}

export function PanelRowSkeleton({
  count = ROW_COUNT,
}: {
  readonly count?: number;
}): React.ReactElement {
  // Vary widths so the column doesn't look monolithic.
  const widths = ['w-32', 'w-44', 'w-28', 'w-40', 'w-36', 'w-24'];
  return (
    <div role="status" aria-label="Loading page components">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          data-testid="panel-row-skeleton"
          className="counter-row grid grid-cols-[88px_1fr_auto] items-center gap-3 border-b border-border bg-card px-4 py-3"
        >
          <span
            aria-hidden="true"
            className="inline-block h-7 w-12 rounded bg-muted/70 animate-pulse"
          />
          <div className="flex flex-col gap-1.5 min-w-0">
            <Bar widthClass={widths[i % widths.length] ?? 'w-32'} />
            <Bar widthClass={widths[(i + 2) % widths.length] ?? 'w-24'} />
          </div>
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded bg-muted/70 animate-pulse"
          />
        </div>
      ))}
    </div>
  );
}
