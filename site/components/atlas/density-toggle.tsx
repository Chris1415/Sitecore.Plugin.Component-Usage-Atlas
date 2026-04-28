'use client';

// T048 — `<DensityToggle />`. Wraps Blok @blok/toggle-group with two
// options: Compact / Comfortable. Default Compact (controlled by
// caller). The Radix-backed ToggleGroup is single-select; we use it as
// a radio group and reflect selection via `data-state="on"|"off"` on
// each item (assertable in tests). POC class anchor `.toggle-group`
// preserved for visual diff against pocs/poc-v2/index.html.

import type * as React from 'react';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type Density = 'compact' | 'comfortable';

export type DensityToggleProps = {
  readonly value: Density;
  readonly onChange: (next: Density) => void;
  readonly className?: string;
};

export function DensityToggle({
  value,
  onChange,
  className,
}: DensityToggleProps): React.ReactElement {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next: string) => {
        // Radix may emit '' when the user clicks the active item; ignore
        // to enforce single-select semantics (always one density active).
        if (next === 'compact' || next === 'comfortable') {
          onChange(next);
        }
      }}
      aria-label="Table density"
      size="sm"
      className={cn('toggle-group', className)}
    >
      <ToggleGroupItem
        value="compact"
        role="radio"
        aria-checked={value === 'compact'}
        aria-label="Compact"
      >
        Compact
      </ToggleGroupItem>
      <ToggleGroupItem
        value="comfortable"
        role="radio"
        aria-checked={value === 'comfortable'}
        aria-label="Comfortable"
      >
        Comfortable
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
