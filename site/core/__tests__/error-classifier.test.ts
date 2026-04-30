// T101 — RED tests for `core/error-classifier.ts` (lifts to GREEN at T018).
//
// Per § 10 T018: 7 scenarios. The SDK's hey-api error envelope (per
// `client.md § 8f`) carries `{ status, error: { ... }, response }`-style
// shapes; the classifier must accept either an Error instance with a
// `status` field, a plain SDK envelope, or arbitrary unknowns.

import { describe, it, expect } from 'vitest';
import { classifyError } from '@/core/error-classifier';

describe('classifyError', () => {
  it('403 → forbidden', () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    expect(classifyError(err)).toBe('forbidden');
  });

  it('404 → not_found', () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    expect(classifyError(err)).toBe('not_found');
  });

  it('AbortError that is NOT a user cancel → timeout', () => {
    // The classifier distinguishes intentional cancels (which never reach
    // it — `runScan` short-circuits on `signal.aborted` before classifying)
    // from per-page timeout aborts (which DO reach it as `AbortError`).
    const err = new DOMException('aborted', 'AbortError');
    expect(classifyError(err)).toBe('timeout');
  });

  it('network error (TypeError: Failed to fetch) → network_error', () => {
    const err = new TypeError('Failed to fetch');
    expect(classifyError(err)).toBe('network_error');
  });

  it('any other Error → other', () => {
    const err = new Error('something weird');
    expect(classifyError(err)).toBe('other');
  });

  it('SDK error envelope shape with status code → classified by status', () => {
    // hey-api's RequestResult shape per
    // node_modules/@hey-api/client-fetch/src/types.ts:61
    // surfaces `{ data: undefined; error: TError; response: Response }`. The
    // SDK wraps that further. Classifier must look for `status` on either
    // the envelope or its `response`.
    const envelope = { error: { detail: [] }, response: { status: 403 } };
    expect(classifyError(envelope)).toBe('forbidden');
  });

  it('null / undefined → other (does not crash)', () => {
    expect(classifyError(null)).toBe('other');
    expect(classifyError(undefined)).toBe('other');
  });
});
