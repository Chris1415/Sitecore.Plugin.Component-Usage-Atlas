// T111 — RED tests for `<DrawerRow />` (lifts to GREEN at the M4 atomic
// primitive `components/atlas/drawer-row.tsx`).
//
// Per § 10 T082 + drift note: state-aware drawer row primitive. Props:
//   { children, state: 'normal'|'forbidden'|'disabled', reason?, onClick? }
// Forbidden/disabled rows: aria-disabled="true", dim styling, reason
// chip via @blok/badge with the typed reason text. Click handler is a
// no-op when disabled.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrawerRow } from '@/components/atlas/drawer-row';

describe('<DrawerRow /> — T111', () => {
  it('normal state: click invokes onClick; row is NOT aria-disabled', () => {
    const onClick = vi.fn();
    render(
      <DrawerRow state="normal" onClick={onClick}>
        Marketing / Home
      </DrawerRow>,
    );

    const row = screen.getByRole('button', { name: /Marketing \/ Home/i });
    expect(row).not.toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forbidden state: aria-disabled="true"; click does NOT invoke onClick; reason chip rendered', () => {
    const onClick = vi.fn();
    render(
      <DrawerRow state="forbidden" reason="forbidden" onClick={onClick}>
        Internal / Secret
      </DrawerRow>,
    );

    const row = screen.getByRole('button', { name: /Internal \/ Secret/i });
    expect(row).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(row);
    expect(onClick).not.toHaveBeenCalled();

    // Reason chip text matches prop (NFR-4.3 — color is never the only
    // signal, the word is rendered).
    const chip = screen.getByTestId('drawer-row-reason-chip');
    expect(chip).toHaveTextContent('forbidden');
  });

  it('disabled state: aria-disabled="true"; click does NOT invoke onClick', () => {
    const onClick = vi.fn();
    render(
      <DrawerRow state="disabled" onClick={onClick}>
        Soft Disabled Row
      </DrawerRow>,
    );

    const row = screen.getByRole('button', { name: /Soft Disabled Row/i });
    expect(row).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(row);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forbidden state with reason="timeout": chip text reflects the typed reason verbatim', () => {
    render(
      <DrawerRow state="forbidden" reason="timeout">
        Slow Page
      </DrawerRow>,
    );
    const chip = screen.getByTestId('drawer-row-reason-chip');
    expect(chip).toHaveTextContent('timeout');
  });

  it('disabled state without reason: no reason chip rendered', () => {
    render(
      <DrawerRow state="disabled">
        Quiet Row
      </DrawerRow>,
    );
    expect(
      screen.queryByTestId('drawer-row-reason-chip'),
    ).not.toBeInTheDocument();
  });

  it('keyboard activation: Enter triggers onClick when normal; ignored when disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <DrawerRow state="normal" onClick={onClick}>
        Active
      </DrawerRow>,
    );
    const row = screen.getByRole('button', { name: 'Active' });
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <DrawerRow state="forbidden" reason="forbidden" onClick={onClick}>
        Active
      </DrawerRow>,
    );
    fireEvent.keyDown(
      screen.getByRole('button', { name: /Active/ }),
      { key: 'Enter' },
    );
    expect(onClick).toHaveBeenCalledTimes(1); // unchanged
  });
});
