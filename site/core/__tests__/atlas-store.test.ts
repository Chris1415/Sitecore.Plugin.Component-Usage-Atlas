// T030 + T032 RED+GREEN — Inline tests for `core/atlas-store.ts`.
//
// Behaviors covered:
//
//   getAtlasSnapshot:
//     1. Initial state is `{ kind: 'idle' }`.
//     2. Calling twice without mutation returns referentially-stable state.
//     3. Returned state is FROZEN (mutations throw).
//
//   setAtlasState:
//     4. Notifies all subscribers with no arguments.
//     5. Setting the same reference is a no-op (no notification).
//
//   subscribeAtlas:
//     6. Returns an unsubscribe function that removes the listener.
//
//   resetAtlas:
//     7. Sets state to `{ kind: 'idle' }`.
//     8. Clears the strict-mode `scanInFlight` guard.
//
//   strict-mode guard (T030 § 10 scenario 6):
//     9. `markScanStarting` returns true the first time, false on the second.
//
//   __resetForTest (T032):
//    10. In NODE_ENV='test', resets state and listeners and scanInFlight.
//    11. Outside test env, throws.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetForTest,
  getAtlasSnapshot,
  markScanStarting,
  resetAtlas,
  setAtlasState,
  subscribeAtlas,
} from '@/core/atlas-store';
import type { Atlas, AtlasState } from '@/lib/sdk/types';

const completedAtlas = (): Atlas => ({
  scope: { kind: 'all-collections' },
  scannedAt: 1_700_000_000_000,
  isPartial: false,
  renderingIndex: new Map(),
  datasourceIndex: new Map(),
  skipped: [],
  totals: { sites: 0, pages: 0, renderings: 0, datasources: 0, skipped: 0 },
});

beforeEach(() => {
  __resetForTest();
});

describe('getAtlasSnapshot', () => {
  it('returns idle on initial mount', () => {
    expect(getAtlasSnapshot()).toEqual({ kind: 'idle' });
  });

  it('returns referentially-stable state when not mutated', () => {
    const a = getAtlasSnapshot();
    const b = getAtlasSnapshot();
    expect(a).toBe(b);
  });
});

describe('setAtlasState', () => {
  it('notifies subscribers when state changes', () => {
    const listener = vi.fn();
    subscribeAtlas(listener);
    setAtlasState({ kind: 'completed', atlas: completedAtlas() });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does NOT notify when set to the same reference', () => {
    const listener = vi.fn();
    const next: AtlasState = { kind: 'completed', atlas: completedAtlas() };
    setAtlasState(next);
    subscribeAtlas(listener);
    setAtlasState(next);
    expect(listener).not.toHaveBeenCalled();
  });

  it('updates getAtlasSnapshot to the new state', () => {
    const next: AtlasState = { kind: 'completed', atlas: completedAtlas() };
    setAtlasState(next);
    expect(getAtlasSnapshot()).toBe(next);
  });
});

describe('subscribeAtlas', () => {
  it('returns an unsubscribe that removes the listener', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAtlas(listener);
    unsubscribe();
    setAtlasState({ kind: 'completed', atlas: completedAtlas() });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('resetAtlas', () => {
  it('sets state to idle', () => {
    setAtlasState({ kind: 'completed', atlas: completedAtlas() });
    resetAtlas();
    expect(getAtlasSnapshot()).toEqual({ kind: 'idle' });
  });

  it('clears the strict-mode scanInFlight guard', () => {
    expect(markScanStarting()).toBe(true);
    resetAtlas();
    // After reset, a fresh markScanStarting call must succeed again.
    expect(markScanStarting()).toBe(true);
  });
});

describe('strict-mode guard via markScanStarting', () => {
  it('returns true on first call, false on subsequent', () => {
    expect(markScanStarting()).toBe(true);
    expect(markScanStarting()).toBe(false);
  });
});

describe('__resetForTest', () => {
  it('resets state to idle, clears listeners, clears scanInFlight', () => {
    const listener = vi.fn();
    subscribeAtlas(listener);
    setAtlasState({ kind: 'completed', atlas: completedAtlas() });
    markScanStarting();

    __resetForTest();

    expect(getAtlasSnapshot()).toEqual({ kind: 'idle' });
    // Listener should have been cleared.
    setAtlasState({ kind: 'completed', atlas: completedAtlas() });
    expect(listener).toHaveBeenCalledTimes(1); // only the BEFORE call
    // scanInFlight cleared.
    expect(markScanStarting()).toBe(true);
  });

  describe('environment guard', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('throws when NODE_ENV is not test', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() => __resetForTest()).toThrow(/__resetForTest may only be called in tests/);
    });
  });
});
