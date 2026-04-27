// T019 — Scan tuning constants + `withBackoff` retry helper (ADR-0012).
//
// Constants are NOT user-tunable in v1 — the architect wants telemetry
// signal before opening them up. Caller-side overrides should go through
// a future scan-config patch ADR.
//
// `withBackoff` retries `fn` with exponential backoff + jitter on
// rate-limit errors only. Non-rate-limit errors fail fast on the first
// attempt. Abort during the backoff wait short-circuits with an
// AbortError before the next invocation.

import { track } from '@/core/telemetry';

export const SCAN_CONCURRENCY = 8;
export const PER_PAGE_TIMEOUT_MS = 12_000;
export const RATE_LIMIT_BACKOFF = {
  baseMs: 250,
  maxRetries: 4,
  jitterPercent: 20,
} as const;

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

const computeBackoffMs = (attempt: number): number => {
  // Exponential: base * 2^attempt. Jitter: ± jitterPercent% of the base.
  const base = RATE_LIMIT_BACKOFF.baseMs * Math.pow(2, attempt);
  const jitterRange = base * (RATE_LIMIT_BACKOFF.jitterPercent / 100);
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, base + jitter);
};

export async function withBackoff<T>(
  fn: () => Promise<T>,
  isRateLimit: (err: unknown) => boolean,
  signal: AbortSignal,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFF.maxRetries; attempt += 1) {
    if (signal.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRateLimit(err)) {
        // Non-rate-limit errors fail fast — let the call-site classifier
        // sort them out.
        throw err;
      }
      if (attempt === RATE_LIMIT_BACKOFF.maxRetries) {
        // Out of retries — surface the last error.
        break;
      }
      const delay = computeBackoffMs(attempt);
      track({
        timestamp_ms: Date.now(),
        kind: 'rate_limit_retry',
        surface: 'widget', // re-mapped by the engine when wired
        attempt: attempt + 1,
        delayMs: Math.round(delay),
      });
      await sleep(delay, signal);
    }
  }
  throw lastError;
}
