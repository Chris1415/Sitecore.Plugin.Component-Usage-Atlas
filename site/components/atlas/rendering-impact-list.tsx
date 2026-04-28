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
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { RenderingNameCell } from '@/components/atlas/rendering-name-cell';
import { MissingDatasourceWarning } from '@/components/atlas/missing-datasource-warning';
import { computeCollisions } from '@/lib/collisions';
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
};

function counterFor(
  rendering: RenderingUsage | undefined,
  activePageId: string | null,
): { readonly count: number | null; readonly known: boolean } {
  if (!rendering) return { count: null, known: false };
  // Atlas resolved → "+N other pages use this" (excluding active page).
  const total = rendering.pages.length;
  const includesActive =
    activePageId !== null &&
    rendering.pages.some((p) => p.pageId === activePageId);
  const otherPages = includesActive ? total - 1 : total;
  return { count: otherPages, known: true };
}

function datasourceLabel(
  c: ComponentRecord,
  atlas: Atlas | null,
): string | null {
  if (!c.datasourceId) return null;
  const known = atlas?.datasourceIndex.get(c.datasourceId);
  return known?.displayName ?? c.datasourceId;
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

  if (components.length === 0) {
    return (
      <div className="rendering-impact-list">
        <p className="panel-section-title text-muted-foreground px-4 py-2 text-xs uppercase tracking-wide">
          Renderings on this page
        </p>
        <p className="text-muted-foreground px-4 py-3 text-sm">
          No renderings on this page yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rendering-impact-list">
      <p className="panel-section-title text-muted-foreground px-4 pt-3 pb-1 text-xs uppercase tracking-wide">
        Renderings on this page
      </p>
      {components.map((c) => {
        const renderingId = c.renderingId;
        const rendering = renderingId ? allRenderings.get(renderingId) : undefined;
        const counter = counterFor(rendering, activePageId);
        const dsLabel = datasourceLabel(c, atlas);
        const dsMissing = isMissingDatasource(c, atlas);
        const handleClick = () => {
          if (renderingId) onSelectRendering(renderingId);
        };
        const isInteractive = !!renderingId && (counter.count ?? 0) > 0;
        const placeholderCounter = !atlas;

        return (
          <div
            key={c.placementId}
            data-testid="rendering-impact-row"
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : -1}
            onClick={isInteractive ? handleClick : undefined}
            onKeyDown={(e) => {
              if (!isInteractive) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }}
            className={cn(
              'counter-row grid grid-cols-[88px_1fr_auto] items-center gap-3 border-b border-border bg-card px-4 py-3',
              isInteractive
                ? 'cursor-pointer hover:bg-neutral-bg'
                : 'cursor-default opacity-90',
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
              </div>
              <div className="counter-row__secondary text-muted-foreground font-mono text-xs flex items-center gap-2">
                {dsLabel ? (
                  <span className="truncate">datasource: {dsLabel}</span>
                ) : (
                  <span>— no datasource</span>
                )}
                {dsMissing && c.datasourceId ? (
                  <MissingDatasourceWarning datasourceId={c.datasourceId} />
                ) : null}
              </div>
            </div>

            <span
              className="counter-row__chev text-muted-foreground"
              aria-hidden="true"
            >
              {isInteractive ? '→' : '·'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
