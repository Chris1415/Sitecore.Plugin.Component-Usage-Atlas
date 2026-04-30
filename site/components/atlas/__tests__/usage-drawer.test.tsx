// T042 / T046 / T063 — UI tests for `<UsageDrawer />`. Per § 4 T063 +
// § 10 T063: drawer slides from the right, header carries the
// rendering display name + collision suffix + ID-copy affordance,
// body lists each page-row using the M4 `<DrawerRow />` primitive,
// click on a page row calls `onNavigate(pageId)` (which the surface
// wires to `client.mutate('pages.context', …)`), Esc + footer Close
// fire `onClose`, footer carries an Esc kbd hint, body wraps in a
// scroll area.
//
// We deliberately do NOT click-through to the SDK in this test —
// the surface is responsible for the SDK call. The drawer just emits
// `onNavigate(pageId)` as the click contract.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UsageDrawer } from '@/components/atlas/usage-drawer';
import type { RenderingUsage } from '@/lib/sdk/types';

const HERO: RenderingUsage = {
  renderingId: 'rid-hero-1234567',
  displayName: 'Hero Banner',
  isUnknown: false,
  totalUsages: 3,
  datasources: ['ds-1', 'ds-2'],
  pages: [
    {
      pageId: 'p1',
      pageName: 'Home',
      sitePath: '/home',
      siteId: 's1',
      siteName: 'acme-marketing',
    },
    {
      pageId: 'p2',
      pageName: 'About',
      sitePath: '/about',
      siteId: 's1',
      siteName: 'acme-marketing',
    },
    {
      pageId: 'p3',
      pageName: 'Investors',
      sitePath: '/ir',
      siteId: 's2',
      siteName: 'acme-ir',
    },
  ],
};

describe('<UsageDrawer /> — T063', () => {
  it('renders the rendering display name in the header', () => {
    render(
      <UsageDrawer
        open
        rendering={HERO}
        allRenderings={new Map([[HERO.renderingId, HERO]])}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    // The header title contains the display name.
    expect(screen.getByText('Hero Banner')).toBeInTheDocument();
  });

  it('lists one page row per rendering page', () => {
    render(
      <UsageDrawer
        open
        rendering={HERO}
        allRenderings={new Map([[HERO.renderingId, HERO]])}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Investors')).toBeInTheDocument();
  });

  it('clicking a page row calls onNavigate with the pageId', () => {
    const onNavigate = vi.fn();
    render(
      <UsageDrawer
        open
        rendering={HERO}
        allRenderings={new Map([[HERO.renderingId, HERO]])}
        onClose={() => undefined}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByText('About'));
    expect(onNavigate).toHaveBeenCalledWith('p2');
  });

  it('renders the locked direct-bindings affordance somewhere visible', () => {
    render(
      <UsageDrawer
        open
        rendering={HERO}
        allRenderings={new Map([[HERO.renderingId, HERO]])}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(
      screen.getByTestId('direct-bindings-affordance'),
    ).toBeInTheDocument();
  });

  it('footer Close calls onClose', () => {
    const onClose = vi.fn();
    render(
      <UsageDrawer
        open
        rendering={HERO}
        allRenderings={new Map([[HERO.renderingId, HERO]])}
        onClose={onClose}
        onNavigate={() => undefined}
      />,
    );
    fireEvent.click(screen.getByTestId('usage-drawer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns nothing visible when open is false', () => {
    render(
      <UsageDrawer
        open={false}
        rendering={HERO}
        allRenderings={new Map([[HERO.renderingId, HERO]])}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.queryByText('Home')).toBeNull();
  });

  it('skipped pages in the rendering list render as forbidden DrawerRow with no navigation (T082 belt+suspenders)', () => {
    const onNavigate = vi.fn();
    render(
      <UsageDrawer
        open
        rendering={HERO}
        allRenderings={new Map([[HERO.renderingId, HERO]])}
        forbiddenPageIds={new Set(['p2'])}
        onClose={() => undefined}
        onNavigate={onNavigate}
      />,
    );
    // The "About" row is now disabled — clicking does nothing.
    fireEvent.click(screen.getByText('About'));
    expect(onNavigate).not.toHaveBeenCalled();

    // Other rows still navigate.
    fireEvent.click(screen.getByText('Home'));
    expect(onNavigate).toHaveBeenCalledWith('p1');
  });
});
