// S17 — UI tests for the skeleton that replaces the wrong "No published
// pages · Create widget" empty-state during scan.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WidgetTable } from '@/components/atlas/widget-table';

describe('<WidgetTable /> — S17 scanning skeleton', () => {
  it('renders the skeleton (not the empty-state CTA) while scanning with no results', () => {
    render(
      <WidgetTable
        renderings={new Map()}
        query=""
        density="compact"
        searchDisabled
        isScanning
        onSelectRendering={() => undefined}
      />,
    );
    expect(screen.getAllByTestId('widget-table-skeleton-row').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Create widget/i)).toBeNull();
    expect(screen.queryByText(/No published pages/i)).toBeNull();
  });

  it('renders the empty-state when scanning is done and tenant has zero renderings', () => {
    render(
      <WidgetTable
        renderings={new Map()}
        query=""
        density="compact"
        searchDisabled={false}
        isScanning={false}
        onSelectRendering={() => undefined}
      />,
    );
    expect(screen.queryAllByTestId('widget-table-skeleton-row')).toHaveLength(0);
    expect(screen.getByText('No renderings found')).toBeInTheDocument();
    expect(screen.queryByText(/Create widget/i)).toBeNull();
  });
});
