'use client';

// T063 / T046 — `<UsageDrawer />` (per-rendering page-list drawer).
//
// Composes Blok @blok/sheet with the M4 `<RenderingNameCell />`,
// `<DrawerRow />`, and `<DirectBindingsAffordance />` primitives.
// Caller (the widget surface) provides `onNavigate(pageId)` which
// hooks into `client.mutate('pages.context', { params: { itemId } })`
// — the drawer itself stays surface-agnostic so it can be reused
// later by the panel surface (M6).
//
// Body uses Blok @blok/scroll-area so long page lists scroll
// independently of the surface. Header carries the rendering name +
// collision suffix (delegated to `<RenderingNameCell />`). Footer
// carries an Esc kbd hint and a Close button. Direct-bindings
// affordance is mounted in the body so the editor sees the locked
// "ⓘ Direct bindings only" copy on every drawer open.

import type * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';
import { RenderingNameCell } from '@/components/atlas/rendering-name-cell';
import { DrawerRow } from '@/components/atlas/drawer-row';
import { DirectBindingsAffordance } from '@/components/atlas/direct-bindings-affordance';
import { computeCollisions } from '@/lib/collisions';
import { dedupePages } from '@/lib/dedupe-pages';
import type { RenderingUsage } from '@/lib/sdk/types';

export type UsageDrawerProps = {
  readonly open: boolean;
  readonly rendering: RenderingUsage;
  readonly allRenderings: ReadonlyMap<string, RenderingUsage>;
  readonly forbiddenPageIds?: ReadonlySet<string>;
  readonly onClose: () => void;
  readonly onNavigate: (pageId: string) => void;
};

export function UsageDrawer({
  open,
  rendering,
  allRenderings,
  forbiddenPageIds,
  onClose,
  onNavigate,
}: UsageDrawerProps): React.ReactElement {
  // Drawer renders only one `<RenderingNameCell />` (in the header), so
  // the collision-map perf concern is small here — but threading the
  // memoized map keeps the API consistent and avoids the cell falling
  // back to the local-recompute path.
  const collisionMap = useMemo(
    () => computeCollisions(Array.from(allRenderings.values())),
    [allRenderings],
  );
  const dedupedPages = useMemo(
    () => dedupePages(rendering.pages),
    [rendering.pages],
  );
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <SheetContent
        side="right"
        className="usage-drawer flex flex-col"
        aria-label={`Usage details for ${rendering.displayName}`}
      >
        <SheetHeader className="sheet__header pr-14">
          <div className="flex items-center gap-2">
            <SheetTitle className="sheet__title flex-1 min-w-0">
              <RenderingNameCell
                renderingId={rendering.renderingId}
                renderingName={rendering.displayName}
                allRenderings={allRenderings}
                collisionMap={collisionMap}
              />
            </SheetTitle>
            <Badge colorScheme="primary" size="sm" className="mr-2 shrink-0">
              {rendering.totalUsages} use{rendering.totalUsages === 1 ? '' : 's'}
            </Badge>
          </div>
          <SheetDescription className="sheet__subtitle text-muted-foreground font-mono text-xs">
            {dedupedPages.length} page
            {dedupedPages.length === 1 ? '' : 's'} · {rendering.totalUsages} placement
            {rendering.totalUsages === 1 ? '' : 's'} · {rendering.datasources.length}{' '}
            datasource{rendering.datasources.length === 1 ? '' : 's'}
          </SheetDescription>
          <div className="pt-1">
            <DirectBindingsAffordance />
          </div>
        </SheetHeader>

        <ScrollArea className="sheet__body min-h-0 flex-1">
          <div className="px-2 py-2">
            <p className="sheet__section-title text-muted-foreground px-2 py-1.5 text-xs uppercase tracking-wide">
              Direct rendering usage · {dedupedPages.length} page
              {dedupedPages.length === 1 ? '' : 's'}
            </p>
            {dedupedPages.length === 0 ? (
              <div className="text-muted-foreground px-4 py-3 text-sm">
                No pages currently use this rendering.
              </div>
            ) : (
              dedupedPages.map((p) => {
                const isForbidden = forbiddenPageIds?.has(p.pageId) ?? false;
                return (
                  <DrawerRow
                    key={p.pageId}
                    state={isForbidden ? 'forbidden' : 'normal'}
                    reason={isForbidden ? 'forbidden' : undefined}
                    onClick={
                      isForbidden ? undefined : () => onNavigate(p.pageId)
                    }
                  >
                    <span className="page-row__name font-medium">
                      {p.pageName}
                    </span>
                    <span className="page-row__meta text-muted-foreground ml-2 font-mono text-xs">
                      · {p.siteName} {p.sitePath}
                    </span>
                    {p.placements > 1 ? (
                      <Badge colorScheme="primary" size="sm" className="ml-auto">
                        ×{p.placements}
                      </Badge>
                    ) : null}
                  </DrawerRow>
                );
              })
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="sheet__footer">
          <span className="text-muted-foreground font-mono text-xs">
            esc closes · click row to navigate
          </span>
          <span className="row inline-flex items-center gap-2">
            <Kbd>Esc</Kbd>
            <Button
              type="button"
              variant="ghost"
              colorScheme="neutral"
              size="sm"
              onClick={onClose}
              data-testid="usage-drawer-close"
            >
              Close drawer
            </Button>
          </span>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
