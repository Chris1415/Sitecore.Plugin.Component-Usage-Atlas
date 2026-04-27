// T016 inline unit tests — abort-bus has no separate RED task per § 5
// numbered list (Group 6 utility); we own its tests inline.

import { describe, it, expect, vi } from 'vitest';
import { createAbortBus } from '@/core/abort-bus';

describe('createAbortBus', () => {
  it('signal is an AbortSignal; aborted() is false before abort()', () => {
    const bus = createAbortBus();
    expect(bus.signal).toBeInstanceOf(AbortSignal);
    expect(bus.aborted()).toBe(false);
    expect(bus.signal.aborted).toBe(false);
  });

  it('abort() flips aborted() to true AND signal.aborted to true', () => {
    const bus = createAbortBus();
    bus.abort();
    expect(bus.aborted()).toBe(true);
    expect(bus.signal.aborted).toBe(true);
  });

  it('calling abort() twice is a no-op (does not double-fire listeners)', () => {
    const bus = createAbortBus();
    const listener = vi.fn();
    bus.signal.addEventListener('abort', listener);

    bus.abort();
    bus.abort();
    bus.abort();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('listeners attached to signal fire exactly once', () => {
    const bus = createAbortBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.signal.addEventListener('abort', a);
    bus.signal.addEventListener('abort', b);

    bus.abort();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
