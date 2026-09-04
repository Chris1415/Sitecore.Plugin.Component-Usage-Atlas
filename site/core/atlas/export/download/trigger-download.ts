/**
 * Canonical Save mechanism. The anchor MUST be appended to the document —
 * detached anchors no-op in some browsers — and the click is caught, because a
 * synchronous throw means the iframe sandbox blocked the download.
 *
 * Ships disabled in the current sandbox but is future-proof: when
 * allow-downloads is granted this works unchanged.
 * See docs/build-decisions.md#three-actions and #trigger-download.
 */

export type TriggerDownloadErrorCode =
  | 'blob_construction_failed'
  | 'sandbox_blocked_download'
  | 'unknown';

export interface TriggerDownloadResult {
  readonly outcome: 'started' | 'failed';
  readonly errorCode?: TriggerDownloadErrorCode;
}

export async function triggerDownload(
  blob: Blob,
  filename: string,
): Promise<TriggerDownloadResult> {
  // Step 1: createObjectURL — wrap to surface blob_construction_failed.
  let url: string;
  try {
    url = URL.createObjectURL(blob);
  } catch {
    return { outcome: 'failed', errorCode: 'blob_construction_failed' };
  }

  // Steps 2-4: synthesize anchor + attach.
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);

  // Step 5: synchronous click. Catch sandbox blockage.
  try {
    a.click();
  } catch {
    // Cleanup before returning so we don't leak the URL or DOM node.
    queueMicrotask(() => {
      a.remove();
      URL.revokeObjectURL(url);
    });
    return { outcome: 'failed', errorCode: 'sandbox_blocked_download' };
  }

  // Step 6: success-path cleanup in microtask (not setTimeout — ADR-0017
  // step 8 — keeps the click handler trace tight + observable).
  queueMicrotask(() => {
    a.remove();
    URL.revokeObjectURL(url);
  });

  return { outcome: 'started' };
}
