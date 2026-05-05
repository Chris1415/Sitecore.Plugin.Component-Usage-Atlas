// T025 — `triggerDownload` is the canonical Save mechanism per
// ADR-0017 § Primary mechanism.
//
// Pipeline:
//   1. URL.createObjectURL(blob)         — fails at this layer if Blob
//                                          exceeded browser limits;
//                                          returns `blob_construction_failed`.
//   2. document.createElement('a')       — synthetic anchor.
//   3. anchor.href = url; .download = filename; .style.display = 'none'.
//   4. document.body.appendChild(anchor) — mandatory; detached anchors
//                                          no-op in some browsers.
//   5. anchor.click() in try/catch       — synchronous throw means the
//                                          iframe sandbox blocked the
//                                          download; returns
//                                          `sandbox_blocked_download`.
//   6. queueMicrotask cleanup            — anchor.remove(),
//                                          URL.revokeObjectURL(url).
//
// ADR-0021 § "pageshot pattern" fork: this module remains canonical. The
// Save action ships disabled in the current sandbox (per ADR-0017 §
// Primary mechanism + ADR-0021), but the mechanism is future-proof —
// when Sitecore unblocks `allow-downloads` in the iframe sandbox, this
// triggers without code change. `useSaveExport` (T052, next batch) wires
// it in. Caller chains `detectFailure` for the 5 s heuristic per ADR-0017
// § Detection contract.
//
// No reads from singletons / React context (mirrors construction purity
// per ADR-0016 — the only side effects here are the DOM mutations
// above and the URL.createObjectURL/revokeObjectURL pair).

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
