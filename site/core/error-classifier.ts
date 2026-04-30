// T018 — Pure error classifier used to map per-page scan failures to the
// `Skipped.reason` enum (FR-7.2 / ADR-0012).
//
// Inputs may be: an Error instance with a `status` field; a hey-api
// envelope `{ data: undefined; error; response }` (per
// `node_modules/@hey-api/client-fetch/src/types.ts:61`); a `DOMException`
// with `name === 'AbortError'`; a `TypeError: Failed to fetch` from the
// network layer; or arbitrary unknowns. Anything we can't recognise lands
// in `'other'` — never crash.
//
// 429 / rate-limit is NOT a classification target here: the call-site
// retry layer (`withBackoff` in `core/scan-config.ts`, T019) handles those
// and only after `maxRetries` is exhausted does the page reach the
// classifier — at which point ADR-0012 mandates it be classified as
// `'network_error'`. So 429s arriving here mean "we already retried and
// gave up" and we treat them as network failures.

import type { SkipReason } from '@/lib/sdk/types';

type WithStatus = { readonly status?: number };
type WithResponseStatus = { readonly response?: { readonly status?: number } };

const extractStatus = (err: unknown): number | undefined => {
  if (typeof err !== 'object' || err === null) return undefined;
  const direct = (err as WithStatus).status;
  if (typeof direct === 'number') return direct;
  const nested = (err as WithResponseStatus).response?.status;
  if (typeof nested === 'number') return nested;
  return undefined;
};

const isAbortError = (err: unknown): boolean => {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (typeof err === 'object' && err !== null) {
    const nameLike = (err as { readonly name?: string }).name;
    if (nameLike === 'AbortError') return true;
  }
  return false;
};

const isNetworkError = (err: unknown): boolean => {
  if (err instanceof TypeError) {
    // Fetch errors surface as `TypeError: Failed to fetch` in browsers.
    return /failed to fetch|networkerror|load failed/i.test(err.message);
  }
  return false;
};

export function classifyError(err: unknown): SkipReason {
  if (err === null || err === undefined) return 'other';

  // Status-coded errors (Error + status, or hey-api envelope).
  const status = extractStatus(err);
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 408) return 'timeout';
  if (status === 429) return 'network_error'; // post-retry exhaustion (ADR-0012)
  if (typeof status === 'number' && status >= 500 && status < 600) return 'network_error';

  if (isAbortError(err)) {
    // AbortError reaching the classifier means a per-page timeout aborted
    // the request (intentional user cancels short-circuit before
    // classification). Architecture § 4.4 / FR-7.2 calls these `'timeout'`.
    return 'timeout';
  }

  if (isNetworkError(err)) return 'network_error';

  return 'other';
}
