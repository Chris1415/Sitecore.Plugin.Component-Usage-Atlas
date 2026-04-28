'use client';

// T082-atomic / lifts T111 — `<DrawerRow />` state-aware row primitive.
//
// Wrap drawer content in a state-aware row that knows about three
// states:
//   - normal     → click navigates / triggers onClick
//   - forbidden  → click is suppressed; reason chip rendered
//   - disabled   → click is suppressed; no reason chip unless provided
//
// Used by `<UsageDrawer />` (later) and `<SkippedDrawer />` (later).
// NFR-4.3: typed-reason text is rendered verbatim so color isn't the
// only signal.

import { type ReactNode, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type DrawerRowState = 'normal' | 'forbidden' | 'disabled';

export type DrawerRowProps = {
  readonly children: ReactNode;
  readonly state: DrawerRowState;
  readonly reason?: string;
  readonly onClick?: () => void;
  readonly className?: string;
};

function reasonTone(
  reason: string | undefined,
): 'danger' | 'warning' | 'neutral' {
  if (!reason) return 'neutral';
  if (reason === 'forbidden') return 'danger';
  if (
    reason === 'timeout' ||
    reason === 'network_error' ||
    reason === 'not_found' ||
    reason === 'other'
  ) {
    return 'warning';
  }
  return 'neutral';
}

export function DrawerRow({
  children,
  state,
  reason,
  onClick,
  className,
}: DrawerRowProps): React.ReactElement {
  const disabled = state === 'forbidden' || state === 'disabled';

  const handleClick = (): void => {
    if (disabled) return;
    onClick?.();
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
      onKeyDown={handleKey}
      className={cn(
        'page-row flex items-center gap-2.5 border-b border-border px-4 py-2.5',
        disabled
          ? 'cursor-not-allowed bg-muted/50 text-muted-foreground'
          : 'cursor-pointer hover:bg-neutral-bg',
        className,
      )}
    >
      <span className="page-row__main min-w-0 flex-1">{children}</span>
      {reason ? (
        <Badge
          data-testid="drawer-row-reason-chip"
          colorScheme={reasonTone(reason)}
          size="sm"
        >
          {reason}
        </Badge>
      ) : null}
    </div>
  );
}
