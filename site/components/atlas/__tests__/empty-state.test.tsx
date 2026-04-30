// T048 / T065 — UI tests for `<AtlasEmptyState />`.
//
// Wraps Blok @blok/empty-states. Three modes:
//   - 'no-results' → search returned zero matches; surface caller passes
//                    the active query so the body can name it back.
//   - 'no-shared'  → atlas exists but renderingIndex is empty (W4 copy).
//   - 'empty-tenant' → atlas exists but no pages were enumerable.
//
// Copy is locked verbatim per § 4 T065 + PRD § 11.3. Tests pin exact
// strings so future drift is caught.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AtlasEmptyState } from '@/components/atlas/empty-state';

describe('<AtlasEmptyState /> — T065', () => {
  it('mode="no-results" renders the per-query body string', () => {
    render(<AtlasEmptyState mode="no-results" query="hero" />);
    expect(
      screen.getByText('No renderings match `hero`. Try a partial name.'),
    ).toBeInTheDocument();
  });

  it('mode="no-shared" renders the W4 copy verbatim', () => {
    render(<AtlasEmptyState mode="no-shared" />);
    expect(
      screen.getByText('Every component is unique to a page'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This tenant has no shared renderings. Datasources are still indexed below.',
      ),
    ).toBeInTheDocument();
  });

  it('mode="empty-tenant" renders the post-scan zero-result copy', () => {
    render(<AtlasEmptyState mode="empty-tenant" />);
    expect(screen.getByText('No renderings found')).toBeInTheDocument();
    expect(
      screen.getByText(
        "The scan finished but didn't find any renderings on this tenant's pages.",
      ),
    ).toBeInTheDocument();
  });
});
