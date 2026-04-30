// S10 — UI tests for `<DatasourceUsageDrawer />`. Verifies the two-target
// drawer split: pages binding the datasource + renderings binding it.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatasourceUsageDrawer } from '@/components/atlas/datasource-usage-drawer';
import type { DatasourceUsage, RenderingUsage } from '@/lib/sdk/types';

const HERO_DS: DatasourceUsage = {
  datasourceId: 'local:/Data/Hero Main',
  displayName: 'Hero Main',
  isMissing: false,
  pages: [
    {
      pageId: 'p1',
      pageName: 'Home',
      sitePath: '/',
      siteId: 's1',
      siteName: 'acme-marketing',
    },
    {
      pageId: 'p2',
      pageName: 'Investors',
      sitePath: '/ir',
      siteId: 's2',
      siteName: 'acme-ir',
    },
  ],
  renderings: ['rid-hero', 'rid-banner'],
};

const ALL_RENDERINGS: ReadonlyMap<string, RenderingUsage> = new Map([
  [
    'rid-hero',
    {
      renderingId: 'rid-hero',
      displayName: 'Hero Banner',
      isUnknown: false,
      totalUsages: 5,
      pages: [],
      datasources: ['local:/Data/Hero Main'],
    },
  ],
  [
    'rid-banner',
    {
      renderingId: 'rid-banner',
      displayName: 'Image Banner',
      isUnknown: false,
      totalUsages: 2,
      pages: [],
      datasources: ['local:/Data/Hero Main'],
    },
  ],
]);

describe('<DatasourceUsageDrawer />', () => {
  it('renders the datasource display name + page count pill in the header', () => {
    render(
      <DatasourceUsageDrawer
        open
        datasource={HERO_DS}
        allRenderings={ALL_RENDERINGS}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByText('Hero Main')).toBeInTheDocument();
    expect(screen.getByText('2 pages')).toBeInTheDocument();
  });

  it('shows the raw datasource id/path as subtitle', () => {
    render(
      <DatasourceUsageDrawer
        open
        datasource={HERO_DS}
        allRenderings={ALL_RENDERINGS}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByText('local:/Data/Hero Main')).toBeInTheDocument();
  });

  it('lists pages binding the datasource and emits onNavigate(pageId) on row click', () => {
    const onNavigate = vi.fn();
    render(
      <DatasourceUsageDrawer
        open
        datasource={HERO_DS}
        allRenderings={ALL_RENDERINGS}
        onClose={() => undefined}
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByText(/Pages binding this datasource · 2/i))
      .toBeInTheDocument();
    fireEvent.click(screen.getByText('Home'));
    expect(onNavigate).toHaveBeenCalledWith('p1');
  });

  it('lists renderings binding the datasource by display name', () => {
    render(
      <DatasourceUsageDrawer
        open
        datasource={HERO_DS}
        allRenderings={ALL_RENDERINGS}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByText(/Renderings binding this datasource · 2/i))
      .toBeInTheDocument();
    expect(screen.getByText('Hero Banner')).toBeInTheDocument();
    expect(screen.getByText('Image Banner')).toBeInTheDocument();
  });

  it('falls back to "(unknown rendering)" if a rendering id is not in the index', () => {
    const ds: DatasourceUsage = {
      ...HERO_DS,
      renderings: ['rid-hero', 'rid-orphan'],
    };
    render(
      <DatasourceUsageDrawer
        open
        datasource={ds}
        allRenderings={ALL_RENDERINGS}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByText('(unknown rendering)')).toBeInTheDocument();
  });

  it('closes via the footer Close button', () => {
    const onClose = vi.fn();
    render(
      <DatasourceUsageDrawer
        open
        datasource={HERO_DS}
        allRenderings={ALL_RENDERINGS}
        onClose={onClose}
        onNavigate={() => undefined}
      />,
    );
    fireEvent.click(screen.getByTestId('datasource-usage-drawer-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
