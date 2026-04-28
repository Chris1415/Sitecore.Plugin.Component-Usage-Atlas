'use client';

// T053 — `<DatasourceImpactGroup />`.
//
// Below the rendering stack, the panel shows a `Datasource impact`
// group: one row per UNIQUE datasource bound directly on the active
// page (FR-8.1, ADR-0006 — direct bindings only). Counter is the
// number of pages cross-tenant where that datasource is used (per
// `datasourceIndex.get(dsId).pages.length`).
//
// Click → opens the same `<UsageDrawer />` infrastructure with the
// drawer focused on a synthetic "datasource" view; for v1 the panel
// surface re-uses the rendering drawer's API by routing through the
// first rendering that uses the datasource — the drawer itself shows
// per-page rows in either case. (The current `<UsageDrawer />`
// signature accepts a `RenderingUsage` so we keep the panel honest by
// only enabling the click when a hosting rendering is known.)

import type * as React from 'react';
import { cn } from '@/lib/utils';
import { MissingDatasourceWarning } from '@/components/atlas/missing-datasource-warning';
import type { Atlas, ComponentRecord } from '@/lib/sdk/types';

export type DatasourceImpactGroupProps = {
  readonly components: ReadonlyArray<ComponentRecord>;
  readonly atlas: Atlas | null;
  readonly onSelectRendering?: (renderingId: string) => void;
};

type Bucket = {
  readonly datasourceId: string;
  readonly displayName: string;
  readonly count: number | null;
  readonly missing: boolean;
  readonly hostRenderingId: string | undefined;
};

function bucketize(
  components: ReadonlyArray<ComponentRecord>,
  atlas: Atlas | null,
): ReadonlyArray<Bucket> {
  const seen = new Map<string, Bucket>();
  for (const c of components) {
    if (!c.datasourceId) continue;
    if (seen.has(c.datasourceId)) continue;
    const known = atlas?.datasourceIndex.get(c.datasourceId);
    seen.set(c.datasourceId, {
      datasourceId: c.datasourceId,
      displayName: known?.displayName ?? c.datasourceId,
      count: known ? known.pages.length : atlas ? 0 : null,
      missing: atlas ? !known : false,
      hostRenderingId: c.renderingId,
    });
  }
  return Array.from(seen.values());
}

export function DatasourceImpactGroup({
  components,
  atlas,
  onSelectRendering,
}: DatasourceImpactGroupProps): React.ReactElement | null {
  const buckets = bucketize(components, atlas);
  if (buckets.length === 0) return null;

  return (
    <div className="datasource-impact-group">
      <p className="panel-section-title text-muted-foreground px-4 pt-4 pb-1 text-xs uppercase tracking-wide">
        Datasource impact
      </p>
      {buckets.map((b) => {
        const interactive = !!b.hostRenderingId && (b.count ?? 0) > 0;
        const handle = () => {
          if (b.hostRenderingId && onSelectRendering) {
            onSelectRendering(b.hostRenderingId);
          }
        };
        return (
          <div
            key={b.datasourceId}
            data-testid="datasource-impact-row"
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : -1}
            onClick={interactive ? handle : undefined}
            onKeyDown={(e) => {
              if (!interactive) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handle();
              }
            }}
            className={cn(
              'counter-row grid grid-cols-[88px_1fr_auto] items-center gap-3 border-b border-border bg-card px-4 py-3',
              interactive
                ? 'cursor-pointer hover:bg-neutral-bg'
                : 'cursor-default opacity-90',
              b.missing && 'counter-row--missing',
            )}
          >
            <div className="counter-row__count flex flex-col items-start font-mono">
              {b.count === null ? (
                <span
                  data-testid="datasource-impact-counter-loading"
                  className="text-muted-foreground text-2xl font-semibold tabular-nums"
                >
                  +?
                </span>
              ) : b.missing ? (
                <span
                  data-testid="datasource-impact-counter-missing"
                  className="text-warning-fg text-2xl font-bold"
                  aria-hidden="true"
                >
                  ⚠
                </span>
              ) : (
                <span
                  data-testid="datasource-impact-counter"
                  className={cn(
                    'text-3xl font-bold tabular-nums',
                    b.count > 0 ? 'text-primary-fg' : 'text-muted-foreground',
                  )}
                >
                  {b.count}
                </span>
              )}
              <span className="text-muted-foreground text-xs lowercase tracking-wide">
                {b.missing ? 'missing' : 'pages'}
              </span>
            </div>
            <div className="counter-row__main min-w-0">
              <div className="counter-row__primary flex items-center gap-2 truncate font-medium">
                {b.displayName}
              </div>
              <div className="counter-row__secondary text-muted-foreground font-mono text-xs truncate flex items-center gap-2">
                {b.missing ? (
                  <>
                    <MissingDatasourceWarning datasourceId={b.datasourceId} />
                    <span>not resolvable in this tenant</span>
                  </>
                ) : (
                  <span className="truncate">cross-tenant · {b.datasourceId}</span>
                )}
              </div>
            </div>
            <span
              className="counter-row__chev text-muted-foreground"
              aria-hidden="true"
            >
              {interactive ? '→' : '·'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
