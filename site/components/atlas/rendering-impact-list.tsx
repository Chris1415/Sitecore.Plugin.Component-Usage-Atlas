'use client';

// T052 — `<RenderingImpactList />`.
//
// One row per component on the active page (from the per-page fetch).
// Each row shows:
//   - Rendering display name (via M4 `<RenderingNameCell />` so collisions
//     get the · <last-7-of-id> suffix exactly the way the widget does).
//   - Datasource hint line (display name from the index, fallback to ID).
//   - Cross-tenant counter chip "+N other pages use this".
//
// Click a row → opens the same `<UsageDrawer />` the widget uses, focused
// on the rendering. We do not duplicate drawer logic — `<PanelSurface />`
// owns the open/close state and renders one drawer instance.
//
// Empty state: when the active-page fetch returned zero components,
// render a small muted placeholder ("No renderings on this page").

import type * as React from 'react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { RenderingNameCell } from '@/components/atlas/rendering-name-cell';
import { MissingDatasourceWarning } from '@/components/atlas/missing-datasource-warning';
import { computeCollisions } from '@/lib/collisions';
import { deriveDatasourceDisplayName } from '@/lib/sdk/datasource-name';
import { datasourceTagColor } from '@/lib/datasource-tag';
import { PanelRowSkeleton } from '@/components/atlas/panel-row-skeleton';
import type {
  Atlas,
  ComponentRecord,
  RenderingUsage,
} from '@/lib/sdk/types';

export type RenderingImpactListProps = {
  readonly activePageId: string | null;
  readonly components: ReadonlyArray<ComponentRecord>;
  readonly atlas: Atlas | null;
  readonly onSelectRendering: (renderingId: string) => void;
  // S23 — when set, expanding a rendering row reveals the datasource
  // bound on that placement, and clicking the datasource opens the
  // datasource drawer (the panel was previously a separate stacked
  // section; this merges them into one drill-down tree).
  readonly onSelectDatasource?: (datasourceId: string) => void;
  readonly hoveredDatasourceId?: string | null;
  readonly onHoverDatasource?: (datasourceId: string | null) => void;
  // S16 — true while the panel surface's per-page fetch is in flight; we
  // render skeletons instead of the "no renderings on this page yet"
  // empty copy so a page-switch doesn't flash a misleading message.
  readonly isLoading?: boolean;
  // S12 — names resolved via Authoring API for GUID/path datasources;
  // takes precedence over the local derive helper.
  readonly resolvedDatasourceNames?: ReadonlyMap<string, string>;
};

function counterFor(
  rendering: RenderingUsage | undefined,
  activePageId: string | null,
): { readonly count: number | null; readonly known: boolean } {
  if (!rendering) return { count: null, known: false };
  // Atlas resolved → "+N other pages use this" (excluding active page).
  // `rendering.pages` contains one entry per PLACEMENT, not per distinct
  // page (a rendering placed 3× on the same page generates 3 entries —
  // see `core/index-builder.ts:106` where each component pushes a row).
  // The label is "other pages" so we must count distinct page IDs, not
  // total placements; otherwise a heavy page (e.g. 5× Container on Home)
  // inflates the counter by 4× per visit.
  const distinctPageIds = new Set(rendering.pages.map((p) => p.pageId));
  if (activePageId !== null) {
    distinctPageIds.delete(activePageId);
  }
  return { count: distinctPageIds.size, known: true };
}

function datasourceLabel(
  c: ComponentRecord,
  atlas: Atlas | null,
  resolvedNames?: ReadonlyMap<string, string>,
): string | null {
  if (!c.datasourceId) return null;
  const resolved = resolvedNames?.get(c.datasourceId);
  if (resolved) return resolved;
  const known = atlas?.datasourceIndex.get(c.datasourceId);
  return known?.displayName ?? deriveDatasourceDisplayName(c.datasourceId);
}

function isMissingDatasource(
  c: ComponentRecord,
  atlas: Atlas | null,
): boolean {
  if (!c.datasourceId) return false;
  if (!atlas) return false;
  return !atlas.datasourceIndex.has(c.datasourceId);
}

export function RenderingImpactList({
  activePageId,
  components,
  atlas,
  onSelectRendering,
  onSelectDatasource,
  hoveredDatasourceId,
  onHoverDatasource,
  isLoading,
  resolvedDatasourceNames,
}: RenderingImpactListProps): React.ReactElement {
  // The panel may render before the global atlas resolves. We still want
  // the rendering name + datasource to paint immediately; counters wait
  // for the atlas.
  const allRenderings = useMemo(
    () => atlas?.renderingIndex ?? new Map<string, RenderingUsage>(),
    [atlas],
  );

  // M1 fix from code-review-20260428T110500Z: compute the collision map
  // ONCE per render (keyed on the atlas's rendering index reference) so
  // each `<RenderingNameCell />` doesn't re-walk the full set. Skipped
  // for the panel until atlas resolves — without atlas, there's no set
  // to compute over.
  const collisionMap = useMemo(
    () => computeCollisions(Array.from(allRenderings.values())),
    [allRenderings],
  );

  // Collapsed default = false (open). Lets the editor hide the heavy
  // rendering list when they're focused on the datasource list below.
  const [collapsed, setCollapsed] = useState(false);
  // S23 — which row's nested datasource detail is currently expanded.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (components.length === 0) {
    return (
      <div className="rendering-impact-list">
        <p className="panel-section-title text-muted-foreground px-4 py-2 text-xs uppercase tracking-wide">
          Renderings on this page
        </p>
        {isLoading ? (
          <PanelRowSkeleton count={4} />
        ) : (
          <p className="text-muted-foreground px-4 py-3 text-sm">
            No renderings on this page yet.
          </p>
        )}
      </div>
    );
  }

  // S18 — collapse identical placements (same renderingId + same
  // datasourceId) into one row with a ×N badge. Two Containers with no
  // datasource group; a HighlightTeaser with datasource A and another
  // with datasource B stay as two separate rows because the binding is
  // the marketer-relevant difference.
  type Group = {
    readonly key: string;
    readonly first: ComponentRecord;
    readonly count: number;
  };
  const groups: Group[] = [];
  const groupIndex = new Map<string, number>();
  for (const c of components) {
    const key = `${c.renderingId ?? `__unknown:${c.placementId}`}|${c.datasourceId ?? ''}`;
    const idx = groupIndex.get(key);
    if (idx !== undefined) {
      const existing = groups[idx]!;
      groups[idx] = { ...existing, count: existing.count + 1 };
      continue;
    }
    groupIndex.set(key, groups.length);
    groups.push({ key, first: c, count: 1 });
  }

  return (
    <Collapsible
      open={!collapsed}
      onOpenChange={(next) => setCollapsed(!next)}
      className="rendering-impact-list"
    >
      <CollapsibleTrigger
        type="button"
        data-testid="rendering-impact-list-toggle"
        className="panel-section-title group flex w-full items-center justify-between gap-2 px-4 pt-3 pb-1 text-xs uppercase tracking-wide text-muted-foreground hover:bg-card/50 transition-colors"
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
          <span>Renderings on this page · {groups.length}</span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
      {groups.map((g) => {
        const c = g.first;
        const renderingId = c.renderingId;
        const rendering = renderingId ? allRenderings.get(renderingId) : undefined;
        const counter = counterFor(rendering, activePageId);
        const dsLabel = datasourceLabel(c, atlas, resolvedDatasourceNames);
        const dsMissing = isMissingDatasource(c, atlas);
        const dsId = c.datasourceId;
        const dsTag = dsId ? datasourceTagColor(dsId) : null;
        const isAffined = !!dsId && hoveredDatasourceId === dsId;
        const isExpandable = !!dsId || !!renderingId;
        const isExpanded = expandedKey === g.key;
        const toggleExpansion = () => {
          if (!isExpandable) return;
          setExpandedKey((prev) => (prev === g.key ? null : g.key));
        };
        const placeholderCounter = !atlas;

        // S23 — datasource detail (counter + drawer trigger) for the
        // expanded inline panel below the row.
        const dsKnown = dsId ? atlas?.datasourceIndex.get(dsId) : undefined;
        const dsCrossTenantCount = dsKnown ? dsKnown.pages.length : null;
        const dsInteractive =
          !!dsId && !dsMissing && (dsCrossTenantCount ?? 0) > 0
          && !!onSelectDatasource;
        const handleSelectDatasource = () => {
          if (dsInteractive && dsId && onSelectDatasource) {
            onSelectDatasource(dsId);
          }
        };
        const handleSelectRendering = () => {
          if (renderingId && (counter.count ?? 0) > 0) {
            onSelectRendering(renderingId);
          }
        };

        return (
          <div key={g.key}>
            <div
              data-testid="rendering-impact-row"
              data-placement-count={g.count}
              data-datasource-id={dsId}
              data-affined={isAffined ? 'true' : undefined}
              data-expanded={isExpanded ? 'true' : undefined}
              role={isExpandable ? 'button' : undefined}
              tabIndex={isExpandable ? 0 : -1}
              aria-expanded={isExpandable ? isExpanded : undefined}
              onClick={isExpandable ? toggleExpansion : undefined}
              onKeyDown={(e) => {
                if (!isExpandable) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleExpansion();
                }
              }}
              onMouseEnter={() => dsId && onHoverDatasource?.(dsId)}
              onMouseLeave={() => dsId && onHoverDatasource?.(null)}
              className={cn(
                'counter-row grid grid-cols-[88px_1fr_auto] items-center gap-3 border-b border-border bg-card px-4 py-3 transition-colors',
                isExpandable
                  ? 'cursor-pointer hover:bg-neutral-bg'
                  : 'cursor-default opacity-90',
                isAffined && 'bg-neutral-bg ring-1 ring-inset ring-primary/40',
                isExpanded && 'bg-neutral-bg',
              )}
            >
              <div className="counter-row__count flex flex-col items-start font-mono">
                {placeholderCounter ? (
                  <>
                    <span
                      className="text-muted-foreground text-2xl font-semibold tabular-nums"
                      data-testid="rendering-impact-counter-loading"
                    >
                      +?
                    </span>
                    <span className="text-muted-foreground text-xs lowercase tracking-wide">
                      other pages
                    </span>
                  </>
                ) : counter.known ? (
                  <>
                    <span
                      className={cn(
                        'text-3xl font-bold tabular-nums',
                        (counter.count ?? 0) > 0
                          ? 'text-primary-fg'
                          : 'text-muted-foreground',
                      )}
                      data-testid="rendering-impact-counter"
                    >
                      {counter.count ?? 0}
                    </span>
                    <span className="text-muted-foreground text-xs lowercase tracking-wide">
                      other pages
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className="text-muted-foreground text-2xl font-semibold tabular-nums"
                      data-testid="rendering-impact-counter-unknown"
                    >
                      +?
                    </span>
                    <span className="text-muted-foreground text-xs lowercase tracking-wide">
                      other pages
                    </span>
                  </>
                )}
              </div>

              <div className="counter-row__main min-w-0">
                <div className="counter-row__primary flex items-center gap-2">
                  {renderingId ? (
                    <RenderingNameCell
                      renderingId={renderingId}
                      renderingName={c.renderingName ?? '(unnamed rendering)'}
                      allRenderings={allRenderings}
                      collisionMap={collisionMap}
                    />
                  ) : (
                    <span className="text-muted-foreground italic">
                      (unknown rendering)
                    </span>
                  )}
                  {g.count > 1 ? (
                    <span
                      data-testid="rendering-impact-row-count"
                      className="bg-primary/15 text-primary-fg ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                    >
                      ×{g.count}
                    </span>
                  ) : null}
                </div>
                <div className="counter-row__secondary text-muted-foreground font-mono text-xs flex items-center gap-2">
                  {dsLabel ? (
                    <>
                      {dsTag ? (
                        <span
                          aria-hidden="true"
                          data-testid="datasource-tag"
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: dsTag }}
                        />
                      ) : null}
                      <span className="truncate">datasource: {dsLabel}</span>
                    </>
                  ) : (
                    <span>— no datasource</span>
                  )}
                  {dsMissing && c.datasourceId ? (
                    <MissingDatasourceWarning datasourceId={c.datasourceId} />
                  ) : null}
                </div>
              </div>

              <span
                className={cn(
                  'counter-row__chev text-muted-foreground transition-transform',
                  isExpanded ? 'rotate-90' : '',
                )}
                aria-hidden="true"
              >
                {isExpandable ? '▸' : '·'}
              </span>
            </div>

            {isExpanded ? (
              <div
                data-testid="rendering-impact-row-detail"
                className="rendering-impact-row__detail border-b border-border bg-primary/5 border-l-[3px] border-l-primary px-5 py-3"
              >
                {/* Cross-tenant rendering counter row → opens UsageDrawer */}
                <button
                  type="button"
                  data-testid="rendering-impact-row-detail-rendering"
                  disabled={!renderingId || (counter.count ?? 0) === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectRendering();
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left text-sm transition-colors',
                    renderingId && (counter.count ?? 0) > 0
                      ? 'hover:bg-neutral-bg cursor-pointer'
                      : 'cursor-default opacity-60',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    See all pages using this rendering
                  </span>
                  <span className="text-muted-foreground font-mono text-xs tabular-nums shrink-0">
                    {(counter.count ?? 0) > 0
                      ? `${counter.count} other page${
                          counter.count === 1 ? '' : 's'
                        } →`
                      : 'only this page'}
                  </span>
                </button>

                {/* Datasource impact for THIS placement → opens DatasourceUsageDrawer */}
                {dsId ? (
                  <button
                    type="button"
                    data-testid="rendering-impact-row-detail-datasource"
                    data-datasource-id={dsId}
                    disabled={!dsInteractive}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectDatasource();
                    }}
                    className={cn(
                      'mt-1 flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm transition-colors',
                      dsInteractive
                        ? 'hover:bg-neutral-bg cursor-pointer'
                        : 'cursor-default opacity-60',
                    )}
                  >
                    {dsTag ? (
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: dsTag }}
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">
                      {dsLabel ?? 'Datasource'}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums shrink-0">
                      {dsMissing
                        ? 'missing'
                        : dsCrossTenantCount === null
                          ? '+?'
                          : `${dsCrossTenantCount} page${
                              dsCrossTenantCount === 1 ? '' : 's'
                            } →`}
                    </span>
                  </button>
                ) : (
                  <p className="mt-1 px-2 py-2 text-muted-foreground text-sm">
                    No datasource bound on this placement.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
      </CollapsibleContent>
    </Collapsible>
  );
}
