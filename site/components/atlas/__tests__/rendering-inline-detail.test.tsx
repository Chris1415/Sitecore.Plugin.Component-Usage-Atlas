// D2 v1 — UI tests for the inline-expansion detail panel that replaces
// the right-side drawer on the dashboard widget surface.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RenderingInlineDetail } from '@/components/atlas/rendering-inline-detail';
import type { Atlas, RenderingUsage } from '@/lib/sdk/types';

function makeRendering(over: Partial<RenderingUsage> = {}): RenderingUsage {
  return {
    renderingId: 'rid-hero',
    displayName: 'Hero Banner',
    isUnknown: false,
    totalUsages: 4,
    pages: [
      { pageId: 'p1', pageName: 'Home',  sitePath: '/',     siteId: 's1', siteName: 'solo' },
      { pageId: 'p1', pageName: 'Home',  sitePath: '/',     siteId: 's1', siteName: 'solo' },
      { pageId: 'p1', pageName: 'Home',  sitePath: '/',     siteId: 's1', siteName: 'solo' },
      { pageId: 'p2', pageName: 'About', sitePath: '/about', siteId: 's1', siteName: 'solo' },
    ],
    datasources: ['local:/Data/Foo', 'local:/Data/Bar'],
    ...over,
  };
}

describe('<RenderingInlineDetail />', () => {
  it('renders the rendering name and a distinct-page-count summary', () => {
    render(
      <RenderingInlineDetail
        rendering={makeRendering()}
        atlas={null}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByText('Hero Banner')).toBeInTheDocument();
    // 4 placements, 2 distinct pages, 2 datasources.
    expect(
      screen.getByText(/2 pages · 4 placements · 2 datasources/i),
    ).toBeInTheDocument();
  });

  it('dedupes pages by pageId and shows a placement-count badge for repeats', () => {
    render(
      <RenderingInlineDetail
        rendering={makeRendering()}
        atlas={null}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getAllByText('Home')).toHaveLength(1);
    expect(screen.getByText('×3')).toBeInTheDocument();
    expect(screen.getAllByText('About')).toHaveLength(1);
  });

  it('emits onNavigate(pageId) when a page row is clicked', () => {
    const onNavigate = vi.fn();
    render(
      <RenderingInlineDetail
        rendering={makeRendering()}
        atlas={null}
        onClose={() => undefined}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByText('Home'));
    expect(onNavigate).toHaveBeenCalledWith('p1');
  });

  it('closes via the Close button', () => {
    const onClose = vi.fn();
    render(
      <RenderingInlineDetail
        rendering={makeRendering()}
        atlas={null}
        onClose={onClose}
        onNavigate={() => undefined}
      />,
    );
    fireEvent.click(screen.getByTestId('rendering-inline-detail-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables forbidden page rows', () => {
    render(
      <RenderingInlineDetail
        rendering={makeRendering()}
        atlas={null}
        forbiddenPageIds={new Set(['p2'])}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    const rows = screen.getAllByTestId('rendering-inline-detail-page-row');
    const aboutRow = rows.find((r) => r.textContent?.includes('About'));
    expect(aboutRow).toBeDefined();
    expect(aboutRow).toBeDisabled();
  });

  it('lists datasources with a page-count badge when atlas is available', () => {
    const atlas: Atlas = {
      scope: { kind: 'all-collections' },
      scannedAt: 0,
      isPartial: false,
      renderingIndex: new Map(),
      datasourceIndex: new Map([
        [
          'local:/Data/Foo',
          {
            datasourceId: 'local:/Data/Foo',
            displayName: 'Foo',
            isMissing: false,
            pages: [
              { pageId: 'p1', pageName: 'Home', sitePath: '/', siteId: 's1', siteName: 'solo' },
              { pageId: 'p2', pageName: 'About', sitePath: '/about', siteId: 's1', siteName: 'solo' },
            ],
            renderings: ['rid-hero'],
          },
        ],
        [
          'local:/Data/Bar',
          {
            datasourceId: 'local:/Data/Bar',
            displayName: 'Bar',
            isMissing: false,
            pages: [
              { pageId: 'p1', pageName: 'Home', sitePath: '/', siteId: 's1', siteName: 'solo' },
            ],
            renderings: ['rid-hero'],
          },
        ],
      ]),
      skipped: [],
      totals: {
        sites: 1,
        pages: 2,
        renderings: 1,
        datasources: 2,
        skipped: 0,
      },
    };
    render(
      <RenderingInlineDetail
        rendering={makeRendering()}
        atlas={atlas}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByText('Foo')).toBeInTheDocument();
    expect(screen.getByText('Bar')).toBeInTheDocument();
    expect(screen.getByText('2 pages')).toBeInTheDocument();
    expect(screen.getByText('1 page')).toBeInTheDocument();
  });
});
