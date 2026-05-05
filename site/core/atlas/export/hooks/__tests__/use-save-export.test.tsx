// T051 RED — Unit tests for `useSaveExport` hook.
//
// Mirrors pageshot's hook tests at
// `products/pageshot/site/next-app/components/use-elapsed.test.ts` (renderHook
// via @testing-library/react) but for the canonical Save mechanism per
// ADR-0017 § Primary mechanism + ADR-0021 § The three actions.
//
// Reference implementation cited by T052: `products/pageshot/site/next-app/components/use-download-image.ts:99-110`.
//
// TDD discipline: this file is authored BEFORE T052. Until the implementation
// lands, the import below resolves to a missing module — that is the RED
// state. Once T052 ships the test must pass without further edits.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useSaveExport } from '../use-save-export';

const TEXT = '{"ok":true}';
const FILENAME = 'atlas-fixture.json';

function makeBlob(): Blob {
  return new Blob([TEXT], { type: 'application/json' });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useSaveExport — initial state', () => {
  it("status starts 'idle' when the document supports the download attribute", () => {
    const { result } = renderHook(() =>
      useSaveExport({ blob: makeBlob(), filename: FILENAME }),
    );
    expect(result.current.status).toBe('idle');
  });
});

describe('useSaveExport — happy path (synthetic anchor click)', () => {
  it("flips 'idle' → 'saving' → 'saved' → 'idle' after the 1.4 s revert window", () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url-1');
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useSaveExport({ blob: makeBlob(), filename: FILENAME }),
    );
    expect(result.current.status).toBe('idle');

    act(() => {
      result.current.save();
    });

    // After the synchronous click resolves the hook flips to 'saved'.
    expect(result.current.status).toBe('saved');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);

    // Revert window: 1.4 s → back to 'idle'.
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(result.current.status).toBe('idle');

    // The 60 s deferred revoke fires after the rest of the budget has
    // elapsed (1.4 s already advanced; 58.6 s more lands at the 60 s mark).
    act(() => {
      vi.advanceTimersByTime(60_000 - 1400);
    });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-1');
  });
});

describe("useSaveExport — feature-detection probe", () => {
  it("reports 'unsupported' when document.createElement('a') has no `download` property and save() is a no-op", () => {
    // Stub createElement('a') so the synthesized anchor lacks the
    // `download` attribute support — older browsers / locked-down sandboxes.
    // Other element creations must still pass through to the real
    // implementation (jsdom's body etc.).
    const realCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
        if (tagName === 'a') {
          // Construct a plain object lacking a `download` slot. Use Object
          // so `'download' in element` returns false — the canonical probe.
          const fake = Object.create(null) as Record<string, unknown> & {
            click: () => void;
          };
          fake.click = () => undefined;
          return fake as unknown as HTMLElement;
        }
        return realCreateElement(tagName, options);
      }) as typeof document.createElement);

    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useSaveExport({ blob: makeBlob(), filename: FILENAME }),
    );
    expect(result.current.status).toBe('unsupported');

    act(() => {
      result.current.save();
    });
    // No state change — still 'unsupported'.
    expect(result.current.status).toBe('unsupported');
    // No anchor click attempted.
    expect(click).not.toHaveBeenCalled();

    createElementSpy.mockRestore();
  });
});

describe('useSaveExport — unmount cleanup', () => {
  it('cancels the revert timer on unmount (no late state update)', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url-2');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );

    const { result, unmount } = renderHook(() =>
      useSaveExport({ blob: makeBlob(), filename: FILENAME }),
    );

    act(() => {
      result.current.save();
    });
    expect(result.current.status).toBe('saved');

    // A revert timer is now scheduled. Unmount before it fires.
    const before = vi.getTimerCount();
    expect(before).toBeGreaterThan(0);
    unmount();
    // After unmount the revert timer must be cleared. Some other
    // timers (the 60 s revoke) may remain; the contract is that the
    // revert callback no longer holds a reference into a torn-down
    // component (no late setState warning).
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    // Implicit: console.error wasn't called with a "perform a state
    // update on an unmounted component" warning. RTL's act() boundaries
    // surface those warnings as test failures.
  });
});

describe('useSaveExport — idempotency', () => {
  it('rapid concurrent save() calls during the saving window yield a single download', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url-3');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useSaveExport({ blob: makeBlob(), filename: FILENAME }),
    );

    act(() => {
      result.current.save();
      result.current.save();
      result.current.save();
    });

    // Only one synthesized anchor click should have happened — the in-
    // flight ref guards against rapid re-entrancy.
    expect(click).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saved');
  });
});
