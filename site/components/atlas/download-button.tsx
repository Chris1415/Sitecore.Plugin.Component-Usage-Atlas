'use client';

/**
 * T032 — Action cluster component (Save / Open / Copy pills).
 *
 * Filename `download-button.tsx` is preserved for git-diff continuity per
 * ADR-0021's supersession of the single-Download-button pattern. The export
 * is named `<DownloadButton>` so the existing import surface stays stable;
 * the component itself now renders the three-action cluster.
 *
 * Composition: format picker (T033) followed by three action pills (Save /
 * Open / Copy). Per ADR-0021:
 *   - Save is canonical-but-disabled in the current Marketplace iframe sandbox
 *     (`sandboxBlocksDownload === true` OR `saveStatus === 'unsupported'`).
 *   - Open is the primary user-visible action (`window.open` works because
 *     the sandbox grants `allow-popups`).
 *   - Copy is the third primary action (text mode for JSON/CSV, html mode
 *     with text/plain peer for HTML).
 *
 * Status state is owned by the parent surface (T036/T037) — this component
 * receives statuses via props and renders them. The three hooks (T052/T054/
 * T056) live one level up.
 *
 * Surface variants:
 *   - widget: pill row with `variant="outline" colorScheme="neutral"`,
 *     icon + label at desktop width (≥ 480 px) and icon-only with sr-only
 *     label below the breakpoint.
 *   - panel: always icon-only `variant="ghost" colorScheme="neutral"` size
 *     `icon-sm`; sr-only label carries the verbose copy for screen readers.
 *
 * Pageshot precedent: `products/pageshot/site/next-app/components/ActionPill.tsx`.
 */

import {
  mdiCheck,
  mdiContentCopy,
  mdiContentSave,
  mdiLoading,
  mdiOpenInNew,
} from '@mdi/js';
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FormatPickerMenu } from '@/components/atlas/format-picker-menu';

export type ExportFormat = 'json' | 'csv' | 'html';
export type ExportSurface = 'widget' | 'panel';

export type DownloadButtonState =
  | 'enabled'
  | 'disabled-no-data'
  | 'disabled-panel-loading'
  | 'disabled-scan-in-progress-no-prior'
  | 'constructing';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsupported';
export type OpenStatus = 'idle' | 'opening' | 'opened' | 'blocked';
export type CopyStatus =
  | 'idle'
  | 'copying'
  | 'copied'
  | 'denied'
  | 'unsupported';

export interface DownloadButtonProps {
  surface: ExportSurface;
  state: DownloadButtonState;
  atlasSizeBytes: number | null;
  onSelectFormat: (format: ExportFormat) => void;
  selectedFormat: ExportFormat | null;
  saveStatus: SaveStatus;
  openStatus: OpenStatus;
  copyStatus: CopyStatus;
  copyDeniedMessage: string;
  onSave: () => void;
  onOpen: () => void;
  onCopy: () => void;
  sandboxBlocksDownload: boolean;
}

const SAVE_DISABLED_TOOLTIP =
  'Save will become available as soon as the Sitecore Cloud Portal grants the iframe download permission. Until then, use Open or Copy.';
const OPEN_BLOCKED_INLINE = 'Popup blocked — use Copy instead.';

const STATE_DISABLED_COPY: Partial<Record<DownloadButtonState, string>> = {
  'disabled-no-data': 'No data — start a scan first.',
  'disabled-scan-in-progress-no-prior':
    'Scan in progress — finish the scan to download.',
  'disabled-panel-loading': 'Loading current page…',
};

interface PillIconProps {
  baseIcon: string;
  status: SaveStatus | OpenStatus | CopyStatus;
}

function PillIcon({ baseIcon, status }: PillIconProps) {
  // Status-driven swap per pageshot precedent: spinner during the in-flight
  // window, check during the success window, base icon otherwise.
  if (
    status === 'saving' ||
    status === 'opening' ||
    status === 'copying'
  ) {
    return (
      <Icon
        path={mdiLoading}
        size={0.7}
        className="animate-spin"
        aria-hidden="true"
      />
    );
  }
  if (status === 'saved' || status === 'opened' || status === 'copied') {
    return <Icon path={mdiCheck} size={0.7} aria-hidden="true" />;
  }
  return <Icon path={baseIcon} size={0.7} aria-hidden="true" />;
}

export function DownloadButton(props: DownloadButtonProps) {
  const {
    surface,
    state,
    atlasSizeBytes,
    onSelectFormat,
    selectedFormat,
    saveStatus,
    openStatus,
    copyStatus,
    copyDeniedMessage,
    onSave,
    onOpen,
    onCopy,
    sandboxBlocksDownload,
  } = props;

  const baseId = useId();
  const saveReasonId = `${baseId}-save-reason`;
  const openReasonId = `${baseId}-open-reason`;
  const copyReasonId = `${baseId}-copy-reason`;

  const isWidget = surface === 'widget';
  const sharedSize = isWidget ? 'sm' : 'icon-sm';
  const sharedVariant: 'outline' | 'ghost' = isWidget ? 'outline' : 'ghost';

  // Disabled-state matrix (applies to ALL three pills uniformly EXCEPT
  // 'constructing' which only swaps the in-flight pill's icon — the other
  // two stay interactive).
  const cohortDisabled =
    state === 'disabled-no-data' ||
    state === 'disabled-panel-loading' ||
    state === 'disabled-scan-in-progress-no-prior' ||
    selectedFormat === null;

  const stateDisabledCopy = STATE_DISABLED_COPY[state];

  const saveDisabled =
    cohortDisabled ||
    sandboxBlocksDownload ||
    saveStatus === 'unsupported' ||
    saveStatus === 'saving';
  const openDisabled =
    cohortDisabled || openStatus === 'blocked' || openStatus === 'opening';
  const copyDisabled =
    cohortDisabled ||
    copyStatus === 'unsupported' ||
    copyStatus === 'denied' ||
    copyStatus === 'copying';

  // Reason copy that drives `aria-describedby`. Save's reason is preserved
  // verbatim so screen readers + tooltip both surface the canonical copy.
  // Order of precedence:
  //   1. cohort disabled state (no-data / loading / scan-in-progress)
  //   2. sandbox-blocked / unsupported (Save)
  //   3. status-driven inline message (Open 'blocked', Copy 'denied' /
  //      'unsupported')
  let saveReason: string | null = null;
  if (stateDisabledCopy) saveReason = stateDisabledCopy;
  else if (sandboxBlocksDownload || saveStatus === 'unsupported')
    saveReason = SAVE_DISABLED_TOOLTIP;

  let openReason: string | null = null;
  if (stateDisabledCopy) openReason = stateDisabledCopy;
  else if (openStatus === 'blocked') openReason = OPEN_BLOCKED_INLINE;

  let copyReason: string | null = null;
  if (stateDisabledCopy) copyReason = stateDisabledCopy;
  else if (copyStatus === 'denied' || copyStatus === 'unsupported')
    copyReason = copyDeniedMessage;

  return (
    <TooltipProvider delayDuration={150}>
      <div
        data-cluster-anchor="export"
        className="flex items-center gap-2"
      >
        <FormatPickerMenu
          surface={surface}
          atlasSizeBytes={atlasSizeBytes}
          onSelect={onSelectFormat}
          selectedFormat={selectedFormat}
          disabled={
            state === 'disabled-no-data' ||
            state === 'disabled-panel-loading' ||
            state === 'disabled-scan-in-progress-no-prior'
          }
          disabledReason={stateDisabledCopy}
        />

        {/* Save — wrapped in Tooltip so the disabled-reason copy is visible
            on hover even when the button is disabled (browser native `title`
            on disabled buttons is unreliable across browsers; Radix Tooltip
            portals out so it shows in all cases). The trigger uses an inline
            wrapper span because Radix `<TooltipTrigger asChild>` requires a
            child that forwards refs and accepts pointer events — disabled
            buttons swallow pointer events on the button itself, so the span
            picks up the hover. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={saveDisabled ? 0 : -1}
              className={cn(
                'inline-flex',
                saveDisabled ? 'cursor-not-allowed' : undefined,
              )}
            >
              <Button
                type="button"
                variant={sharedVariant}
                colorScheme="neutral"
                size={sharedSize}
                aria-label="Save snapshot"
                aria-describedby={saveReason ? saveReasonId : undefined}
                data-status={saveStatus}
                disabled={saveDisabled}
                onClick={onSave}
                // Pointer-events disabled when the button itself is disabled
                // so the wrapping span receives the hover for the tooltip.
                className={saveDisabled ? 'pointer-events-none' : undefined}
              >
                <PillIcon baseIcon={mdiContentSave} status={saveStatus} />
                <span className={cn(isWidget ? undefined : 'sr-only')}>
                  Save
                </span>
              </Button>
            </span>
          </TooltipTrigger>
          {saveReason ? (
            <TooltipContent side="bottom" className="max-w-xs text-balance">
              {saveReason}
            </TooltipContent>
          ) : null}
        </Tooltip>
        {saveReason ? (
          <span id={saveReasonId} className="sr-only">
            {saveReason}
          </span>
        ) : null}

      {/* Open */}
      <Button
        type="button"
        variant={sharedVariant}
        colorScheme="neutral"
        size={sharedSize}
        aria-label="Open snapshot in new tab"
        aria-describedby={openReason ? openReasonId : undefined}
        data-status={openStatus}
        disabled={openDisabled}
        onClick={onOpen}
        title={openReason ?? undefined}
      >
        <PillIcon baseIcon={mdiOpenInNew} status={openStatus} />
        <span className={cn(isWidget ? undefined : 'sr-only')}>Open</span>
      </Button>
      {openReason ? (
        <span id={openReasonId} className="sr-only">
          {openReason}
        </span>
      ) : null}
      {/* Visible inline copy was removed in favour of a sonner toast fired
       * from use-open-export.ts on the popup-blocked path (operator feedback
       * 2026-05-16). data-status="blocked" + sr-only aria-label still active. */}

      {/* Copy */}
      <Button
        type="button"
        variant={sharedVariant}
        colorScheme="neutral"
        size={sharedSize}
        aria-label="Copy snapshot to clipboard"
        aria-describedby={copyReason ? copyReasonId : undefined}
        data-status={copyStatus}
        disabled={copyDisabled}
        onClick={onCopy}
        title={copyReason ?? undefined}
      >
        <PillIcon baseIcon={mdiContentCopy} status={copyStatus} />
        <span className={cn(isWidget ? undefined : 'sr-only')}>Copy</span>
      </Button>
      {copyReason ? (
        <span id={copyReasonId} className="sr-only">
          {copyReason}
        </span>
      ) : null}
      {/* Visible inline copy was removed in favour of a sonner toast fired
       * from use-copy-export.ts on the denial path (operator feedback
       * 2026-05-16: inline orange text between toolbar buttons read as ugly).
       * The sr-only `copyReason` span above still announces the message to
       * screen readers, and `data-status="denied"` is still set on the
       * button for styling / test hooks. */}
      </div>
    </TooltipProvider>
  );
}
