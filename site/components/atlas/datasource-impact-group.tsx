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
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MissingDatasourceWarning } from '@/components/atlas/missing-datasource-warning';
import { deriveDatasourceDisplayName } from '@/lib/sdk/datasource-name';
import { datasourceTagColor } from '@/lib/datasource-tag';
import { PanelRowSkeleton } from '@/components/atlas/panel-row-skeleton';
import type { Atlas, ComponentRecord } from '@/lib/sdk/types';

export type DatasourceImpactGroupProps = {
  readonly components: ReadonlyArray<ComponentRecord>;
  readonly atlas: Atlas | null;
  readonly onSelectDatasource?: (datasourceId: string) => void;
  readonly hoveredDatasourceId?: string | null;
  readonly onHoverDatasource?: (datasourceId: string | null) => void;
  // S16 — true while the panel surface's per-page fetch is in flight.
  readonly isLoading?: boolean;
  // S12 — names resolved via Authoring API; preferred over local derive.
  readonly resolvedDatasourceNames?: ReadonlyMap<string, string>;
};

type Bucket = {
  readonly datasourceId: string;
  readonly displayName: string;
  readonly count: number | null;
  readonly missing: boolean;
};

function bucketize(
  components: ReadonlyArray<ComponentRecord>,
  atlas: Atlas | null,
  resolvedNames?: ReadonlyMap<string, string>,
): ReadonlyArray<Bucket> {
  const seen = new Map<string, Bucket>();
  for (const c of components) {
    if (!c.datasourceId) continue;
    if (seen.has(c.datasourceId)) continue;
    const known = atlas?.datasourceIndex.get(c.datasourceId);
    const resolved = resolvedNames?.get(c.datasourceId);
    seen.set(c.datasourceId, {
      datasourceId: c.datasourceId,
      displayName:
        resolved ?? known?.displayName ?? deriveDatasourceDisplayName(c.datasourceId),
      count: known ? known.pages.length : atlas ? 0 : null,
      missing: atlas ? !known : false,
    });
  }
  return Array.from(seen.values());
}

export function DatasourceImpactGroup({
  components,
  atlas,
  onSelectDatasource,
  hoveredDatasourceId,
  onHoverDatasource,
  isLoading,
  resolvedDatasourceNames,
}: DatasourceImpactGroupProps): React.ReactElement | null {
  const buckets = bucketize(components, atlas, resolvedDatasourceNames);
  // Collapsed default = false (open). Mirrors RenderingImpactList — lets
  // the editor hide the heavy datasource list when focused on renderings.
  const [collapsed, setCollapsed] = useState(false);
  if (buckets.length === 0) {
    if (isLoading) {
      return (
        <div className="datasource-impact-group">
          <p className="panel-section-title text-muted-foreground px-4 pt-4 pb-1 text-xs uppercase tracking-wide">
            Datasource impact
          </p>
          <PanelRowSkeleton count={3} />
        </div>
      );
    }
    return null;
  }

  return (
    <Collapsible
      open={!collapsed}
      onOpenChange={(next) => setCollapsed(!next)}
      className="datasource-impact-group"
    >
      <CollapsibleTrigger
        type="button"
        data-testid="datasource-impact-group-toggle"
        className="panel-section-title group flex w-full items-center justify-between gap-2 px-4 pt-4 pb-1 text-xs uppercase tracking-wide text-muted-foreground hover:bg-card/50 transition-colors"
        aria-expanded={!collapsed}
      >
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'inline-block transition-transform',
              collapsed ? '-rotate-90' : 'rotate-0',
            )}
          >
            ▾
          </span>
          <span>Datasource impact · {buckets.length}</span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
      {buckets.map((b) => {
        const interactive = (b.count ?? 0) > 0 && !b.missing;
        const handle = () => {
          if (interactive && onSelectDatasource) {
            onSelectDatasource(b.datasourceId);
          }
        };
        const isAffined = hoveredDatasourceId === b.datasourceId;
        const tag = datasourceTagColor(b.datasourceId);
        return (
          <div
            key={b.datasourceId}
            data-testid="datasource-impact-row"
            data-datasource-id={b.datasourceId}
            data-affined={isAffined ? 'true' : undefined}
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
            onMouseEnter={() => onHoverDatasource?.(b.datasourceId)}
            onMouseLeave={() => onHoverDatasource?.(null)}
            onFocus={() => onHoverDatasource?.(b.datasourceId)}
            onBlur={() => onHoverDatasource?.(null)}
            className={cn(
              'counter-row grid grid-cols-[88px_1fr_auto] items-center gap-3 border-b border-border bg-card px-4 py-3 transition-colors',
              interactive
                ? 'cursor-pointer hover:bg-neutral-bg'
                : 'cursor-default opacity-90',
              b.missing && 'counter-row--missing',
              isAffined && 'bg-neutral-bg ring-1 ring-inset ring-primary/40',
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
                <span
                  aria-hidden="true"
                  data-testid="datasource-tag"
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tag }}
                />
                <span className="truncate">{b.displayName}</span>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
