'use client';

/**
 * T034 — `<WhyPopover>` (S9).
 *
 * Wraps the existing Blok `<Popover>` primitive (`@/components/ui/popover`)
 * and renders a per-error-code explanation when an export attempt has
 * surfaced a failure. Anchored to the Why? action button inside a toast or
 * inside a status row on the action cluster.
 *
 * Per ADR-0021 most blockers (Open `'blocked'`, Copy `'denied'`, Save
 * `'unsupported'`) surface inline status copy instead of a toast — the Why?
 * popover's role narrows to cross-cutting failures and the optional
 * sandbox-blocked Save explainer.
 *
 * No tests required for T034 (non-TDD per § 9.6 — covered indirectly by
 * the integration tests T040 / T041).
 */

import {
  mdiHelpCircleOutline,
} from '@mdi/js';

import { Icon } from '@/lib/icon';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export type WhyPopoverErrorCode =
  | 'blob_construction_failed'
  | 'sandbox_blocked_download'
  | 'browser_save_canceled'
  | 'popup_blocked'
  | 'clipboard_blocked'
  | 'unknown';

export type WhyPopoverSurface = 'widget' | 'panel';

export interface WhyPopoverProps {
  errorCode: WhyPopoverErrorCode | null;
  surfaceContext: WhyPopoverSurface;
}

const COPY_FOR: Record<WhyPopoverErrorCode, string> = {
  sandbox_blocked_download:
    'Downloads are blocked in this iframe — see ADR-0017 / ADR-0021. Use Open or Copy instead.',
  popup_blocked:
    "The browser blocked a popup. Use Copy instead, or check the popup-blocker icon in your browser's address bar.",
  clipboard_blocked:
    'Clipboard access was blocked. Use Open instead.',
  blob_construction_failed:
    "The export couldn't be built — likely too large. Try a different format (CSV is smaller than JSON).",
  browser_save_canceled:
    'Save canceled. Click again when ready.',
  unknown:
    'Something went wrong. Try again, or use a different action.',
};

export function WhyPopover(props: WhyPopoverProps) {
  const { errorCode } = props;
  if (!errorCode) return null;

  const body = COPY_FOR[errorCode];

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Why did this fail?"
        className="inline-flex items-center gap-1 text-xs text-subtle-text underline-offset-2 hover:underline cursor-pointer"
        type="button"
      >
        <Icon path={mdiHelpCircleOutline} size={0.6} aria-hidden="true" />
        Why?
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="w-60 text-xs"
        data-error-code={errorCode}
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}
