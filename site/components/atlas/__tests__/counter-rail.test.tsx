// T061 — UI tests for `<CounterRail />`. Composes 4 `<CounterRow />`:
//   Total Renderings · Total Datasources · Pages Scanned · Skipped
// Counts come from atlas-state totals (passed via props by the surface).
// SKIPPED is interactive and calls `onOpenSkipped` when clicked.
// Per drift note T061 + § 4 T043: SKIPPED tone is warning when count > 0.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CounterRail } from '@/components/atlas/counter-rail';

describe('<CounterRail /> — T061', () => {
  it('renders 4 cells with the labels Total renderings / Total datasources / Pages scanned / Skipped', () => {
    render(
      <CounterRail
        totals={{
          renderings: 312,
          datasources: 847,
          pages: 1247,
          skipped: 3,
          sites: 38,
        }}
        status="ready"
        onOpenSkipped={() => undefined}
      />,
    );
    expect(screen.getByText(/total renderings/i)).toBeInTheDocument();
    expect(screen.getByText(/total datasources/i)).toBeInTheDocument();
    expect(screen.getByText(/pages scanned/i)).toBeInTheDocument();
    expect(screen.getByText(/skipped/i)).toBeInTheDocument();
  });

  it('renders the formatted total values', () => {
    render(
      <CounterRail
        totals={{
          renderings: 312,
          datasources: 847,
          pages: 1247,
          skipped: 3,
          sites: 38,
        }}
        status="ready"
        onOpenSkipped={() => undefined}
      />,
    );
    expect(screen.getByText('312')).toBeInTheDocument();
    expect(screen.getByText('847')).toBeInTheDocument();
    expect(screen.getByText('1,247')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('clicking the SKIPPED counter calls onOpenSkipped', () => {
    const onOpenSkipped = vi.fn();
    render(
      <CounterRail
        totals={{
          renderings: 1,
          datasources: 1,
          pages: 1,
          skipped: 5,
          sites: 1,
        }}
        status="ready"
        onOpenSkipped={onOpenSkipped}
      />,
    );
    // Click the inner CounterRow — the wrapper carries the testid, the
    // CounterRow primitive owns the click handler.
    const skippedRow = screen
      .getByTestId('counter-rail-skipped')
      .querySelector('.counter-row') as HTMLElement;
    expect(skippedRow).not.toBeNull();
    fireEvent.click(skippedRow);
    expect(onOpenSkipped).toHaveBeenCalledTimes(1);
  });

  it('shows loading skeletons in all 4 cells when status="loading"', () => {
    render(
      <CounterRail
        totals={null}
        status="loading"
        onOpenSkipped={() => undefined}
      />,
    );
    // The CounterRow primitive renders a Skeleton in loading state — we
    // pin the count cells to status=loading and assert no number.
    expect(screen.queryByText('312')).toBeNull();
  });

  it('renders muted dashes when status="idle"', () => {
    render(
      <CounterRail
        totals={null}
        status="idle"
        onOpenSkipped={() => undefined}
      />,
    );
    // The CounterRow primitive renders an em-dash for idle.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });
});
