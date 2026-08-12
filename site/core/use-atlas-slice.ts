/**
 * ⚠ Selectors MUST return a primitive, or a projection that is stable by
 * reference. useSyncExternalStore bails out on Object.is equality, so a
 * selector returning a fresh object or array literal loops forever
 * ("Maximum update depth exceeded"). No comparator arg exists to save you.
 * See docs/build-decisions.md#selector-primitive.
 */

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
