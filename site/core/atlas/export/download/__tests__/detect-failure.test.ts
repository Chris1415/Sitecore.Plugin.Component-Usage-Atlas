// T028 — RED unit tests for `core/atlas/export/download/detect-failure.ts`
// (lifts to GREEN at T027).
//
// Per task breakdown § T028: 4 cases covering ADR-0017 § Detection contract.
// Uses `vi.useFakeTimers()` to advance the 5 s heuristic deterministically.
//
// SDK fixture provenance: N/A — pure-function timer logic.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectFailure } from '@/core/atlas/export/download/detect-failure';

describe('detectFailure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // (a) `triggerOutcome.outcome === 'failed'` short-circuits to fail
  it('failed trigger short-circuits to { result: "fail", errorCode } without timer', async () => {
    const promise = detectFailure({
      outcome: 'failed',
      errorCode: 'sandbox_blocked_download',
    });
    // No timer needed — the failed input must short-circuit synchronously.
    const result = await promise;
    expect(result).toEqual({
      result: 'fail',
      errorCode: 'sandbox_blocked_download',
    });
  });

  // (b) `triggerOutcome.outcome === 'started'` resolves `success` after 5 s advance
  it('started trigger resolves success after 5000 ms tick', async () => {
    const promise = detectFailure({ outcome: 'started' });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result).toEqual({ result: 'success' });
  });

  // (c) advancing timer by 4999 ms keeps the promise pending
  it('promise stays pending until 5000 ms have elapsed', async () => {
    const promise = detectFailure({ outcome: 'started' });
    await vi.advanceTimersByTimeAsync(4999);

    // Race the detect promise against an immediately-resolved sentinel.
    // If detectFailure resolved early, it'll win the race.
    const sentinel = Symbol('still-pending');
    const winner = await Promise.race([
      promise,
      Promise.resolve(sentinel),
    ]);
    expect(winner).toBe(sentinel);

    // Now finish the timeout so the test cleans up.
    await vi.advanceTimersByTimeAsync(1);
    await promise;
  });

  // (d) errorCode propagates through fail path
  it('errorCode propagates through the fail short-circuit', async () => {
    const result = await detectFailure({
      outcome: 'failed',
      errorCode: 'blob_construction_failed',
    });
    expect(result.errorCode).toBe('blob_construction_failed');
  });
});
