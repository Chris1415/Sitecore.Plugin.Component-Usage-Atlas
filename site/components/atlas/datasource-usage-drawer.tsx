'use client';

// S10 — `<DatasourceUsageDrawer />`.
//
// Opened when a `DATASOURCE IMPACT` row in the panel surface is clicked.
// Distinct from `<UsageDrawer />` (rendering-target): this drawer answers
// the marketer's content-reuse question — *what other pages bind THIS
// datasource, and which renderings bind it where?*
//
// Anatomy follows POC v2 screen 5 (`Panel · counter drawer`):
//   - Header: datasource display name + pages-count pill.
//   - Subtitle: full datasource path/id (mono).
//   - Section 1: "Pages binding this datasource · N" — clickable rows that
//     route the editor to the page via `client.mutate('pages.context')`.
//   - Section 2: "Renderings binding this datasource · M" — read-only rows
//     listing each rendering definition that uses this datasource (and the
//     placement count under that rendering).
//
// Caller owns open/close state. Direct-bindings affordance is mounted in
// the body so the editor sees the locked "ⓘ Direct bindings only" copy.

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
import { DrawerRow } from '@/components/atlas/drawer-row';
import { DirectBindingsAffordance } from '@/components/atlas/direct-bindings-affordance';
import { datasourceTagColor } from '@/lib/datasource-tag';
import { dedupePages } from '@/lib/dedupe-pages';
import type { DatasourceUsage, RenderingUsage } from '@/lib/sdk/types';

export type DatasourceUsageDrawerProps = {
  readonly open: boolean;
  readonly datasource: DatasourceUsage;
  readonly allRenderings: ReadonlyMap<string, RenderingUsage>;
  readonly forbiddenPageIds?: ReadonlySet<string>;
  readonly onClose: () => void;
  readonly onNavigate: (pageId: string) => void;
};

export function DatasourceUsageDrawer({
  open,
  datasource,
  allRenderings,
  forbiddenPageIds,
  onClose,
  onNavigate,
}: DatasourceUsageDrawerProps): React.ReactElement {
  const tag = datasourceTagColor(datasource.datasourceId);
  const dedupedPages = dedupePages(datasource.pages);
  const pagesCount = dedupedPages.length;
  const renderingsCount = datasource.renderings.length;

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <SheetContent
        side="right"
        className="usage-drawer datasource-usage-drawer flex flex-col"
        aria-label={`Datasource usage details for ${datasource.displayName}`}
        data-testid="datasource-usage-drawer"
      >
        <SheetHeader className="sheet__header pr-14">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              data-testid="datasource-tag"
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: tag }}
            />
            <SheetTitle className="sheet__title flex-1 min-w-0 truncate">
              {datasource.displayName}
            </SheetTitle>
            <Badge colorScheme="primary" size="sm" className="mr-2 shrink-0">
              {pagesCount} page{pagesCount === 1 ? '' : 's'}
            </Badge>
          </div>
          <SheetDescription className="sheet__subtitle text-muted-foreground font-mono text-xs break-all">
            {datasource.datasourceId}
          </SheetDescription>
          <div className="pt-1">
            <DirectBindingsAffordance />
          </div>
        </SheetHeader>

        <ScrollArea className="sheet__body min-h-0 flex-1">
          <div className="px-2 py-2">
            <p className="sheet__section-title text-muted-foreground px-2 py-1.5 text-xs uppercase tracking-wide">
              Pages binding this datasource · {pagesCount}
            </p>
            {pagesCount === 0 ? (
              <div className="text-muted-foreground px-4 py-3 text-sm">
                No pages currently bind this datasource directly.
              </div>
            ) : (
              dedupedPages.map((p) => {
                const isForbidden = forbiddenPageIds?.has(p.pageId) ?? false;
                return (
                  <DrawerRow
                    key={p.pageId}
                    state={isForbidden ? 'forbidden' : 'normal'}
                    reason={isForbidden ? 'forbidden' : undefined}
                    onClick={isForbidden ? undefined : () => onNavigate(p.pageId)}
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

            <p className="sheet__section-title text-muted-foreground mt-3 px-2 py-1.5 text-xs uppercase tracking-wide">
              Renderings binding this datasource · {renderingsCount}
            </p>
            {renderingsCount === 0 ? (
              <div className="text-muted-foreground px-4 py-3 text-sm">
                No rendering currently binds this datasource.
              </div>
            ) : (
              datasource.renderings.map((rid) => {
                const r = allRenderings.get(rid);
                const name = r?.displayName ?? '(unknown rendering)';
                const placementCount = r
                  ? r.pages.filter((pp) =>
                      datasource.pages.some(
                        (dp) =>
                          dp.pageId === pp.pageId
                          && dp.placeholderKey === pp.placeholderKey,
                      ),
                    ).length
                  : 0;
                return (
                  <div
                    key={rid}
                    data-testid="datasource-drawer-rendering-row"
                    className="ds-card flex items-center gap-3 border-b border-border bg-card px-4 py-2.5"
                  >
                    <div className="ds-card__main min-w-0 flex-1">
                      <div className="ds-card__primary truncate font-medium">
                        {name}
                      </div>
                      <div className="ds-card__secondary text-muted-foreground font-mono text-xs">
                        {placementCount} placement{placementCount === 1 ? '' : 's'} on this datasource
                      </div>
                    </div>
                  </div>
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
              data-testid="datasource-usage-drawer-close"
            >
              Close drawer
            </Button>
          </span>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
