// T033 — Atlas action surface used by the surfaces (M5/M6).
//
// Wraps the lifecycle of `runScan` so the surfaces don't need to know
// about `ScanHandle`, the strict-mode guard, or the abort-bus. The
// surfaces only call:
//
//   triggerScan(scope, client, contextId)  → start a scan if not already in flight
//   cancelScan()                           → cancel the active scan if any
//   refreshAtlas(client, contextId)        → cancel + restart with the current scope
//                                              (or with `'all-collections'` if none)
//   setScope(scope, client, contextId)     → cancel + restart with a new scope
//
// Per FR-2.5 / AC-3.2: `refreshAtlas` and `setScope` keep the prior
// atlas visible during the new scan — they DO NOT call `resetAtlas`
// between cancel and start. The new `runScan` overwrites state on
// completion, and during the gap the prior `completed` / `canceled`
// state is what the surfaces render.
//
// The action layer holds a single module-scoped `currentHandle` so
// `cancelScan()` can find the active scan without the surface needing
// to ferry the handle around. This is acceptable because there's at
// most one scan in flight at a time (enforced by the strict-mode guard
// inside `runScan`).

import { runScan, type ScanHandle } from '@/core/scan-engine';
import { getAtlasSnapshot } from '@/core/atlas-store';
import type { ClientSDK } from '@sitecore-marketplace-sdk/client';
import type { AtlasScope } from '@/lib/sdk/types';

let currentHandle: ScanHandle | undefined;
let currentScope: AtlasScope = { kind: 'all-collections' };

const startUnderlying = (
  client: ClientSDK,
  contextId: string,
  scope: AtlasScope,
): ScanHandle => {
  currentScope = scope;
  const handle = runScan({ client, contextId, scope });
  currentHandle = handle;
  // Clear the handle slot once done so future `cancelScan()` calls
  // don't try to abort a finished scan. We don't await here — the
  // surfaces drive UI off the atlas-store, not the handle.
  void handle.donePromise.finally(() => {
    if (currentHandle === handle) {
      currentHandle = undefined;
    }
  });
  return handle;
};

/**
 * Start a scan with the given scope. If a scan is already in flight
 * (state === 'scanning'), this no-ops — callers should `cancelScan()`
 * first if they want to swap scope mid-flight.
 */
export function triggerScan(
  scope: AtlasScope,
  client: ClientSDK,
  contextId: string,
): ScanHandle {
  const state = getAtlasSnapshot();
  if (state.kind === 'scanning' && currentHandle) {
    return currentHandle;
  }
  return startUnderlying(client, contextId, scope);
}

/** Cancel the active scan if any. No-op when there is none. */
export function cancelScan(): void {
  currentHandle?.cancel();
}

/**
 * Cancel the current scan (if any) and start a fresh one with the
 * SAME scope — used by the "Refresh atlas" action in the freshness
 * ribbon (T046). The prior atlas remains visible per FR-2.5.
 */
export function refreshAtlas(client: ClientSDK, contextId: string): ScanHandle {
  cancelScan();
  return startUnderlying(client, contextId, currentScope);
}

/**
 * Swap the active scope and restart the scan. Cancel the current scan
 * if any. Prior atlas remains visible until the new scan completes
 * (AC-3.2).
 */
export function setScope(
  scope: AtlasScope,
  client: ClientSDK,
  contextId: string,
): ScanHandle {
  cancelScan();
  return startUnderlying(client, contextId, scope);
}

export const __resetActionsForTest = (): void => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__resetActionsForTest may only be called in tests');
  }
  currentHandle = undefined;
  currentScope = { kind: 'all-collections' };
};
