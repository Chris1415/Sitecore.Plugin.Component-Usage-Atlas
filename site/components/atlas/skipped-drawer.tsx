'use client';

// T064 (sub-drawer) / T047 — `<SkippedDrawer />`.
//
// Lists `Skipped` entries grouped by reason. Built on Blok @blok/sheet.
// Each row is a `<DrawerRow state="forbidden" reason="forbidden">` (or
// equivalent for other reasons) so:
//   - color is reinforced with text (`forbidden`, `timeout`, etc — the
//     literal reason string is the chip body, NFR-4.3),
//   - click is disabled (we can't navigate to pages we couldn't read).
//
// The "open from KPI link" path lives in the surface (T040) — this
// component is a controlled dialog; caller passes `open` + `onClose`.

import type * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { DrawerRow } from '@/components/atlas/drawer-row';
import type { Skipped, SkipReason } from '@/lib/sdk/types';

const REASON_ORDER: ReadonlyArray<SkipReason> = [
  'forbidden',
  'timeout',
  'not_found',
  'network_error',
  'other',
];

export type SkippedDrawerProps = {
  readonly open: boolean;
  readonly skipped: ReadonlyArray<Skipped>;
  readonly onClose: () => void;
  readonly onNavigate?: (pageId: string) => void;
};

function groupByReason(
  skipped: ReadonlyArray<Skipped>,
): ReadonlyMap<SkipReason, ReadonlyArray<Skipped>> {
  const map = new Map<SkipReason, Skipped[]>();
  for (const item of skipped) {
    const arr = map.get(item.reason) ?? [];
    arr.push(item);
    map.set(item.reason, arr);
  }
  return map;
}

export function SkippedDrawer({
  open,
  skipped,
  onClose,
}: SkippedDrawerProps): React.ReactElement {
  const groups = groupByReason(skipped);

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <SheetContent
        side="right"
        className="skipped-drawer"
        aria-label="Skipped pages"
      >
        <SheetHeader>
          <SheetTitle>Skipped pages</SheetTitle>
          <SheetDescription>
            {skipped.length} page{skipped.length === 1 ? '' : 's'} were not
            included in the atlas. Click-through is disabled — the scan
            could not read these pages.
          </SheetDescription>
        </SheetHeader>

        <div className="sheet__body flex-1 overflow-y-auto px-2 py-2">
          {REASON_ORDER.flatMap((reason) => {
            const items = groups.get(reason);
            if (!items || items.length === 0) return [];
            return [
              <section
                key={reason}
                className="sheet__section pb-3"
                aria-label={`${reason} skipped pages`}
              >
                <p className="sheet__section-title text-muted-foreground px-2 py-1.5 text-xs uppercase tracking-wide">
                  {reason} ({items.length})
                </p>
                {items.map((s) => (
                  <DrawerRow
                    key={s.pageId}
                    state="forbidden"
                    reason={reason}
                  >
                    <span className="page-row__name font-medium">
                      {s.pageName ?? `(unnamed) ${s.pageId.slice(0, 7)}`}
                    </span>
                    {s.cause ? (
                      <span className="page-row__meta text-muted-foreground ml-2 font-mono text-xs">
                        · {s.cause}
                      </span>
                    ) : null}
                  </DrawerRow>
                ))}
              </section>,
            ];
          })}
        </div>

        <SheetFooter className="sheet__footer">
          <span className="text-muted-foreground font-mono text-xs">
            esc closes
          </span>
          <span className="row inline-flex items-center gap-2">
            <Kbd>Esc</Kbd>
            <Button
              type="button"
              variant="ghost"
              colorScheme="neutral"
              size="sm"
              onClick={onClose}
              data-testid="skipped-drawer-close"
            >
              Close drawer
            </Button>
          </span>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
