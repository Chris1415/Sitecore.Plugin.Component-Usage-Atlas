// T109 — RED tests for `<ScanStatusBar />` (lifts to GREEN at the M4
// atomic primitive `components/atlas/scan-status-bar.tsx`).
//
// Per § 10 T060 + drift note: 3 segments (sites/pages/components),
// each in pending|active|completed. Numerical readout below:
// `{currentPhase} {completed}/{total} · {elapsed}`. Cancel button on
// the right (uses Blok @blok/button with variant="outline"). aria-live
// "polite" on the readout, role="status" + aria-live on the bar root,
// aria-label="Scan progress" on the bar root. CSS-only animations.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScanStatusBar } from '@/components/atlas/scan-status-bar';

const phasesPending = {
  sites: 'pending' as const,
  pages: 'pending' as const,
  components: 'pending' as const,
};

describe('<ScanStatusBar /> — T109', () => {
  it('renders 3 segments (sites/pages/components) with their state in data-state', () => {
    render(
      <ScanStatusBar
        phases={{
          sites: 'completed',
          pages: 'active',
          components: 'pending',
        }}
        currentPhase="pages"
        counts={{ current: 412, total: 1247 }}
        elapsedMs={23_000}
        onCancel={() => undefined}
        isCancellable={true}
      />,
    );

    expect(screen.getByTestId('scan-status-segment-sites')).toHaveAttribute(
      'data-state',
      'completed',
    );
    expect(screen.getByTestId('scan-status-segment-pages')).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(
      screen.getByTestId('scan-status-segment-components'),
    ).toHaveAttribute('data-state', 'pending');
  });

  it('outer container has role="status" + aria-live="polite" + aria-atomic="true" + aria-label="Scan progress"', () => {
    render(
      <ScanStatusBar
        phases={phasesPending}
        currentPhase="idle"
        counts={{ current: 0, total: 0 }}
        elapsedMs={0}
        onCancel={() => undefined}
        isCancellable={false}
      />,
    );

    const root = screen.getByRole('status');
    expect(root).toHaveAttribute('aria-live', 'polite');
    expect(root).toHaveAttribute('aria-atomic', 'true');
    expect(root).toHaveAttribute('aria-label', 'Scan progress');
  });

  it('numerical readout reflects current phase, counts and elapsed seconds in mm:ss', () => {
    render(
      <ScanStatusBar
        phases={{
          sites: 'completed',
          pages: 'active',
          components: 'pending',
        }}
        currentPhase="pages"
        counts={{ current: 412, total: 1247 }}
        elapsedMs={23_000}
        onCancel={() => undefined}
        isCancellable={true}
      />,
    );

    const readout = screen.getByTestId('scan-status-readout');
    expect(readout).toHaveTextContent('Pages 412 / 1,247 · 00:23');
  });

  it('cancel button rendered when isCancellable=true; aria-label="Cancel scan"; click invokes onCancel', () => {
    const onCancel = vi.fn();
    render(
      <ScanStatusBar
        phases={phasesPending}
        currentPhase="sites"
        counts={{ current: 0, total: 8 }}
        elapsedMs={2_000}
        onCancel={onCancel}
        isCancellable={true}
      />,
    );

    const btn = screen.getByRole('button', { name: 'Cancel scan' });
    fireEvent.click(btn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancel button hidden when isCancellable=false', () => {
    render(
      <ScanStatusBar
        phases={{
          sites: 'completed',
          pages: 'completed',
          components: 'completed',
        }}
        currentPhase="complete"
        counts={{ current: 1247, total: 1247 }}
        elapsedMs={42_000}
        onCancel={() => undefined}
        isCancellable={false}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Cancel scan' }),
    ).not.toBeInTheDocument();
  });

  it('completed state: all three segments have data-state="completed"; readout shows "Complete"', () => {
    render(
      <ScanStatusBar
        phases={{
          sites: 'completed',
          pages: 'completed',
          components: 'completed',
        }}
        currentPhase="complete"
        counts={{ current: 1247, total: 1247 }}
        elapsedMs={42_000}
        onCancel={() => undefined}
        isCancellable={false}
      />,
    );

    expect(screen.getByTestId('scan-status-segment-sites')).toHaveAttribute(
      'data-state',
      'completed',
    );
    expect(screen.getByTestId('scan-status-segment-pages')).toHaveAttribute(
      'data-state',
      'completed',
    );
    expect(
      screen.getByTestId('scan-status-segment-components'),
    ).toHaveAttribute('data-state', 'completed');
    expect(screen.getByTestId('scan-status-readout')).toHaveTextContent(
      /complete/i,
    );
  });

  it('error state: readout includes the word "Error" (color is not the only signal)', () => {
    render(
      <ScanStatusBar
        phases={{
          sites: 'completed',
          pages: 'pending',
          components: 'pending',
        }}
        currentPhase="error"
        counts={{ current: 0, total: 0 }}
        elapsedMs={5_000}
        onCancel={() => undefined}
        isCancellable={false}
      />,
    );

    expect(screen.getByTestId('scan-status-readout')).toHaveTextContent(
      /error/i,
    );
  });
});
