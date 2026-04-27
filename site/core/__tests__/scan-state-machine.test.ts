// T102 — RED tests for `core/scan-state-machine.ts` (lifts to GREEN at T025).
//
// Per § 10 T025: every cell in the architecture § 4.1 transition table
// must be either explicitly allowed or explicitly disallowed. This suite
// asserts the allowed cells succeed, the disallowed ones throw, and the
// only path to `idle` from non-idle is via `allowReset: true`.

import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  transitionTo,
} from '@/core/scan-state-machine';
import type { Atlas, AtlasScope, AtlasState, AtlasTotals, ScanProgress } from '@/lib/sdk/types';

const SCOPE: AtlasScope = { kind: 'all-collections' };
const TOTALS: AtlasTotals = {
  sites: 0,
  pages: 0,
  renderings: 0,
  datasources: 0,
  skipped: 0,
};
const PROGRESS: ScanProgress = { phase: 'sites', current: 0, total: 0, elapsedMs: 0 };
const EMPTY_ATLAS: Atlas = {
  scope: SCOPE,
  scannedAt: 0,
  isPartial: false,
  renderingIndex: new Map(),
  datasourceIndex: new Map(),
  skipped: [],
  totals: TOTALS,
};

const idle = (): AtlasState => ({ kind: 'idle' });
const scanning = (): AtlasState => ({ kind: 'scanning', scope: SCOPE, progress: PROGRESS });
const completed = (): AtlasState => ({ kind: 'completed', atlas: EMPTY_ATLAS });
const canceled = (): AtlasState => ({ kind: 'canceled', atlas: EMPTY_ATLAS });
const errored = (): AtlasState => ({ kind: 'error', reason: { kind: 'no-context' } });

describe('transitionTo', () => {
  it('allows idle → scanning', () => {
    const next = transitionTo(idle(), scanning());
    expect(next.kind).toBe('scanning');
  });

  it('allows scanning → completed', () => {
    expect(transitionTo(scanning(), completed()).kind).toBe('completed');
  });

  it('allows scanning → canceled', () => {
    expect(transitionTo(scanning(), canceled()).kind).toBe('canceled');
  });

  it('allows scanning → error', () => {
    expect(transitionTo(scanning(), errored()).kind).toBe('error');
  });

  it('allows completed → scanning (re-scan)', () => {
    expect(transitionTo(completed(), scanning()).kind).toBe('scanning');
  });

  it('allows canceled → scanning', () => {
    expect(transitionTo(canceled(), scanning()).kind).toBe('scanning');
  });

  it('allows error → scanning (recover)', () => {
    expect(transitionTo(errored(), scanning()).kind).toBe('scanning');
  });

  it('disallows scanning → idle (any non-idle → idle requires allowReset)', () => {
    expect(() => transitionTo(scanning(), idle())).toThrowError(/scanning.*idle/);
  });

  it('disallows completed → idle without allowReset', () => {
    expect(() => transitionTo(completed(), idle())).toThrow();
  });

  it('allows any → idle when allowReset is true (resetAtlas path)', () => {
    expect(transitionTo(scanning(), idle(), { allowReset: true }).kind).toBe('idle');
    expect(transitionTo(completed(), idle(), { allowReset: true }).kind).toBe('idle');
    expect(transitionTo(errored(), idle(), { allowReset: true }).kind).toBe('idle');
  });

  it('idle → completed disallowed (must go through scanning)', () => {
    expect(() => transitionTo(idle(), completed())).toThrow();
  });

  it('throws with both prev and next kinds named in the error message', () => {
    let captured: unknown;
    try {
      transitionTo(idle(), completed());
    } catch (err) {
      captured = err;
    }
    expect(captured).toBeInstanceOf(Error);
    const msg = (captured as Error).message;
    expect(msg).toMatch(/idle/);
    expect(msg).toMatch(/completed/);
  });

  it('ALLOWED_TRANSITIONS table is exhaustive over the AtlasState kinds', () => {
    // Every AtlasState kind must appear as a `prev` key.
    const kinds: ReadonlyArray<AtlasState['kind']> = [
      'idle',
      'scanning',
      'completed',
      'canceled',
      'error',
    ];
    for (const k of kinds) {
      expect(ALLOWED_TRANSITIONS.has(k)).toBe(true);
    }
  });
});
