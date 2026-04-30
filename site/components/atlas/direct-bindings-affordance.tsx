'use client';

// T080-atomic / lifts T112 — `<DirectBindingsAffordance />`.
//
// The "ⓘ Direct bindings only" affordance — ALWAYS rendered on both
// surfaces per ADR-0006 / FR-8.3. Tooltip copy is locked verbatim from
// ADR-0006 § Decision (string equality, NOT "contains" — the test
// pins the exact bytes).

import type * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Locked copy. Mirror with `__tests__/direct-bindings-affordance.test.tsx`.
const DIRECT_BINDINGS_COPY =
  "Counts include datasources bound directly on the page's layout. Inherited (page designs), personalized, A/B variant, and token-resolved bindings are not counted in this version.";

export type DirectBindingsAffordanceProps = {
  readonly className?: string;
};

export function DirectBindingsAffordance({
  className,
}: DirectBindingsAffordanceProps): React.ReactElement {
  return (
    <span
      data-testid="direct-bindings-affordance"
      className={cn(
        'direct-bindings-info inline-flex items-center gap-1.5 text-muted-foreground text-xs',
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="direct-bindings-trigger"
            aria-label={DIRECT_BINDINGS_COPY}
            tabIndex={-1}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span
              data-testid="direct-bindings-glyph"
              aria-hidden="true"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-info-bg text-info-fg text-[0.625rem] font-bold"
            >
              ⓘ
            </span>
            <span>Direct bindings only</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {DIRECT_BINDINGS_COPY}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
