// T041 / T042 — UI tests for `<WidgetTable />`. Per § 4 T041 + § 10:
// columns Rendering / Used on / Datasources / Last seen / Rarity;
// search filters by display name (case-insensitive substring); click
// row → onSelectRendering(renderingId); empty result renders the
// AtlasEmptyState ('no-results' if query, 'no-shared' if atlas empty).
//
// We hand the table a small renderingIndex Map and exercise the
// filtering + click path. The drawer wiring is the surface's job
// (T040), not the table's — the table just emits onSelectRendering.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetTable } from '@/components/atlas/widget-table';
import type { RenderingUsage } from '@/lib/sdk/types';

const RENDERINGS = new Map<string, RenderingUsage>([
  [
    'rid-hero',
    {
      renderingId: 'rid-hero',
      displayName: 'Hero Banner',
      isUnknown: false,
      totalUsages: 124,
      datasources: ['ds-1', 'ds-2'],
      pages: [
        {
          pageId: 'p1',
          pageName: 'Home',
          sitePath: '/home',
          siteId: 's1',
          siteName: 'acme',
        },
      ],
    },
  ],
  [
    'rid-promo',
    {
      renderingId: 'rid-promo',
      displayName: 'Promo Tile',
      isUnknown: false,
      totalUsages: 87,
      datasources: ['ds-3'],
      pages: [
        {
          pageId: 'p2',
          pageName: 'About',
          sitePath: '/about',
          siteId: 's1',
          siteName: 'acme',
        },
      ],
    },
  ],
  [
    'rid-nav',
    {
      renderingId: 'rid-nav',
      displayName: 'Navigation Primary',
      isUnknown: false,
      totalUsages: 63,
      datasources: [],
      pages: [
        {
          pageId: 'p3',
          pageName: 'Investors',
          sitePath: '/ir',
          siteId: 's2',
          siteName: 'acme-ir',
        },
      ],
    },
  ],
]);

describe('<WidgetTable /> — T041', () => {
  it('renders one row per rendering, default-sorted by total usages desc', () => {
    render(
      <WidgetTable
        renderings={RENDERINGS}
        query=""
        density="compact"
        searchDisabled={false}
        onSelectRendering={() => undefined}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1); // skip header
    // Default sort: Hero (124), Promo (87), Nav (63).
    expect(rows[0]).toHaveTextContent('Hero Banner');
    expect(rows[1]).toHaveTextContent('Promo Tile');
    expect(rows[2]).toHaveTextContent('Navigation Primary');
  });

  it('renders the column headers Rendering / Used on / Datasources / Total / Last seen', () => {
    render(
      <WidgetTable
        renderings={RENDERINGS}
        query=""
        density="compact"
        searchDisabled={false}
        onSelectRendering={() => undefined}
      />,
    );
    expect(screen.getByText('Rendering')).toBeInTheDocument();
    expect(screen.getByText('Used on')).toBeInTheDocument();
    expect(screen.getByText('Datasources')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('filters rows by query (case-insensitive substring on display name)', () => {
    render(
      <WidgetTable
        renderings={RENDERINGS}
        query="HERO"
        density="compact"
        searchDisabled={false}
        onSelectRendering={() => undefined}
      />,
    );
    expect(screen.getByText('Hero Banner')).toBeInTheDocument();
    expect(screen.queryByText('Promo Tile')).toBeNull();
    expect(screen.queryByText('Navigation Primary')).toBeNull();
  });

  it('clicking a row calls onSelectRendering with the renderingId', () => {
    const onSelectRendering = vi.fn();
    render(
      <WidgetTable
        renderings={RENDERINGS}
        query=""
        density="compact"
        searchDisabled={false}
        onSelectRendering={onSelectRendering}
      />,
    );
    fireEvent.click(screen.getByText('Promo Tile'));
    expect(onSelectRendering).toHaveBeenCalledWith('rid-promo');
  });

  it('renders the AtlasEmptyState with the active query when filter has zero matches', () => {
    render(
      <WidgetTable
        renderings={RENDERINGS}
        query="zzz-no-match"
        density="compact"
        searchDisabled={false}
        onSelectRendering={() => undefined}
      />,
    );
    expect(
      screen.getByText('No renderings match `zzz-no-match`. Try a partial name.'),
    ).toBeInTheDocument();
  });

  it('renders empty-tenant empty state when there are zero renderings and no query', () => {
    // M2 fix from code-review-20260428T110500Z: an empty rendering
    // index means the scan found no pages — the correct copy is
    // "No published pages", not "Every component is unique to a page".
    // The "no-shared" mode is reserved for a non-empty atlas where
    // every rendering happens to be a singleton (a future feature).
    render(
      <WidgetTable
        renderings={new Map()}
        query=""
        density="compact"
        searchDisabled={false}
        onSelectRendering={() => undefined}
      />,
    );
    expect(
      screen.getByText('No published pages'),
    ).toBeInTheDocument();
  });

  it('search input is disabled and shows the helper string when searchDisabled=true', () => {
    render(
      <WidgetTable
        renderings={RENDERINGS}
        query=""
        density="compact"
        searchDisabled={true}
        onSelectRendering={() => undefined}
      />,
    );
    const input = screen.getByPlaceholderText(/search will activate/i);
    expect(input).toBeDisabled();
  });

  it('search input fires onQueryChange when user types', () => {
    const onQueryChange = vi.fn();
    render(
      <WidgetTable
        renderings={RENDERINGS}
        query=""
        density="compact"
        searchDisabled={false}
        onQueryChange={onQueryChange}
        onSelectRendering={() => undefined}
      />,
    );
    const input = screen.getByPlaceholderText(/search \d+ renderings/i);
    fireEvent.change(input, { target: { value: 'hero' } });
    expect(onQueryChange).toHaveBeenCalledWith('hero');
  });
});
