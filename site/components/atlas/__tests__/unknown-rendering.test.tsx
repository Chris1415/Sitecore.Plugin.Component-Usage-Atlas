// T081 — RED+GREEN UI tests for the "(unknown rendering)" virtual row in
// `<WidgetTable />`. Per AR-9 / ADR-0005, all `isUnknown: true` atlas
// entries collapse into ONE row labeled "(unknown rendering)" in the
// table; the row is interactive and the drawer (via onSelectRendering)
// receives a SYNTHETIC ID — for v1 we route to the first synthetic
// rendering in the group so the drawer's per-page rows still render.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { WidgetTable } from '@/components/atlas/widget-table';
import type { RenderingUsage } from '@/lib/sdk/types';

afterEach(() => cleanup());

function unknown(id: string, pageId: string): [string, RenderingUsage] {
  return [
    id,
    {
      renderingId: id,
      displayName: '(unknown rendering)',
      isUnknown: true,
      totalUsages: 1,
      datasources: [],
      pages: [
        {
          pageId,
          pageName: pageId,
          sitePath: `/${pageId}`,
          siteId: 's1',
          siteName: 'acme',
        },
      ],
    },
  ];
}

function known(id: string, name: string): [string, RenderingUsage] {
  return [
    id,
    {
      renderingId: id,
      displayName: name,
      isUnknown: false,
      totalUsages: 5,
      datasources: ['d1'],
      pages: [
        {
          pageId: 'p1',
          pageName: 'p1',
          sitePath: '/p1',
          siteId: 's1',
          siteName: 'acme',
        },
      ],
    },
  ];
}

import { afterEach } from 'vitest';

describe('<WidgetTable /> unknown-rendering virtual row', () => {
  it('collapses multiple isUnknown entries into ONE virtual row', () => {
    const renderings = new Map<string, RenderingUsage>([
      unknown('unknown:p1:main:0', 'p1'),
      unknown('unknown:p2:main:0', 'p2'),
      unknown('unknown:p3:body:1', 'p3'),
      known('rid-hero', 'Hero Banner'),
    ]);
    const onSelect = vi.fn();
    render(
      <WidgetTable
        renderings={renderings}
        query=""
        density="compact"
        searchDisabled={false}
        onSelectRendering={onSelect}
      />,
    );
    // Expect ONE row with "(unknown rendering)" — not 3.
    const rows = screen.getAllByText('(unknown rendering)');
    expect(rows).toHaveLength(1);
  });

  it('virtual row is interactive — calls onSelectRendering with the first synthetic id', () => {
    const renderings = new Map<string, RenderingUsage>([
      unknown('unknown:p1:main:0', 'p1'),
      unknown('unknown:p2:main:0', 'p2'),
    ]);
    const onSelect = vi.fn();
    render(
      <WidgetTable
        renderings={renderings}
        query=""
        density="compact"
        searchDisabled={false}
        onSelectRendering={onSelect}
      />,
    );
    const row = screen.getByText('(unknown rendering)').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    expect(onSelect).toHaveBeenCalledWith(
      expect.stringMatching(/^unknown:p[12]:main:0$/),
    );
  });

  it('virtual row sums the unknown count across the synthetic group', () => {
    const renderings = new Map<string, RenderingUsage>([
      unknown('unknown:p1:main:0', 'p1'),
      unknown('unknown:p2:main:0', 'p2'),
      unknown('unknown:p3:body:1', 'p3'),
    ]);
    const onSelect = vi.fn();
    render(
      <WidgetTable
        renderings={renderings}
        query=""
        density="compact"
        searchDisabled={false}
        onSelectRendering={onSelect}
      />,
    );
    // The virtual row's "Total" cell should show 3, not 1.
    const row = screen.getByText('(unknown rendering)').closest('tr');
    expect(row?.textContent).toContain('3');
  });

  it('does NOT render a virtual row when no isUnknown entries exist', () => {
    const renderings = new Map<string, RenderingUsage>([
      known('rid-hero', 'Hero Banner'),
      known('rid-card', 'Card Grid'),
    ]);
    render(
      <WidgetTable
        renderings={renderings}
        query=""
        density="compact"
        searchDisabled={false}
        onSelectRendering={vi.fn()}
      />,
    );
    expect(screen.queryByText('(unknown rendering)')).toBeNull();
  });
});
