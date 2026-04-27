// T103 — RED tests for `core/concurrency-pool.ts` (lifts to GREEN at T017).
//
// Per § 10 T017: 5 scenarios. Worker-pool semantics: at most `cap` jobs
// in-flight at a time, output positions match input positions, abort
// stops new jobs (in-flight jobs continue per their own AbortSignal-aware
// logic).

import { describe, it, expect } from 'vitest';
import { runWithConcurrency } from '@/core/concurrency-pool';
import { createAbortBus } from '@/core/abort-bus';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('runWithConcurrency', () => {
  it('cap=8 → at most 8 jobs in-flight at any time', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const job = (i: number) => async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await wait(10);
      inFlight -= 1;
      return i;
    };
    const jobs = Array.from({ length: 24 }, (_, i) => job(i));

    const bus = createAbortBus();
    const results = await runWithConcurrency(jobs, 8, bus.signal);

    expect(maxInFlight).toBeLessThanOrEqual(8);
    expect(results.length).toBe(24);
  });

  it('order preservation — output positions match input positions', async () => {
    const jobs = [
      async () => 'a',
      async () => 'b',
      async () => 'c',
      async () => 'd',
    ];
    const bus = createAbortBus();
    const results = await runWithConcurrency(jobs, 2, bus.signal);

    expect(results.length).toBe(4);
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 'a' });
    expect(results[1]).toMatchObject({ status: 'fulfilled', value: 'b' });
    expect(results[2]).toMatchObject({ status: 'fulfilled', value: 'c' });
    expect(results[3]).toMatchObject({ status: 'fulfilled', value: 'd' });
  });

  it('abort signal stops new jobs from starting', async () => {
    let started = 0;
    const job = () => async () => {
      started += 1;
      await wait(20);
      return 'done';
    };
    const jobs = Array.from({ length: 10 }, () => job());

    const bus = createAbortBus();
    const promise = runWithConcurrency(jobs, 2, bus.signal);

    // Abort almost immediately — only the initial cap=2 should have started.
    setTimeout(() => bus.abort(), 5);

    await promise;

    expect(started).toBeLessThan(10);
    expect(started).toBeGreaterThanOrEqual(2); // at least the initial pool
  });

  it('empty jobs array → resolves to []', async () => {
    const bus = createAbortBus();
    const results = await runWithConcurrency([], 8, bus.signal);
    expect(results).toEqual([]);
  });

  it('cap > jobs.length → all jobs run in parallel without crashing', async () => {
    const jobs = [async () => 1, async () => 2, async () => 3];
    const bus = createAbortBus();
    const results = await runWithConcurrency(jobs, 100, bus.signal);
    expect(results.length).toBe(3);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });
});
