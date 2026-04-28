'use client';

// T061 — `<CounterRail />`. Composes 4 atomic `<CounterRow />` cells
// horizontally: Total renderings, Total datasources, Pages scanned,
// Skipped. The Skipped cell is interactive — clicking it opens the
// skipped-pages sub-drawer (T064).
//
// Counts come from atlas state's `totals`. The surface decides the
// status (`idle` before scan, `loading` during scan, `ready` after,
// `error` on hard fail). Counter row reflects the appropriate visual
// per the M4 atomic mapping (idle → em-dash, loading → skeleton,
// ready → primary number, zero → muted, error → destructive).

import type * as React from 'react';
import { CounterRow, type CounterRowStatus } from '@/components/atlas/counter-row';
import type { AtlasTotals } from '@/lib/sdk/types';

export type CounterRailProps = {
  readonly totals: AtlasTotals | null;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly onOpenSkipped: () => void;
};

function statusFor(
  parent: CounterRailProps['status'],
  value: number | null,
): CounterRowStatus {
  if (parent === 'loading') return 'loading';
  if (parent === 'idle') return 'idle';
  if (parent === 'error') return 'error';
  if (value === null) return 'idle';
  if (value === 0) return 'zero';
  return 'ready';
}

export function CounterRail({
  totals,
  status,
  onOpenSkipped,
}: CounterRailProps): React.ReactElement {
  const renderings = totals?.renderings ?? null;
  const datasources = totals?.datasources ?? null;
  const pages = totals?.pages ?? null;
  const skipped = totals?.skipped ?? null;

  return (
    <div
      data-testid="counter-rail"
      className="counter-rail kpi-rail grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-4"
    >
      <CounterRow
        label="total renderings"
        value={renderings}
        status={statusFor(status, renderings)}
        accessibleLabel={
          renderings == null
            ? 'Total renderings: pending'
            : `Total renderings: ${renderings}`
        }
      />
      <CounterRow
        label="total datasources"
        value={datasources}
        status={statusFor(status, datasources)}
        accessibleLabel={
          datasources == null
            ? 'Total datasources: pending'
            : `Total datasources: ${datasources}`
        }
      />
      <CounterRow
        label="pages scanned"
        value={pages}
        status={statusFor(status, pages)}
        accessibleLabel={
          pages == null
            ? 'Pages scanned: pending'
            : `Pages scanned: ${pages}`
        }
      />
      <div data-testid="counter-rail-skipped">
        <CounterRow
          label="skipped"
          value={skipped}
          status={statusFor(status, skipped)}
          onClick={onOpenSkipped}
          accessibleLabel={
            skipped == null
              ? 'Skipped pages: pending'
              : `Skipped pages: ${skipped}`
          }
        />
      </div>
    </div>
  );
}
