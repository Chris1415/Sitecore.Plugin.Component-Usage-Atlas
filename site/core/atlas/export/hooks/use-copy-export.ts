'use client';

/**
 * T056 — `useCopyExport` hook (GREEN).
 *
 * Mirrors pageshot precedent at
 * `products/pageshot/site/next-app/components/use-copy-image.ts:128-148` —
 * but text-aware (atlas exports are JSON / CSV / HTML strings; pageshot
 * copies a base64 PNG via an `image/png` ClipboardItem).
 *
 * Per ADR-0021 § The three actions, Copy is the third primary user-visible
 * action. JSON / CSV go through `navigator.clipboard.writeText` (text path);
 * HTML goes through `ClipboardItem` with both `text/html` and `text/plain`
 * peer entries so the editor can paste rich HTML into Outlook / Pages and
 * also drop into a code editor as plain text.
 *
 * API:
 *   ```
 *   const { available, status, deniedMessage, copy } = useCopyExport({ text, mode });
 *   ```
 *
 * - `available`     — `false` at mount when the browser lacks the relevant
 *                     APIs (text mode requires `navigator.clipboard?.writeText`;
 *                     html mode requires `ClipboardItem` + `navigator.clipboard?.write`).
 * - `status`        — `'idle' | 'copying' | 'copied' | 'denied' | 'unsupported'`.
 * - `deniedMessage` — stable string literal: "Clipboard access was blocked.
 *                     Use Open instead." (Diverges from pageshot, which
 *                     points at Download — the atlas pattern uses Open as
 *                     the primary user-visible action per ADR-0021.)
 * - `copy()`        — text mode: `await navigator.clipboard.writeText(text)`.
 *                     html mode: constructs a ClipboardItem with text/html
 *                     + text/plain peer Blobs and calls
 *                     `await navigator.clipboard.write([item])`. On success
 *                     flips status to `'copied'` for 1.8 s then back to
 *                     `'idle'`. On rejection flips to sticky `'denied'`
 *                     (no auto-revert; subsequent calls are no-ops).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyMode = 'text' | 'html';

export type CopyStatus =
  | 'idle'
  | 'copying'
  | 'copied'
  | 'denied'
  | 'unsupported';

export interface UseCopyExportParams {
  text: string;
  mode: CopyMode;
}

export interface UseCopyExportResult {
  available: boolean;
  status: CopyStatus;
  deniedMessage: string;
  copy: () => Promise<void>;
}

export const CLIPBOARD_DENIED_MESSAGE =
  'Clipboard access was blocked. Use Open instead.';

/**
 * Capability detection per mode. Evaluated lazily inside the hook so tests
 * can install the global stubs before the first render.
 */
function clipboardAvailable(mode: CopyMode): boolean {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  if (mode === 'text') {
    return typeof navigator.clipboard.writeText === 'function';
  }
  // html mode requires both ClipboardItem constructor and clipboard.write.
  const hasCtor =
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { ClipboardItem?: unknown }).ClipboardItem !==
      'undefined';
  const hasWrite = typeof navigator.clipboard.write === 'function';
  return hasCtor && hasWrite;
}

export function useCopyExport(
  params: UseCopyExportParams,
): UseCopyExportResult {
  const { text, mode } = params;

  // Resolve capability once at mount. Parents that pass fresh text should
  // not flip availability mid-session.
  const [available] = useState<boolean>(() => clipboardAvailable(mode));

  const [status, setStatus] = useState<CopyStatus>(() =>
    available ? 'idle' : 'unsupported',
  );

  // Mirror status into a ref so the sticky-denied / in-flight checks see
  // the current value even when several copy() calls land in the same tick.
  const statusRef = useRef<CopyStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

  const copy = useCallback<UseCopyExportResult['copy']>(async () => {
    if (!available) {
      // No-op — parent already shows the inline unsupported message.
      return;
    }
    // Sticky denied: once blocked, stay blocked for the session.
    if (statusRef.current === 'denied') return;
    if (statusRef.current === 'copying') return;

    setStatus('copying');
    statusRef.current = 'copying';

    try {
      if (mode === 'text') {
        await navigator.clipboard.writeText(text);
      } else {
        const htmlBlob = new Blob([text], { type: 'text/html' });
        const plainBlob = new Blob([text], { type: 'text/plain' });
        const CtorItem = (
          globalThis as { ClipboardItem: typeof ClipboardItem }
        ).ClipboardItem;
        const item = new CtorItem({
          'text/html': htmlBlob,
          'text/plain': plainBlob,
        });
        await navigator.clipboard.write([item]);
      }
      setStatus('copied');
      statusRef.current = 'copied';

      // Auto-revert the "copied" label after the 1.8 s window.
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      revertTimerRef.current = setTimeout(() => {
        setStatus('idle');
        statusRef.current = 'idle';
        revertTimerRef.current = null;
      }, 1800);
    } catch {
      // Any rejection — permission denied, SecurityError, quota — transitions
      // to the sticky denied state. Single fallback message per § 4c-4.
      setStatus('denied');
      statusRef.current = 'denied';
      if (revertTimerRef.current) {
        clearTimeout(revertTimerRef.current);
        revertTimerRef.current = null;
      }
    }
  }, [available, text, mode]);

  return {
    available,
    status,
    deniedMessage: CLIPBOARD_DENIED_MESSAGE,
    copy,
  };
}
