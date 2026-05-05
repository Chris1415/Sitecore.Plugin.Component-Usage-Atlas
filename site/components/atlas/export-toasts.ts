/**
 * T035 — Export toast helpers.
 *
 * Thin wrappers around `sonner`'s `toast()` API. Per ADR-0021 the toast
 * surface narrows to **cross-cutting** events:
 *   - On a successful action (first one per format-pick): success toast.
 *   - On a cross-cutting failure (e.g. `blob_construction_failed` before any
 *     action ran): sticky error toast with a Retry callback.
 *
 * Per-action blocks (Open `'blocked'`, Copy `'denied'`, Save `'unsupported'`)
 * surface inline status copy on the action affordance itself — they do NOT
 * round-trip through a toast.
 *
 * No tests required for T035 (non-TDD per § 9.6 — covered indirectly by
 * the integration tests T040 / T041).
 */

import { toast } from 'sonner';

import type { ExportFailErrorCode } from '@/core/telemetry';

export type ExportToastAction = 'save' | 'open' | 'copy';

export interface ExportSuccessToastParams {
  filename: string;
  action: ExportToastAction;
  isEmptyAtlas?: boolean;
}

const ACTION_LABEL: Record<ExportToastAction, string> = {
  save: 'Saved',
  open: 'Opened',
  copy: 'Copied',
};

export function showExportSuccessToast(
  params: ExportSuccessToastParams,
): string | number {
  const { filename, action, isEmptyAtlas } = params;
  const verb = ACTION_LABEL[action];
  const suffix = isEmptyAtlas ? ' — empty atlas.' : '.';
  return toast.success(`${verb} ${filename}${suffix}`, {
    duration: 4000,
  });
}

export interface ExportFailureToastParams {
  errorCode: ExportFailErrorCode;
  action: ExportToastAction;
  onRetry?: () => void;
}

const FAILURE_BODY: Record<ExportFailErrorCode, string> = {
  blob_construction_failed:
    "Couldn't build the export. Try a different format or retry.",
  sandbox_blocked_download:
    'Downloads are blocked in this iframe. Use Open or Copy instead.',
  popup_blocked:
    'The browser blocked a popup. Use Copy instead.',
  clipboard_blocked:
    'Clipboard access was blocked. Use Open instead.',
  browser_save_canceled:
    'Save canceled. Click again when ready.',
  unknown:
    'Something went wrong. Try again, or use a different action.',
};

export function showExportFailureToast(
  params: ExportFailureToastParams,
): string | number {
  const { errorCode, onRetry } = params;
  const body = FAILURE_BODY[errorCode];
  return toast.error(body, {
    // Cross-cutting failures are sticky — the user dismisses or retries.
    duration: Infinity,
    action: onRetry
      ? {
          label: 'Retry',
          onClick: onRetry,
        }
      : undefined,
  });
}
