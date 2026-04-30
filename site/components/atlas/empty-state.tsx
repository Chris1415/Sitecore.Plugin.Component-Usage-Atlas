'use client';

// T065 — `<AtlasEmptyState />`. Wraps Blok @blok/empty-states with the
// Atlas-specific copy locked from PRD § 11.3 / § 4 T065. Three modes:
//
//   - no-results   (search zero matches — needs the `query` prop)
//   - no-shared    (W4 — atlas has no shared renderings)
//   - empty-tenant (no pages enumerable — empty atlas)
//
// Copy strings are LOCKED — changes here are spec changes (must update
// PRD § 11.3 + the W4/W5 test fixtures).

import type * as React from 'react';
import { EmptyStates } from '@/components/ui/empty-states';

export type AtlasEmptyMode = 'no-results' | 'no-shared' | 'empty-tenant';

export type AtlasEmptyStateProps = {
  readonly mode: AtlasEmptyMode;
  readonly query?: string;
  readonly title?: string;
  readonly description?: string;
};

export function AtlasEmptyState({
  mode,
  query,
  title,
  description,
}: AtlasEmptyStateProps): React.ReactElement {
  if (mode === 'no-results') {
    const safeQuery = query ?? '';
    return (
      <EmptyStates
        variant="no-search-results"
        title={title ?? 'No matches'}
        description={
          description ?? `No renderings match \`${safeQuery}\`. Try a partial name.`
        }
        actions={null}
      />
    );
  }

  if (mode === 'no-shared') {
    return (
      <EmptyStates
        variant="nothing-created"
        title={title ?? 'Every component is unique to a page'}
        description={
          description ??
          'This tenant has no shared renderings. Datasources are still indexed below.'
        }
        actions={null}
      />
    );
  }

  // empty-tenant
  return (
    <EmptyStates
      variant="nothing-created"
      title={title ?? 'No renderings found'}
      description={
        description ?? "The scan finished but didn't find any renderings on this tenant's pages."
      }
      actions={null}
    />
  );
}
