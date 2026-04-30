// T030 — Atlas state singleton (architecture § 7.2 / ADR-0010).
// T032 — `__resetForTest()` test helper.
//
// Module-scoped state. NOT on `window`. NOT in React Context. NOT in
// Zustand / Redux / SWR. The atlas is a single source of truth and the
// surfaces subscribe via `useSyncExternalStore` (T031).
//
// Public API:
//
//   getAtlasSnapshot()         → AtlasState
//                                  Referentially-stable; safe for the
//                                  `getSnapshot` arg of useSyncExternalStore.
//   setAtlasState(next)        → void
//                                  No-op when `next === current` (referential
//                                  bail-out). Otherwise updates and notifies
//                                  every subscriber.
//   subscribeAtlas(listener)   → () => void  (unsubscribe)
//   resetAtlas()               → void
//                                  Sets state to `{ kind: 'idle' }` AND
//                                  clears the strict-mode `scanInFlight`
//                                  guard. The action layer (T033) calls
//                                  this only on explicit user-initiated
//                                  reset paths.
//   markScanStarting()         → boolean
//                                  Strict-mode double-mount guard. The
//                                  action layer calls this BEFORE invoking
//                                  `runScan`; if it returns `false`, a scan
//                                  is already in flight and the second
//                                  invocation must no-op.
//   __resetForTest()           → void
//                                  Test-only. Throws outside NODE_ENV='test'.

import type { AtlasState } from '@/lib/sdk/types';

let state: AtlasState = { kind: 'idle' };
let listeners: Set<() => void> = new Set();
let scanInFlight = false;

export function getAtlasSnapshot(): AtlasState {
  return state;
}

export function setAtlasState(next: AtlasState): void {
  if (next === state) return; // referential bail-out (avoids spurious re-renders)
  state = next;
  // Snapshot listener set so a listener that removes itself during
  // dispatch doesn't break the iteration order.
  for (const listener of Array.from(listeners)) {
    listener();
  }
}

export function subscribeAtlas(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetAtlas(): void {
  scanInFlight = false;
  setAtlasState({ kind: 'idle' });
}

export function markScanStarting(): boolean {
  if (scanInFlight) return false;
  scanInFlight = true;
  return true;
}

/**
 * Action layer (T033) calls this when the engine has finished
 * (completed | canceled | error) so a fresh scan can start. Decoupled
 * from `resetAtlas` because the action layer keeps the prior atlas
 * visible during refresh per FR-2.5.
 */
export function clearScanInFlight(): void {
  scanInFlight = false;
}

/**
 * Test-only: hard reset to a pristine module state. Tests that import
 * the atlas-store across multiple `describe` blocks call this in
 * `beforeEach` so each test starts from `{ kind: 'idle' }` with zero
 * listeners and `scanInFlight === false`.
 *
 * Throws outside `NODE_ENV='test'` to prevent production code from
 * reaching for it.
 */
export function __resetForTest(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__resetForTest may only be called in tests');
  }
  state = { kind: 'idle' };
  listeners = new Set();
  scanInFlight = false;
}
