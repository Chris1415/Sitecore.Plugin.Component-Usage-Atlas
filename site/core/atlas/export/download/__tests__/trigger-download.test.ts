// T026 — RED unit tests for `core/atlas/export/download/trigger-download.ts`
// (lifts to GREEN at T025).
//
// Per task breakdown § T026: 6 cases covering ADR-0017 § Primary mechanism.
// Mocks `URL.createObjectURL`, `URL.revokeObjectURL`, and
// `HTMLAnchorElement.prototype.click` via `vi.spyOn`. The jsdom test
// environment supplies `document` + `Blob`.
//
// SDK fixture provenance: N/A — DOM-only.
//
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerDownload } from '@/core/atlas/export/download/trigger-download';

describe('triggerDownload', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // jsdom doesn't always populate URL.createObjectURL — assign first.
    if (typeof URL.createObjectURL !== 'function') {
      (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () =>
        'blob:mock';
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    }

    createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // (a) happy path: anchor created, appended, clicked, removed; revokeObjectURL
  // called; outcome `started`.
  it('happy path: returns { outcome: "started" } and chains create/click/revoke', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const result = await triggerDownload(blob, 'test.txt');

    expect(result.outcome).toBe('started');
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Microtask cleanup runs after one await.
    await Promise.resolve();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  // (b) URL.createObjectURL throws → outcome `failed`, errorCode `blob_construction_failed`
  it('createObjectURL throws → blob_construction_failed', async () => {
    createObjectURLSpy.mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const blob = new Blob(['hello']);
    const result = await triggerDownload(blob, 'test.txt');
    expect(result).toEqual({
      outcome: 'failed',
      errorCode: 'blob_construction_failed',
    });
    // No click attempt; nothing to revoke.
    expect(clickSpy).not.toHaveBeenCalled();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });

  // (c) a.click() throws → cleanup happens, outcome `failed`,
  // errorCode `sandbox_blocked_download`
  it('click throws synchronously → sandbox_blocked_download with cleanup', async () => {
    clickSpy.mockImplementation(() => {
      throw new Error('iframe sandbox blocked');
    });
    const blob = new Blob(['hello']);
    const result = await triggerDownload(blob, 'test.txt');
    expect(result).toEqual({
      outcome: 'failed',
      errorCode: 'sandbox_blocked_download',
    });
    // Cleanup must happen even on the failure path.
    await Promise.resolve();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  // (d) anchor is appended to document.body (not detached)
  it('anchor is appended to document.body before click', async () => {
    let bodyChildAtClick = false;
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      bodyChildAtClick = document.body.contains(this);
    });
    const blob = new Blob(['hello']);
    await triggerDownload(blob, 'test.txt');
    expect(bodyChildAtClick).toBe(true);
  });

  // (e) a.style.display === 'none'
  it('anchor has style.display = "none"', async () => {
    let displayValue = '';
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      displayValue = this.style.display;
    });
    const blob = new Blob(['hello']);
    await triggerDownload(blob, 'test.txt');
    expect(displayValue).toBe('none');
  });

  // (f) cleanup runs in microtask: synchronously inside the click handler
  // the anchor is still in the DOM and the URL has not yet been revoked
  // (proves cleanup is queueMicrotask-deferred, not synchronous nor
  // setTimeout-deferred — microtasks drain after the current sync frame
  // but before the next macro-task / next `await` continuation).
  it('cleanup runs in microtask (anchor + url still live during click handler)', async () => {
    let anchorPresentDuringClick = false;
    let revokeCalledDuringClick = false;
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      anchorPresentDuringClick = document.body.contains(this);
      revokeCalledDuringClick = revokeObjectURLSpy.mock.calls.length > 0;
    });
    const blob = new Blob(['hello']);
    await triggerDownload(blob, 'test.txt');
    expect(anchorPresentDuringClick).toBe(true);
    expect(revokeCalledDuringClick).toBe(false);
    // After awaiting, cleanup microtask has drained.
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });
});
