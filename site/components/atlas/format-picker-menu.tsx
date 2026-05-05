'use client';

/**
 * T033 — `<FormatPickerMenu>` (sub-component to T032 action cluster).
 *
 * Wraps the existing Blok dropdown primitives at `@/components/ui/dropdown-menu`
 * and renders the three export-format menu items (JSON / CSV / HTML) in fixed
 * order per PRD-001 § 11.2. Tier-driven size annotations follow UI design § 4.2:
 *   - tier 'none'   → no size text
 *   - tier 'muted'  → ` · ~N MB` appended to the description
 *   - tier 'warning' → warning glyph + ` · ~N MB — Large, may take a moment`
 *
 * Per ADR-0021 supersession this component is responsible only for FORMAT
 * selection. Action selection (Save / Open / Copy) is owned by the parent
 * `<DownloadButton>` action cluster (T032).
 */

import { Icon } from '@/lib/icon';
import {
  mdiAlert,
  mdiCheck,
  mdiCodeBraces,
  mdiFileDocumentOutline,
  mdiMenuDown,
  mdiTable,
} from '@mdi/js';
import { useMemo } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemDescription,
  DropdownMenuItemText,
  DropdownMenuItemTitle,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { sizeAnnotationTier } from '@/core/atlas/export/size-estimator';

export type ExportFormat = 'json' | 'csv' | 'html';
export type FormatPickerSurface = 'widget' | 'panel';

export interface FormatPickerMenuProps {
  surface: FormatPickerSurface;
  atlasSizeBytes: number | null;
  onSelect: (format: ExportFormat) => void;
  /**
   * When true, the trigger button renders disabled so the menu cannot be
   * opened. Used by the parent action cluster to gate format selection
   * during a scan-with-no-prior-atlas, panel-loading, or no-data state —
   * mirrors the `cohortDisabled` matrix in `<DownloadButton>`. Optional
   * tooltip copy is wired through so the disabled affordance carries
   * consistent reason copy with the action pills.
   */
  disabled?: boolean;
  /** Tooltip + screen-reader copy when `disabled` is true. */
  disabledReason?: string;
  /**
   * Currently-selected format. When set, the matching menu row renders a
   * trailing check icon + `aria-checked="true"`, and the trigger button
   * label swaps to the uppercase format code (e.g. "JSON") so the chosen
   * format is visible without opening the menu.
   */
  selectedFormat?: ExportFormat | null;
}

interface FormatRow {
  format: ExportFormat;
  title: string;
  ext: string;
  description: string;
  iconPath: string;
}

const ROWS: FormatRow[] = [
  {
    format: 'json',
    title: 'JSON',
    ext: '.json',
    description: 'Full data, machine-readable',
    iconPath: mdiCodeBraces,
  },
  {
    format: 'csv',
    title: 'CSV',
    ext: '.csv',
    description: 'Lite data, spreadsheet-friendly',
    iconPath: mdiTable,
  },
  {
    format: 'html',
    title: 'HTML',
    ext: '.html',
    description: 'Lite data, printable / shareable',
    iconPath: mdiFileDocumentOutline,
  },
];

function formatMb(bytes: number): string {
  return String(Math.round(bytes / 1024 / 1024));
}

export function FormatPickerMenu(props: FormatPickerMenuProps) {
  const {
    surface,
    atlasSizeBytes,
    onSelect,
    disabled = false,
    disabledReason,
    selectedFormat = null,
  } = props;

  const triggerLabel = selectedFormat
    ? selectedFormat.toUpperCase()
    : 'Format';

  const tier = useMemo(
    () => sizeAnnotationTier(atlasSizeBytes ?? 0),
    [atlasSizeBytes],
  );

  const sizeMb =
    atlasSizeBytes !== null && atlasSizeBytes > 0
      ? formatMb(atlasSizeBytes)
      : null;

  const widthClass = surface === 'widget' ? 'w-80' : 'w-72';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          colorScheme="neutral"
          size="sm"
          aria-label={
            selectedFormat
              ? `Export format — ${triggerLabel} selected`
              : 'Export format'
          }
          aria-disabled={disabled || undefined}
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        >
          <Icon path={mdiMenuDown} size={0.8} aria-hidden="true" />
          <span>{triggerLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={widthClass}>
        {ROWS.map((row) => {
          const isSelected = row.format === selectedFormat;
          return (
            <DropdownMenuItem
              key={row.format}
              onSelect={() => onSelect(row.format)}
              aria-checked={isSelected || undefined}
              data-selected={isSelected || undefined}
              className={
                isSelected
                  ? 'bg-accent/40 data-[highlighted]:bg-accent'
                  : undefined
              }
            >
              <Icon path={row.iconPath} size={0.8} aria-hidden="true" />
              <DropdownMenuItemText>
                <DropdownMenuItemTitle>
                  {row.title}
                  <span className="ml-1 font-normal text-subtle-text">
                    {row.ext}
                  </span>
                </DropdownMenuItemTitle>
                <DropdownMenuItemDescription>
                  {row.description}
                  {tier === 'muted' && sizeMb !== null ? (
                    <span data-size-tier="muted"> · ~{sizeMb} MB</span>
                  ) : null}
                  {tier === 'warning' && sizeMb !== null ? (
                    <span
                      data-size-tier="warning"
                      className="inline-flex items-center"
                    >
                      <Icon
                        path={mdiAlert}
                        size={0.55}
                        className="text-warning-fg mr-1"
                        aria-hidden="true"
                      />{' '}
                      · ~{sizeMb} MB — Large, may take a moment
                    </span>
                  ) : null}
                </DropdownMenuItemDescription>
              </DropdownMenuItemText>
              {isSelected ? (
                <Icon
                  path={mdiCheck}
                  size={0.8}
                  className="ml-auto text-foreground"
                  aria-hidden="true"
                />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
