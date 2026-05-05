// T053 RED — Unit tests for `useOpenExport` hook.
//
// Mirrors pageshot precedent at
// `products/pageshot/site/next-app/components/use-open-image.ts:62` and
// the renderHook-style tests at
// `products/pageshot/site/next-app/components/use-elapsed.test.ts`.
//
// TDD discipline: this file is authored BEFORE T054. Until the implementation
// lands, the import resolves to a missing module — that is the RED state.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useOpenExport } from '../use-open-export';

function makeBlob(): Blob {
  return new Blob(['{"ok":true}'], { type: 'application/json' });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useOpenExport — initial state', () => {
  it("status starts 'idle'", () => {
    const { result } = renderHook(() => useOpenExport({ blob: makeBlob() }));
    expect(result.current.status).toBe('idle');
  });
});

describe('useOpenExport — happy path', () => {
  it("flips 'idle' → 'opening' → 'opened' and reverts to 'idle' after 1.4 s", () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-open-1');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue({} as Window);

    const { result } = renderHook(() => useOpenExport({ blob: makeBlob() }));
    expect(result.current.status).toBe('idle');

    act(() => {
      result.current.open();
    });
    expect(result.current.status).toBe('opened');
    expect(openSpy).toHaveBeenCalledWith(
      'blob:mock-open-1',
      '_blank',
      'noopener,noreferrer',
    );

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(result.current.status).toBe('idle');
  });
});

describe('useOpenExport — popup blocked (transient advisory)', () => {
  it("status flips to 'blocked' when window.open returns null, then auto-reverts to 'idle' after 3.5 s; subsequent open() calls fire", () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-open-2');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    const { result } = renderHook(() => useOpenExport({ blob: makeBlob() }));

    act(() => {
      result.current.open();
    });
    expect(result.current.status).toBe('blocked');
    expect(openSpy).toHaveBeenCalledTimes(1);

    // 'blocked' is no longer sticky — `noopener,noreferrer` causes browsers
    // to return null even when the popup opens (false positive). Treat as
    // transient advisory: auto-revert after 3.5 s so the editor can retry.
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(result.current.status).toBe('idle');

    // After revert a second click reaches window.open again.
    act(() => {
      result.current.open();
    });
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('blocked');
  });

  it("partial timer advance (< 3.5 s) keeps 'blocked' visible", () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-open-2b');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(window, 'open').mockReturnValue(null);

    const { result } = renderHook(() => useOpenExport({ blob: makeBlob() }));

    act(() => {
      result.current.open();
    });
    expect(result.current.status).toBe('blocked');

    act(() => {
      vi.advanceTimersByTime(3499);
    });
    expect(result.current.status).toBe('blocked');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.status).toBe('idle');
  });
});

describe('useOpenExport — deferred revoke', () => {
  it("URL.revokeObjectURL is deferred 60 s so the new tab can read the blob", () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-open-3');
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    vi.spyOn(window, 'open').mockReturnValue({} as Window);

    const { result } = renderHook(() => useOpenExport({ blob: makeBlob() }));

    act(() => {
      result.current.open();
    });
    expect(revokeSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(59_999);
    });
    expect(revokeSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-open-3');
  });
});

describe('useOpenExport — idempotency', () => {
  it("concurrent open() calls during the 'opening' window are no-ops", () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-open-4');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue({} as Window);

    const { result } = renderHook(() => useOpenExport({ blob: makeBlob() }));

    act(() => {
      result.current.open();
      result.current.open();
      result.current.open();
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('opened');
  });
});
