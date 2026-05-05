'use client';

/**
 * T052 — `useSaveExport` hook (GREEN).
 *
 * Canonical Save mechanism per ADR-0017 § Primary mechanism + ADR-0021
 * § The three actions. Mirrors pageshot's
 * `products/pageshot/site/next-app/components/use-download-image.ts:99-110`
 * (synthetic `<a download>` + click + deferred revoke), but adapted for an
 * arbitrary text/HTML Blob (atlas exports are JSON / CSV / HTML — not
 * pageshot's base64 PNG).
 *
 * The Save action is canonical and matches PRD-001 IS-15 / FR-3, but the
 * Marketplace iframe sandbox currently lacks `allow-downloads` so the action
 * is rendered DISABLED at the surface level (`sandboxBlocksDownload` prop on
 * the parent) — the hook itself reports `'idle'` in normal browsers and only
 * reports `'unsupported'` when the browser lacks the `download` attribute on
 * the synthetic anchor (a far stricter capability gap than the iframe block).
 * When Sitecore later adds `allow-downloads`, the parent flips
 * `sandboxBlocksDownload` to `false` and Save lights up with no code change.
 *
 * API:
 *   ```
 *   const { status, save } = useSaveExport({ blob, filename });
 *   ```
 *
 * - `status`  — `'idle' | 'saving' | 'saved' | 'unsupported'`.
 * - `save()`  — runs the canonical mechanism. Flips status to `'saving'`,
 *               synthesizes `<a download>` + clicks, then `'saved'`. Auto-
 *               reverts to `'idle'` after 1.4 s (mirrors pageshot's revert
 *               window). Concurrent rapid calls during the saving window are
 *               no-ops via an in-flight ref guard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsupported';

export interface UseSaveExportParams {
  blob: Blob;
  filename: string;
}

export interface UseSaveExportResult {
  status: SaveStatus;
  save: () => void;
}

/**
 * Feature-detection probe per pageshot precedent — checks whether the
 * browser supports the `download` attribute on synthetic anchors. Evaluated
 * once at mount so the parent can render Save in a stable state.
 */
function isDownloadAttributeSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('a');
    return 'download' in probe;
  } catch {
    return false;
  }
}

export function useSaveExport(
  params: UseSaveExportParams,
): UseSaveExportResult {
  const { blob, filename } = params;

  // Resolve capability once at mount — parents that pass a fresh blob over
  // time should not flip availability mid-session.
  const [supported] = useState<boolean>(() => isDownloadAttributeSupported());

  const [status, setStatus] = useState<SaveStatus>(() =>
    supported ? 'idle' : 'unsupported',
  );

  // In-flight guard as a ref so `save` can stay stable — if we keyed off
  // `status` we'd recreate the callback on every transition (pageshot
  // precedent: `downloadingRef` in use-download-image.ts).
  const savingRef = useRef<boolean>(false);

  // Track the revert timer so unmount clears it (no late setState warning).
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

  const save = useCallback<UseSaveExportResult['save']>(() => {
    if (!supported) {
      // No-op — parent renders Save disabled with the unsupported tooltip.
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;

    setStatus('saving');

    const url = URL.createObjectURL(blob);

    // Classic download synthesis. This will silently no-op inside the
    // Marketplace iframe sandbox (no `allow-downloads`); the surface-level
    // `sandboxBlocksDownload` prop disables the affordance to keep the UX
    // honest. Revoke deferred 60 s so even slow disks finish writing.
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 60_000);

    setStatus('saved');

    // Auto-revert the "saved" label after the 1.4 s window. The in-flight
    // ref stays sticky until the revert fires so rapid re-entrant save()
    // calls during the saving / saved window are no-ops (idempotency
    // contract — see § 4c-4 / pageshot ActionPill posture).
    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    revertTimerRef.current = setTimeout(() => {
      setStatus('idle');
      revertTimerRef.current = null;
      savingRef.current = false;
    }, 1400);
  }, [supported, blob, filename]);

  return { status, save };
}
