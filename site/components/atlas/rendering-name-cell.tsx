'use client';

// T044 — `<RenderingNameCell />` (lifts T110).
//
// Atomic primitive that renders a rendering's display name and, when a
// display-name collision exists in the calling set, appends a
// `· <last-7-of-id>` disambiguation suffix per FR-9 / ADR-0005. The
// suffix is also a tooltip trigger that exposes the FULL rendering ID
// for screen readers and on hover.
//
// Visual vocabulary tracks `.rendering-cell` from poc-v2/styles.css.
//
// Performance note (M1 fix from code-review-20260428T110500Z):
// Callers should pass an already-computed `collisionMap` so the
// O(N) collision pass runs once per render of the parent table, not
// O(N) per row (which would be O(N²) overall). When `collisionMap` is
// omitted the cell falls back to computing the map locally — this is
// kept for backwards-compat with single-row test fixtures that hand the
// cell a 1-element `allRenderings` map.

import type * as React from 'react';
import { cn } from '@/lib/utils';
import { computeCollisions, type CollisionEntry } from '@/lib/collisions';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { RenderingUsage } from '@/lib/sdk/types';

export type RenderingNameCellProps = {
  readonly renderingId: string;
  readonly renderingName: string;
  readonly allRenderings: ReadonlyMap<string, RenderingUsage>;
  /**
   * Optional precomputed collision map — produced once at the parent
   * (e.g. `<WidgetTable />` or `<RenderingImpactList />`) via
   * `computeCollisions(Array.from(allRenderings.values()))` and passed
   * down so the O(N) collision pass is not repeated per row.
   */
  readonly collisionMap?: ReadonlyMap<string, CollisionEntry>;
  readonly className?: string;
};

export function RenderingNameCell({
  renderingId,
  renderingName,
  allRenderings,
  collisionMap,
  className,
}: RenderingNameCellProps): React.ReactElement {
  const me = allRenderings.get(renderingId);
  const isUnknown = me?.isUnknown ?? false;

  const effectiveMap =
    collisionMap ?? computeCollisions(Array.from(allRenderings.values()));
  const suffix = effectiveMap.get(renderingId)?.suffix ?? null;

  const accessibleLabel = isUnknown
    ? `Unknown rendering at ${renderingId}`
    : suffix
      ? `${renderingName} (full ID ${renderingId})`
      : renderingName;

  return (
    <span
      data-testid="rendering-name-cell"
      aria-label={accessibleLabel}
      className={cn(
        'rendering-cell inline-flex items-center gap-1.5',
        isUnknown && 'rendering-cell--unknown text-muted-foreground italic',
        className,
      )}
    >
      <span className="rendering-cell__name font-medium">{renderingName}</span>
      {suffix ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              data-testid="rendering-name-cell-suffix"
              tabIndex={0}
              role="note"
              aria-label={`Full ID: ${renderingId}`}
              className="rendering-cell__suffix text-muted-foreground inline-flex h-4 items-center rounded bg-neutral-bg px-1 font-mono text-[0.6875rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {suffix}
            </span>
          </TooltipTrigger>
          <TooltipContent>{renderingId}</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}
