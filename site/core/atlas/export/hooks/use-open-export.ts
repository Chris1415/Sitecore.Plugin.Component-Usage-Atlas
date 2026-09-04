'use client';

/**
 * Open hook — the PRIMARY user-visible action, because the Marketplace sandbox
 * grants allow-popups even though it lacks allow-downloads.
 *
 * ⚠ A null return from window.open is an imperfect blocked-signal: with
 * noopener,noreferrer browsers may return null even when the tab DID open. So
 * 'blocked' is advisory and transient rather than disabling Open on a false
 * negative. See docs/build-decisions.md#three-actions.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const OPEN_BLOCKED_TOAST = 'Popup blocked — use Copy instead.';

export type OpenStatus = 'idle' | 'opening' | 'opened' | 'blocked';

export interface UseOpenExportParams {
  blob: Blob;
}

export interface UseOpenExportResult {
  status: OpenStatus;
  open: () => void;
}

export function useOpenExport(
  params: UseOpenExportParams,
): UseOpenExportResult {
  const { blob } = params;
  const [status, setStatus] = useState<OpenStatus>('idle');

  // In-flight guard tracked via ref so the callback stays stable across
  // status transitions (same rationale as `useSaveExport`).
  const openingRef = useRef<boolean>(false);

  // Mirror status into a ref so the sticky-blocked check sees the current
  // value even when several open() calls land in the same render cycle.
  const statusRef = useRef<OpenStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

  const open = useCallback<UseOpenExportResult['open']>(() => {
    // Re-entry guard for in-flight 'opening' window only — 'blocked' is no
    // longer sticky (see leading comment about the noopener-null false
    // positive).
    if (openingRef.current) return;
    openingRef.current = true;

    setStatus('opening');

    const url = URL.createObjectURL(blob);
    const newWin = window.open(url, '_blank', 'noopener,noreferrer');

    const nextStatus: OpenStatus = newWin ? 'opened' : 'blocked';
    setStatus(nextStatus);
    statusRef.current = nextStatus;

    // Operator feedback 2026-05-16: the inline orange "blocked" copy between
    // toolbar buttons looked ugly. Surface the same advisory as a transient
    // sonner toast instead. The status state stays for the disabled / data-*
    // hooks the button uses.
    if (nextStatus === 'blocked') {
      toast.error(OPEN_BLOCKED_TOAST, { duration: 5000 });
    }

    // Auto-revert in both branches. 'opened' uses pageshot's 1.4 s window;
    // 'blocked' uses 3.5 s — long enough for the editor to read the
    // advisory ("Popup blocked — use Copy instead.") but short enough that
    // a noopener-null false positive doesn't permanently disable Open.
    const revertMs = nextStatus === 'opened' ? 1400 : 3500;
    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    revertTimerRef.current = setTimeout(() => {
      setStatus('idle');
      statusRef.current = 'idle';
      revertTimerRef.current = null;
      openingRef.current = false;
    }, revertMs);

    // Defer revoke so the new tab has time to read the blob.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);
  }, [blob]);

  return { status, open };
}
