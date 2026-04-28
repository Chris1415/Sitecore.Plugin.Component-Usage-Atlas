// T110 — RED tests for `<RenderingNameCell />` (lifts to GREEN at T044
// `components/atlas/rendering-name-cell.tsx`).
//
// Per § 10 T044 + drift note:
//   1. No collision → display name only; no badge.
//   2. Collision → display name + `· <last-7-of-id>` badge; tooltip on
//      hover shows full ID.
//   3. Unknown rendering → label `(unknown rendering)`.
//   4. Full ID exposed via aria-label on the badge for SR users (the
//      v2 drift note mandates "full ID is in DOM for screen readers").
//   5. Layout preserves keyboard focusability.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RenderingNameCell } from '@/components/atlas/rendering-name-cell';
import type { RenderingUsage } from '@/lib/sdk/types';

const ru = (
  renderingId: string,
  displayName: string,
  isUnknown = false,
): RenderingUsage => ({
  renderingId,
  displayName,
  isUnknown,
  pages: [],
  datasources: [],
  totalUsages: 0,
});

describe('<RenderingNameCell /> — T110', () => {
  it('no collision → display name only; no collision suffix badge', () => {
    const all = new Map<string, RenderingUsage>();
    all.set('id-aaaaaaa', ru('id-aaaaaaa', 'Hero'));
    all.set('id-bbbbbbb', ru('id-bbbbbbb', 'Card'));

    render(
      <RenderingNameCell
        renderingId="id-aaaaaaa"
        renderingName="Hero"
        allRenderings={all}
      />,
    );

    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(
      screen.queryByTestId('rendering-name-cell-suffix'),
    ).not.toBeInTheDocument();
  });

  it('collision case → display name + `· <last-7>` suffix; full ID exposed for SR', () => {
    const all = new Map<string, RenderingUsage>();
    all.set('id-1234567', ru('id-1234567', 'HeroV2'));
    all.set('id-abcdefg', ru('id-abcdefg', 'HeroV2'));

    render(
      <RenderingNameCell
        renderingId="id-1234567"
        renderingName="HeroV2"
        allRenderings={all}
      />,
    );

    expect(screen.getByText('HeroV2')).toBeInTheDocument();
    const suffix = screen.getByTestId('rendering-name-cell-suffix');
    expect(suffix).toHaveTextContent('· 1234567');
    // Full ID accessible to screen readers via aria-label.
    expect(suffix).toHaveAttribute('aria-label', 'Full ID: id-1234567');
  });

  it('collision suffix appears for the OTHER colliding rendering too (independent IDs)', () => {
    const all = new Map<string, RenderingUsage>();
    all.set('id-1234567', ru('id-1234567', 'HeroV2'));
    all.set('id-abcdefg', ru('id-abcdefg', 'HeroV2'));

    render(
      <RenderingNameCell
        renderingId="id-abcdefg"
        renderingName="HeroV2"
        allRenderings={all}
      />,
    );

    const suffix = screen.getByTestId('rendering-name-cell-suffix');
    expect(suffix).toHaveTextContent('· abcdefg');
    expect(suffix).toHaveAttribute('aria-label', 'Full ID: id-abcdefg');
  });

  it('unknown rendering → label is "(unknown rendering)" and full ID still exposed via aria-label', () => {
    const all = new Map<string, RenderingUsage>();
    all.set(
      'unknown:p1:main:0',
      ru('unknown:p1:main:0', '(unknown rendering)', true),
    );

    render(
      <RenderingNameCell
        renderingId="unknown:p1:main:0"
        renderingName="(unknown rendering)"
        allRenderings={all}
      />,
    );

    expect(screen.getByText('(unknown rendering)')).toBeInTheDocument();
    // The cell root MUST surface the full synthetic ID in DOM for SR.
    const root = screen.getByTestId('rendering-name-cell');
    expect(root).toHaveAttribute(
      'aria-label',
      'Unknown rendering at unknown:p1:main:0',
    );
  });

  it('keyboard focusability preserved: full ID badge is reachable via tab order', () => {
    const all = new Map<string, RenderingUsage>();
    all.set('id-1234567', ru('id-1234567', 'HeroV2'));
    all.set('id-abcdefg', ru('id-abcdefg', 'HeroV2'));

    render(
      <RenderingNameCell
        renderingId="id-1234567"
        renderingName="HeroV2"
        allRenderings={all}
      />,
    );

    const suffix = screen.getByTestId('rendering-name-cell-suffix');
    // tabIndex=0 ensures the badge enters the focus order so SR users
    // can land on it and read the aria-label.
    expect(suffix).toHaveAttribute('tabIndex', '0');
  });
});
