'use client';

// T051-atomic / lifts T108 — `<CounterRow />` atomic primitive.
//
// Stand-alone counter row used by both surfaces. Renders a Blok-styled
// row with a large mono-tabular count. Status maps to semantic tokens:
//   idle    → muted-foreground (no number)
//   loading → @blok/skeleton    (no number)
//   ready   → primary           (number rendered)
//   zero    → muted-foreground  (`aria-disabled="true"`)
//   error   → destructive       (word "error" reinforces color, NFR-4.3)
//
// `aria-live="polite"` on the count region (announces value changes
// once at a time, not per-frame). Tooltip via `@blok/tooltip` when the
// `tooltip` prop is present; trigger is keyboard-reachable and exposes
// the tooltip content via `aria-label` for screen readers as well as
// the visual popover.
//
// No SDK calls. No store reads. Pure props in, render out.

import type * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

export type CounterRowStatus = 'idle' | 'loading' | 'ready' | 'zero' | 'error';

export type CounterRowProps = {
  readonly label: string;
  readonly value: number | null;
  readonly status: CounterRowStatus;
  readonly tooltip?: string;
  readonly accessibleLabel?: string;
  readonly className?: string;
  readonly onClick?: () => void;
};

function NumberCell({
  value,
  status,
}: {
  value: number | null;
  status: CounterRowStatus;
}): React.ReactElement {
  if (status === 'loading') {
    return <Skeleton className="h-7 w-12" />;
  }
  if (status === 'idle') {
    return (
      <span
        className="text-muted-foreground text-2xl font-semibold tabular-nums"
        data-state="idle"
      >
        —
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        className="text-destructive-fg text-xs font-semibold uppercase tracking-wide tabular-nums"
        data-state="error"
      >
        Error
      </span>
    );
  }
  if (status === 'zero') {
    return (
      <span
        className="text-muted-foreground text-3xl font-bold tabular-nums"
        data-state="zero"
      >
        {NUMBER_FORMATTER.format(0)}
      </span>
    );
  }
  // ready
  return (
    <span
      className="text-primary-fg text-3xl font-bold tabular-nums"
      data-state="ready"
    >
      {NUMBER_FORMATTER.format(value ?? 0)}
    </span>
  );
}

export function CounterRow({
  label,
  value,
  status,
  tooltip,
  accessibleLabel,
  className,
  onClick,
}: CounterRowProps): React.ReactElement {
  const isInteractive = status !== 'zero' && status !== 'idle' && !!onClick;
  return (
    <div
      role="group"
      aria-label={accessibleLabel ?? `${label}`}
      aria-disabled={status === 'zero' ? true : undefined}
      onClick={isInteractive ? onClick : undefined}
      className={cn(
        // counter-row vocabulary from poc-v2/styles.css
        'counter-row grid grid-cols-[88px_1fr_auto] items-center gap-3 border-b border-border bg-card px-4 py-3.5',
        isInteractive && 'cursor-pointer hover:bg-neutral-bg',
        status === 'zero' && 'cursor-not-allowed opacity-70',
        className,
      )}
    >
      <div
        data-testid="counter-row-count"
        aria-live="polite"
        className="counter-row__count flex flex-col items-start font-mono"
      >
        <NumberCell value={value} status={status} />
        <span className="counter-row__label text-muted-foreground mt-0.5 text-xs lowercase tracking-wide">
          {label}
        </span>
      </div>

      <div className="counter-row__main min-w-0" />

      {tooltip ? (
        <Tooltip>
          <TooltipTrigger
            type="button"
            data-testid="counter-row-tooltip-trigger"
            aria-label={tooltip}
            className="text-muted-foreground inline-flex h-5 w-5 items-center justify-center rounded-full text-xs"
          >
            <span aria-hidden="true">ⓘ</span>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="counter-row__chev text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}
