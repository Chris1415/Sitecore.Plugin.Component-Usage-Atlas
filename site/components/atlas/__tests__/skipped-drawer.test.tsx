// T064 — UI tests for `<SkippedDrawer />`. Per § 4 T064 + § 10 T064 +
// drift note: groups skipped pages by reason; each chip uses the
// matching DrawerRow `reason` prop so color is reinforced with text
// (NFR-4.3); click on a page row is DISABLED (state="forbidden" or
// "disabled" — never navigates because we couldn't read the page).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkippedDrawer } from '@/components/atlas/skipped-drawer';
import type { Skipped } from '@/lib/sdk/types';

const SKIPPED: ReadonlyArray<Skipped> = [
  { pageId: 'p1', pageName: 'Restricted A', reason: 'forbidden', cause: '403' },
  { pageId: 'p2', pageName: 'Restricted B', reason: 'forbidden' },
  { pageId: 'p3', pageName: 'Slow page', reason: 'timeout' },
  { pageId: 'p4', pageName: 'Lost page', reason: 'not_found' },
  { pageId: 'p5', pageName: 'Network blip', reason: 'network_error' },
];

describe('<SkippedDrawer /> — T064', () => {
  it('opens when `open` is true and renders one section per skip reason group', () => {
    render(
      <SkippedDrawer
        open
        skipped={SKIPPED}
        onClose={() => undefined}
      />,
    );
    // Section headings.
    expect(screen.getByText(/forbidden \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/timeout \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/not_found \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/network_error \(1\)/i)).toBeInTheDocument();
    // All page names render.
    expect(screen.getByText('Restricted A')).toBeInTheDocument();
    expect(screen.getByText('Restricted B')).toBeInTheDocument();
    expect(screen.getByText('Slow page')).toBeInTheDocument();
  });

  it('forbidden chips use the danger reason badge with the word `forbidden`', () => {
    render(
      <SkippedDrawer
        open
        skipped={SKIPPED.filter((s) => s.reason === 'forbidden')}
        onClose={() => undefined}
      />,
    );
    const chips = screen.getAllByTestId('drawer-row-reason-chip');
    expect(chips.length).toBeGreaterThan(0);
    chips.forEach((chip) => expect(chip).toHaveTextContent('forbidden'));
  });

  it('clicking a page row does NOT call any navigation callback (rows are disabled)', () => {
    const onNavigate = vi.fn();
    render(
      <SkippedDrawer
        open
        skipped={SKIPPED}
        onClose={() => undefined}
        onNavigate={onNavigate}
      />,
    );
    const rows = screen.getAllByRole('button', { name: /(Restricted|Slow|Lost|Network)/i });
    rows.forEach((row) => fireEvent.click(row));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('renders a footer Close button that calls onClose', () => {
    const onClose = vi.fn();
    render(<SkippedDrawer open skipped={SKIPPED} onClose={onClose} />);
    // Sheet primitive auto-injects a sr-only "Close" icon button — use
    // testid to target the visible footer Close.
    fireEvent.click(screen.getByTestId('skipped-drawer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns nothing visible when `open` is false', () => {
    render(
      <SkippedDrawer
        open={false}
        skipped={SKIPPED}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByText('Restricted A')).toBeNull();
  });
});
