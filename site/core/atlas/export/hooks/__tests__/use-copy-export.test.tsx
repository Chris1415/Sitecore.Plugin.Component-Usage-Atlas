// T055 RED — Unit tests for `useCopyExport` hook.
//
// Mirrors pageshot precedent at
// `products/pageshot/site/next-app/components/use-copy-image.ts:128-148`
// (note divergence: pageshot uses `image/png` ClipboardItem; atlas uses
// text — `writeText` for JSON/CSV, `ClipboardItem` with `text/html` +
// `text/plain` peers for HTML).
//
// SDK fixture provenance comment NOT required — clipboard is a browser API,
// not an SDK (per § 9.4 SDK fixture provenance rule).
//
// TDD discipline: this file is authored BEFORE T056. Until the hook lands,
// the import resolves to a missing module — that is the RED state.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// We exercise the hook with a flexible navigator stub so each test can
// install its own `clipboard` mock (or remove it entirely for capability
// detection).
async function flushPromises(): Promise<void> {
  // The hook's copy() awaits the clipboard promise then setStatus. Use a
  // microtask flush + timer flush to land state transitions deterministically
  // under fake timers.
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useCopyExport — text path', () => {
  it("flips 'idle' → 'copying' → 'copied' → 'idle' after 1.8 s and calls writeText", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { useCopyExport } = await import('../use-copy-export');

    const { result } = renderHook(() =>
      useCopyExport({ text: '{"ok":true}', mode: 'text' }),
    );
    expect(result.current.available).toBe(true);
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.copy();
      await flushPromises();
    });

    expect(writeText).toHaveBeenCalledWith('{"ok":true}');
    expect(result.current.status).toBe('copied');

    await act(async () => {
      vi.advanceTimersByTime(1800);
    });
    expect(result.current.status).toBe('idle');
  });
});

describe('useCopyExport — html path', () => {
  it("uses navigator.clipboard.write with one ClipboardItem carrying text/html + text/plain peers", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const clipboardItemCalls: Array<Record<string, Blob>> = [];
    class FakeClipboardItem {
      constructor(items: Record<string, Blob>) {
        clipboardItemCalls.push(items);
      }
    }
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    vi.stubGlobal('navigator', { clipboard: { write } });

    const { useCopyExport } = await import('../use-copy-export');

    const html = '<html><body>x</body></html>';
    const { result } = renderHook(() =>
      useCopyExport({ text: html, mode: 'html' }),
    );
    expect(result.current.available).toBe(true);

    await act(async () => {
      await result.current.copy();
      await flushPromises();
    });

    expect(write).toHaveBeenCalledTimes(1);
    expect(clipboardItemCalls).toHaveLength(1);
    const peers = clipboardItemCalls[0]!;
    expect(Object.keys(peers).sort()).toEqual(['text/html', 'text/plain']);
    expect(peers['text/html']).toBeInstanceOf(Blob);
    expect(peers['text/plain']).toBeInstanceOf(Blob);
    // Both peer Blobs round-trip the source text.
    await expect(peers['text/html']!.text()).resolves.toBe(html);
    await expect(peers['text/plain']!.text()).resolves.toBe(html);
  });
});

describe('useCopyExport — capability detection', () => {
  it("text mode reports available:false when navigator.clipboard.writeText is undefined", async () => {
    vi.stubGlobal('navigator', { clipboard: {} });

    const { useCopyExport } = await import('../use-copy-export');

    const { result } = renderHook(() =>
      useCopyExport({ text: 'x', mode: 'text' }),
    );
    expect(result.current.available).toBe(false);
  });

  it("html mode reports available:false when ClipboardItem is undefined", async () => {
    // Force-undefine ClipboardItem (jsdom may or may not ship it).
    vi.stubGlobal('ClipboardItem', undefined);
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn() } });

    const { useCopyExport } = await import('../use-copy-export');

    const { result } = renderHook(() =>
      useCopyExport({ text: 'x', mode: 'html' }),
    );
    expect(result.current.available).toBe(false);
  });
});

describe("useCopyExport — sticky 'denied'", () => {
  it("after writeText rejection, status stays 'denied' and a second copy() is a no-op", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { useCopyExport } = await import('../use-copy-export');

    const { result } = renderHook(() =>
      useCopyExport({ text: 'x', mode: 'text' }),
    );

    await act(async () => {
      await result.current.copy();
      await flushPromises();
    });
    expect(result.current.status).toBe('denied');
    expect(writeText).toHaveBeenCalledTimes(1);

    // Sticky: a second copy must NOT call writeText again.
    await act(async () => {
      await result.current.copy();
      await flushPromises();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('denied');

    // Time advancement does not heal denied.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.status).toBe('denied');
  });
});

describe("useCopyExport — 'unsupported' initial status", () => {
  it("reports 'unsupported' at mount when available is false", async () => {
    vi.stubGlobal('navigator', { clipboard: {} });

    const { useCopyExport } = await import('../use-copy-export');

    const { result } = renderHook(() =>
      useCopyExport({ text: 'x', mode: 'text' }),
    );
    expect(result.current.available).toBe(false);
    expect(result.current.status).toBe('unsupported');
  });
});

describe('useCopyExport — idempotency', () => {
  it("concurrent copy() calls during the 'copying' window are no-ops", async () => {
    let resolveWrite: (() => void) | null = null;
    const writeText = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { useCopyExport } = await import('../use-copy-export');

    const { result } = renderHook(() =>
      useCopyExport({ text: 'x', mode: 'text' }),
    );

    await act(async () => {
      // Three rapid concurrent calls — only the first should reach writeText.
      void result.current.copy();
      void result.current.copy();
      void result.current.copy();
      await flushPromises();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('copying');

    // Resolve the in-flight promise; status should land at 'copied'.
    await act(async () => {
      resolveWrite?.();
      await flushPromises();
    });
    expect(result.current.status).toBe('copied');
  });
});
