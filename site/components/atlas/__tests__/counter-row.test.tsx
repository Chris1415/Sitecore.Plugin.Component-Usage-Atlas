// T108 — RED tests for `<CounterRow />` (lifts to GREEN at the M4 atomic
// primitive `components/atlas/counter-row.tsx`). Per § 10 T051 + drift
// note: atomic counter row used by both surfaces. Props:
//   { label, value: number | null, status: 'idle'|'loading'|'ready'|'zero'|'error',
//     tooltip?, accessibleLabel? }
//
// Status semantic-token mapping:
//   idle     → text-muted-foreground          (no count rendered)
//   loading  → @blok/skeleton                 (no count visible)
//   ready    → text-foreground / text-primary
//   zero     → text-muted-foreground          (aria-disabled='true')
//   error    → text-destructive
//
// `aria-live="polite"` on the count region. Tooltip via `@blok/tooltip` if
// `tooltip` prop present. Numbers formatted via `Intl.NumberFormat('en-US')`
// (no thousands separators if value < 1000, else with).

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CounterRow } from '@/components/atlas/counter-row';

describe('<CounterRow /> — T108', () => {
  it('idle state: no count, label visible, accessible label set, count region aria-live=polite', () => {
    render(
      <CounterRow
        label="other pages"
        value={null}
        status="idle"
        accessibleLabel="0 other pages use Hero"
      />,
    );

    // Label is visible.
    expect(screen.getByText('other pages')).toBeInTheDocument();

    // Count region is the live region; idle renders no number, but the
    // region itself MUST be present and announce future updates politely.
    const live = screen.getByTestId('counter-row-count');
    expect(live).toHaveAttribute('aria-live', 'polite');

    // Accessible name on the row root.
    expect(screen.getByRole('group')).toHaveAttribute(
      'aria-label',
      '0 other pages use Hero',
    );
  });

  it('loading state: renders skeleton placeholder; no numeric count visible', () => {
    render(
      <CounterRow label="other pages" value={null} status="loading" />,
    );

    // Skeleton lives inside the count region; expose via data-slot.
    const live = screen.getByTestId('counter-row-count');
    expect(
      live.querySelector('[data-slot="skeleton"]'),
    ).toBeInTheDocument();
    // No numeric content rendered while loading.
    expect(live).not.toHaveTextContent(/\d/);
  });

  it('ready state, small value: no thousands separator, primary tone', () => {
    render(<CounterRow label="other pages" value={47} status="ready" />);

    const live = screen.getByTestId('counter-row-count');
    expect(live).toHaveTextContent('47');
    // Primary tone for ready, small values still primary (per v2 POC).
    expect(live.querySelector('[data-state="ready"]')).toBeInTheDocument();
  });

  it('ready state, large value: thousands-separated via Intl.NumberFormat en-US', () => {
    render(<CounterRow label="pages" value={1247} status="ready" />);

    const live = screen.getByTestId('counter-row-count');
    expect(live).toHaveTextContent('1,247');
  });

  it('zero state: count="0", row has aria-disabled="true", tone is muted, label kept (color-not-only signal)', () => {
    render(<CounterRow label="other pages" value={0} status="zero" />);

    const row = screen.getByRole('group');
    expect(row).toHaveAttribute('aria-disabled', 'true');

    const live = screen.getByTestId('counter-row-count');
    expect(live).toHaveTextContent('0');
    expect(live.querySelector('[data-state="zero"]')).toBeInTheDocument();

    // Text label still present (color is never the only signal).
    expect(screen.getByText('other pages')).toBeInTheDocument();
  });

  it('error state: tone destructive; word "error" rendered alongside icon (not color-only)', () => {
    render(<CounterRow label="other pages" value={null} status="error" />);

    const live = screen.getByTestId('counter-row-count');
    expect(live.querySelector('[data-state="error"]')).toBeInTheDocument();
    // The visible text reinforces color (NFR-4.3).
    expect(live).toHaveTextContent(/error/i);
  });

  it('tooltip prop: renders a tooltip trigger that exposes tooltip content to assistive tech', () => {
    render(
      <CounterRow
        label="other pages"
        value={3}
        status="ready"
        tooltip="Counts pages outside the active page"
      />,
    );

    // Tooltip trigger present (@blok/tooltip uses Radix; trigger is button).
    const trigger = screen.getByTestId('counter-row-tooltip-trigger');
    expect(trigger).toBeInTheDocument();
    // Accessible description exposed via aria-describedby OR via the
    // trigger's aria-label fallback for keyboard / SR users.
    expect(trigger).toHaveAttribute(
      'aria-label',
      'Counts pages outside the active page',
    );
  });
});
