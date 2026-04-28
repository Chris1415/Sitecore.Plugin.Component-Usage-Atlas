'use client';

// T051-panel — `<PageContextCard />`.
//
// Zone 2 chip on the panel surface. Renders the page-context summary
// (page name + path, plus a lightweight "Refresh atlas" shortcut). The
// card mirrors the `.panel-scope` block from poc-v2 (badge + path) and
// keeps the "Direct bindings only" affordance one row up.

import type * as React from 'react';
import { mdiRefresh } from '@mdi/js';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';

export type PageContextCardProps = {
  readonly pageName?: string;
  readonly pagePath?: string;
  readonly onRefresh: () => void;
};

export function PageContextCard({
  pageName,
  pagePath,
  onRefresh,
}: PageContextCardProps): React.ReactElement {
  return (
    <div
      data-testid="page-context-card"
      className="panel-scope flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2"
    >
      <div className="panel-scope__left min-w-0 flex items-center gap-2 text-sm">
        <span
          aria-hidden="true"
          className="text-muted-foreground inline-flex h-5 w-5 items-center justify-center rounded bg-info-bg text-info-fg text-[0.625rem]"
        >
          ◧
        </span>
        <span className="panel-scope__name font-medium truncate">
          {pageName ?? 'Active page'}
        </span>
        {pagePath ? (
          <span className="panel-scope__path text-muted-foreground font-mono text-xs truncate">
            {pagePath}
          </span>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        aria-label="Refresh atlas"
      >
        <Icon path={mdiRefresh} size={0.75} />
        <span>Refresh</span>
      </Button>
    </div>
  );
}
