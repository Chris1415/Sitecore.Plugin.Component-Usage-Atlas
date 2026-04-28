'use client';

// T054 — `<MissingDatasourceWarning />`.
//
// Inline warning rendered in the panel surface when an active-page
// rendering references a datasource that no longer exists in the
// tenant atlas. NFR-4.3: color is reinforced with text — the chip
// shows the word `missing` next to the warning glyph.

import type * as React from 'react';
import { cn } from '@/lib/utils';

export type MissingDatasourceWarningProps = {
  readonly datasourceId: string;
  readonly className?: string;
};

export function MissingDatasourceWarning({
  datasourceId,
  className,
}: MissingDatasourceWarningProps): React.ReactElement {
  return (
    <span
      data-testid="missing-datasource-warning"
      role="note"
      aria-label={`Datasource ${datasourceId} is missing from this tenant`}
      className={cn(
        'missing-ds inline-flex items-center gap-1 rounded bg-warning-bg/30 px-1.5 py-0.5 text-xs',
        className,
      )}
    >
      <span aria-hidden="true" className="text-warning-fg">
        ⚠
      </span>
      <span className="text-warning-fg font-mono">missing datasource</span>
    </span>
  );
}
