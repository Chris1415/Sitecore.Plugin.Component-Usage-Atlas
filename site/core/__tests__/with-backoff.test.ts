// T104 — RED tests for `core/scan-config.ts::withBackoff` (lifts to GREEN
// at T019). Per § 10 T019: 6 scenarios. Uses Vitest fake timers throughout.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PER_PAGE_TIMEOUT_MS,
  RATE_LIMIT_BACKOFF,
  SCAN_CONCURRENCY,
  withBackoff,
} from '@/core/scan-config';
import { createAbortBus } from '@/core/abort-bus';
import { clearBuffer, getBuffer } from '@/core/telemetry';

const isRateLimit = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'status' in err && (err as { status?: number }).status === 429;

const rateLimitError = () => Object.assign(new Error('rate limited'), { status: 429 });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withBackoff', () => {
  it('zero rate-limit errors → fn invoked once, returns the resolved value', async () => {
    const fn = vi.fn(async () => 'ok');
    const bus = createAbortBus();
    const promise = withBackoff(fn, isRateLimit, bus.signal);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('one rate-limit error → fn invoked twice, succeeds on retry', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(rateLimitError())
      .mockResolvedValueOnce('eventually');

    const bus = createAbortBus();
    const promise = withBackoff(fn, isRateLimit, bus.signal);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('eventually');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('maxRetries+1 rate-limit errors → throws the last error', async () => {
    const calls: Error[] = [];
    const fn = vi.fn(async () => {
      const err = rateLimitError();
      err.message = `attempt-${calls.length + 1}`;
      calls.push(err);
      throw err;
    });

    const bus = createAbortBus();
    const promise = withBackoff(fn, isRateLimit, bus.signal).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const result = await promise;

    // Total attempts = 1 initial + maxRetries retries.
    expect(fn).toHaveBeenCalledTimes(RATE_LIMIT_BACKOFF.maxRetries + 1);
    expect((result as Error).message).toBe(`attempt-${RATE_LIMIT_BACKOFF.maxRetries + 1}`);
  });

  it('non-rate-limit error → throws immediately, no retries', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });

    const bus = createAbortBus();
    const promise = withBackoff(fn, isRateLimit, bus.signal).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(1);
    expect((result as Error).message).toBe('boom');
  });

  it('abort signal during backoff cancels the next retry', async () => {
    const fn = vi.fn(async () => {
      throw rateLimitError();
    });

    const bus = createAbortBus();
    const promise = withBackoff(fn, isRateLimit, bus.signal).catch((e: unknown) => e);

    // Advance just past the first retry's base delay; abort during backoff
    // wait (not during the fn invocation itself).
    await vi.advanceTimersByTimeAsync(RATE_LIMIT_BACKOFF.baseMs / 2);
    bus.abort();
    await vi.runAllTimersAsync();

    const result = await promise;
    // The abort surfaces as a DOMException with name 'AbortError'.
    // (jsdom's DOMException does not extend Error in v29; assert by name.)
    expect((result as { name?: string }).name).toBe('AbortError');
    // After abort during backoff, fn should not be invoked the full
    // maxRetries+1 times.
    expect(fn.mock.calls.length).toBeLessThan(RATE_LIMIT_BACKOFF.maxRetries + 1);
  });

  it('constants exported correctly', () => {
    expect(SCAN_CONCURRENCY).toBe(8);
    expect(PER_PAGE_TIMEOUT_MS).toBe(12_000);
    expect(RATE_LIMIT_BACKOFF.maxRetries).toBe(4);
    expect(RATE_LIMIT_BACKOFF.baseMs).toBe(250);
    expect(RATE_LIMIT_BACKOFF.jitterPercent).toBe(20);
  });

  it('rate_limit_retry telemetry tags surface=panel when invoked from panel surface (M_NEW1 fix)', async () => {
    clearBuffer();
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(rateLimitError())
      .mockResolvedValueOnce('ok');

    const bus = createAbortBus();
    const promise = withBackoff(fn, isRateLimit, bus.signal, { surface: 'panel' });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');

    const retries = getBuffer().filter((e) => e.kind === 'rate_limit_retry');
    expect(retries.length).toBe(1);
    expect(retries[0]!.surface).toBe('panel');
  });

  it('rate_limit_retry telemetry defaults to surface=widget when no surface supplied (backwards compat)', async () => {
    clearBuffer();
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(rateLimitError())
      .mockResolvedValueOnce('ok');

    const bus = createAbortBus();
    const promise = withBackoff(fn, isRateLimit, bus.signal);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');

    const retries = getBuffer().filter((e) => e.kind === 'rate_limit_retry');
    expect(retries.length).toBe(1);
    expect(retries[0]!.surface).toBe('widget');
  });
});
