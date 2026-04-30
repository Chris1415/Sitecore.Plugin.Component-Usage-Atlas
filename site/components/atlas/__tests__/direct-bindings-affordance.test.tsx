// T112 — RED tests for `<DirectBindingsAffordance />` (lifts to GREEN
// at the M4 atomic primitive
// `components/atlas/direct-bindings-affordance.tsx`).
//
// Per § 10 T080 + ADR-0006 § Decision: the affordance is ALWAYS
// rendered and its tooltip copy MUST match the ADR string verbatim
// (string equality, not "contains").

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DirectBindingsAffordance } from '@/components/atlas/direct-bindings-affordance';

const LOCKED_COPY =
  "Counts include datasources bound directly on the page's layout. Inherited (page designs), personalized, A/B variant, and token-resolved bindings are not counted in this version.";

describe('<DirectBindingsAffordance /> — T112', () => {
  it('rendered (always visible) with the "Direct bindings only" label', () => {
    render(<DirectBindingsAffordance />);
    expect(screen.getByText(/Direct bindings only/i)).toBeInTheDocument();
  });

  it('tooltip trigger has aria-label set to the locked ADR-0006 copy verbatim', () => {
    render(<DirectBindingsAffordance />);
    const trigger = screen.getByTestId('direct-bindings-trigger');
    expect(trigger).toHaveAttribute('aria-label', LOCKED_COPY);
  });

  it('S13 — trigger is removed from the keyboard tab order', () => {
    // Per the S13 fix: when the affordance lives inside a Sheet (rendering
    // / datasource drawers), Radix Dialog auto-focuses the first focusable
    // descendant. If the trigger were tabbable, focus would land on it on
    // every drawer open and Radix Tooltip would pop open without any user
    // interaction — the very behaviour the user complained about. The
    // copy is still keyboard-accessible via the aria-label and the glyph
    // is still hover/click-reachable; we just opt out of the tab order.
    render(<DirectBindingsAffordance />);
    const trigger = screen.getByTestId('direct-bindings-trigger');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('tabIndex')).toBe('-1');
  });

  it('renders an info glyph with aria-hidden="true" so the icon is not double-announced', () => {
    render(<DirectBindingsAffordance />);
    const glyph = screen.getByTestId('direct-bindings-glyph');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
  });

  it('respects optional className for placement on either surface', () => {
    render(<DirectBindingsAffordance className="custom-zone-2-spacing" />);
    expect(
      screen
        .getByTestId('direct-bindings-affordance')
        .className.includes('custom-zone-2-spacing'),
    ).toBe(true);
  });
});
