// T031 — Atlas slice subscription hook (architecture § 7.2 / ADR-0010).
//
// Thin wrapper around React's `useSyncExternalStore` that lets a
// component subscribe to a slice of the atlas state. Selective
// re-render is achieved automatically: `useSyncExternalStore` bails
// out of re-render when `getSnapshot` returns a value `Object.is`-equal
// to the previous snapshot.
//
// Critical caveat (§ 4 T031): the inner `getSnapshot` returns
// `selector(state)`, NOT the raw state. If the selector returns a
// fresh object/array literal on every call, React enters an infinite
// loop ("Maximum update depth exceeded"). Callers MUST either:
//
//   a) Return a primitive (string, number, boolean) — by far the
//      easiest and our default pattern in surfaces. Most use sites
//      look like `useAtlasSlice(s => s.kind)` or
//      `useAtlasSlice(s => s.atlas?.totals.renderings)`.
//
//   b) Return a stable projection — e.g. `useAtlasSlice(s => s.atlas)`,
//      relying on the atlas being frozen and only replaced on real
//      transitions.
//
// We do NOT add a second-arg comparator (like Zustand) — the React
// API doesn't expose one, and ADR-0010 forbids state-management
// libraries. If a selector legitimately needs structural memoization,
// the call site memoizes the projection itself (e.g. with `useMemo`
// over already-stable inputs).
//
// `getServerSnapshot` is the same as `getSnapshot`. We never SSR — the
// surfaces are `'use client'` — but React's API requires the third
// argument to be a function, not undefined.

import { useSyncExternalStore } from 'react';

import { getAtlasSnapshot, subscribeAtlas } from '@/core/atlas-store';
import type { AtlasState } from '@/lib/sdk/types';

export function useAtlasSlice<T>(selector: (state: AtlasState) => T): T {
  return useSyncExternalStore(
    subscribeAtlas,
    () => selector(getAtlasSnapshot()),
    () => selector(getAtlasSnapshot()),
  );
}
