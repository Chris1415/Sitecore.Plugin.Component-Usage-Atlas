import '@testing-library/jest-dom/vitest';

// jsdom doesn't ship ResizeObserver, but several Blok primitives wrap
// Radix components (ScrollArea, Sheet) that observe their content size
// at mount. M5 surfaces use these primitives, so polyfill ResizeObserver
// for tests with a no-op stub.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {
      /* no-op */
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      /* no-op */
    }
  }
  (globalThis as unknown as {
    ResizeObserver: typeof ResizeObserverStub;
  }).ResizeObserver = ResizeObserverStub;
}

// Same for matchMedia which the Sheet primitive may consult under
// `prefers-reduced-motion`. Provide a stub that always returns "no
// preference" so tests render the default animations path.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
