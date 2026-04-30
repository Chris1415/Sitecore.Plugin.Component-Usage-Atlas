// T016 — Shared `AbortController` wrapper for the scan engine.
//
// The scan engine uses one `AbortBus` per scan run so that a single
// `cancel()` call propagates to every in-flight `xmc.*` query (sites,
// pages, components fan-out) at once. The bus is also used by the panel
// surface as a SECOND independent bus for the per-page fetch (per
// architecture § 6.4 / OQ-A5) so the panel can refresh on page-switch
// without aborting the global scan.
//
// `abort()` is idempotent — calling it twice does NOT re-fire the
// `AbortController.abort` event a second time. This matters because the
// scan engine wires multiple cleanup paths to the same bus and we must
// not double-fire listeners.

export type AbortBus = {
  readonly signal: AbortSignal;
  readonly abort: () => void;
  readonly aborted: () => boolean;
};

export function createAbortBus(): AbortBus {
  const controller = new AbortController();
  let disposed = false;

  return {
    signal: controller.signal,
    abort: () => {
      if (disposed) return;
      disposed = true;
      controller.abort();
    },
    aborted: () => controller.signal.aborted,
  };
}
