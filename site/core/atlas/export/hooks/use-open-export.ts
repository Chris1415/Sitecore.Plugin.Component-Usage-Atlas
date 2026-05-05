'use client';

/**
 * T054 — `useOpenExport` hook (GREEN).
 *
 * Mirrors pageshot precedent at
 * `products/pageshot/site/next-app/components/use-open-image.ts:62` —
 * adapted for an arbitrary atlas-export Blob (JSON / CSV / HTML) instead of
 * pageshot's base64 PNG.
 *
 * Per ADR-0021 § The three actions, Open is the primary user-visible action
 * in the current Marketplace iframe sandbox: `window.open(blobUrl, '_blank',
 * 'noopener,noreferrer')` works because the sandbox grants `allow-popups`
 * even though it lacks `allow-downloads`. The new tab opens in a real
 * top-level browsing context where the browser either renders the payload
 * inline (HTML), shows the JSON / CSV verbatim, or offers a save dialog
 * depending on user agent.
 *
 * API:
 *   ```
 *   const { status, open } = useOpenExport({ blob });
 *   ```
 *
 * - `status` — `'idle' | 'opening' | 'opened' | 'blocked'`.
 * - `open()` — runs `URL.createObjectURL(blob)` then `window.open`. If the
 *              returned window is `null` status flips to `'blocked'` for an
 *              inline "popup blocked" advisory, then auto-reverts to `'idle'`
 *              after 3.5 s so the editor can retry. The null return is an
 *              imperfect signal — when called with `noopener,noreferrer`,
 *              browsers may return `null` even when the popup actually opens
 *              because `noopener` severs the opener relationship (a
 *              well-known browser quirk reported live during PRD-001 smoke
 *              by the user — the new tab opened successfully but the hook's
 *              null check fired a false positive). Treating `'blocked'` as
 *              advisory + transient avoids permanently disabling Open on a
 *              false negative. Otherwise status flips to `'opened'` then
 *              auto-reverts to `'idle'` after 1.4 s. The blob URL is revoked
 *              after 60 s so the new tab has time to read it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

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
