/**
 * Atlas state singleton — module-scoped, NOT on window / React Context /
 * Zustand / Redux / SWR. Surfaces subscribe via useSyncExternalStore.
 *
 * The snapshot is referentially stable and FROZEN; setAtlasState is a no-op on
 * an identical reference. markScanStarting() is the strict-mode double-mount
 * guard — call it BEFORE runScan and no-op on false.
 * See docs/build-decisions.md#atlas-store.
 */

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
