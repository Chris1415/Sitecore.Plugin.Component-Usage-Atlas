'use client';

/**
 * Copy hook, mode-aware: JSON/CSV via writeText, HTML via a ClipboardItem
 * carrying BOTH text/html and a text/plain peer so the same copy pastes rich
 * into Outlook or Pages and plain into a code editor. A denial is sticky.
 * See docs/build-decisions.md#three-actions.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

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
      // Any rejection — permission denied, SecurityError, quota — flips the
      // status to denied AND fires a transient toast. The denied status is
      // still kept on the button (drives `data-status` + sr-only aria-label)
      // but is no longer rendered as visible inline copy (operator feedback
      // 2026-05-16: inline orange text between toolbar buttons read as ugly).
      setStatus('denied');
      statusRef.current = 'denied';
      if (revertTimerRef.current) {
        clearTimeout(revertTimerRef.current);
        revertTimerRef.current = null;
      }
      toast.error(CLIPBOARD_DENIED_MESSAGE, { duration: 5000 });
    }
  }, [available, text, mode]);

  return {
    available,
    status,
    deniedMessage: CLIPBOARD_DENIED_MESSAGE,
    copy,
  };
}
