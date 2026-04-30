'use client';

// T060-atomic / lifts T109 — `<ScanStatusBar />` atomic primitive.
//
// Three pulse-segments (Sites / Pages / Components) plus a numerical
// readout below: `{Phase} {current} / {total} · {mm:ss}`. Cancel button
// (Blok @blok/button outline) sits at the right; only rendered when
// `isCancellable` is true.
//
// Accessibility:
//   - root has role="status" + aria-live="polite" + aria-atomic="true"
//     + aria-label="Scan progress" — phase transitions are announced
//     once per change, not per page.
//   - Cancel button labelled `aria-label="Cancel scan"`.
//   - 60fps via CSS transitions only — no setInterval, no <canvas>,
//     no setState animation loop. The `@keyframes` is in poc-v2 styles
//     under `.scan-status__seg[data-state="active"]`; the v2 vocabulary
//     is preserved here via classNames so the visual lift drops in.

import type * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type PhaseState = 'pending' | 'active' | 'completed';

export type ScanStatusBarProps = {
  readonly phases: {
    readonly sites: PhaseState;
    readonly pages: PhaseState;
    readonly components: PhaseState;
  };
  readonly currentPhase:
    | 'sites'
    | 'pages'
    | 'components'
    | 'idle'
    | 'complete'
    | 'error';
  readonly counts: { readonly current: number; readonly total: number };
  readonly elapsedMs: number;
  readonly onCancel: () => void;
  readonly isCancellable: boolean;
};

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

function phaseLabel(
  currentPhase: ScanStatusBarProps['currentPhase'],
): string {
  switch (currentPhase) {
    case 'sites':
      return 'Sites';
    case 'pages':
      return 'Pages';
    case 'components':
      return 'Components';
    case 'complete':
      return 'Complete';
    case 'error':
      return 'Error';
    case 'idle':
    default:
      return 'Idle';
  }
}

function Segment({
  id,
  state,
}: {
  id: 'sites' | 'pages' | 'components';
  state: PhaseState;
}): React.ReactElement {
  return (
    <div
      data-testid={`scan-status-segment-${id}`}
      data-state={state}
      role="presentation"
      className={cn(
        'scan-status__seg relative h-1.5 flex-1 overflow-hidden rounded-full',
        // pending → muted; active → primary with pulse; completed → success
        state === 'pending' && 'bg-neutral-bg',
        state === 'active' &&
          'bg-primary motion-safe:animate-pulse',
        state === 'completed' && 'bg-success',
      )}
    />
  );
}

export function ScanStatusBar({
  phases,
  currentPhase,
  counts,
  elapsedMs,
  onCancel,
  isCancellable,
}: ScanStatusBarProps): React.ReactElement {
  const phase = phaseLabel(currentPhase);
  const fmtCurrent = NUMBER_FORMATTER.format(counts.current);
  const fmtTotal = NUMBER_FORMATTER.format(counts.total);
  const elapsed = formatElapsed(elapsedMs);

  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Scan progress"
      className="scan-status flex flex-col gap-2 border-b border-border bg-card px-4 py-3"
    >
      <div className="scan-status__row flex items-center gap-3">
        <div className="scan-status__bar flex flex-1 gap-1.5">
          <Segment id="sites" state={phases.sites} />
          <Segment id="pages" state={phases.pages} />
          <Segment id="components" state={phases.components} />
        </div>

        {isCancellable ? (
          <Button
            type="button"
            variant="outline"
            colorScheme="neutral"
            size="sm"
            aria-label="Cancel scan"
            onClick={onCancel}
            className="scan-status__cancel"
          >
            Cancel
          </Button>
        ) : null}
      </div>

      <div
        data-testid="scan-status-readout"
        className="scan-status__readout text-muted-foreground font-mono text-xs tabular-nums"
      >
        {phase} {fmtCurrent} / {fmtTotal} · {elapsed}
      </div>

      <span className="scan-status__seg-labels sr-only">
        <span data-state={phases.sites}>Sites</span>{' '}
        <span data-state={phases.pages}>Pages</span>{' '}
        <span data-state={phases.components}>Components</span>
      </span>
    </section>
  );
}
