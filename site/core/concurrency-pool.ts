// T017 — Worker-pool concurrency primitive used by the scan engine.
//
// Semantics (per § 4 T017 + § 10 T017):
//   - At most `cap` jobs in-flight at any time.
//   - Output positions match input positions (results[i] is the settled
//     result of jobs[i], regardless of completion order).
//   - `signal` stops new jobs from starting; in-flight jobs are NOT
//     aborted by this helper — they should respond to the same signal
//     via their own AbortController-aware logic (`fetchComponents`,
//     `enumeratePages` etc.).
//   - Returns `Promise.allSettled`-shaped array; never rejects. Per-page
//     failures land in the `rejected` slots; the error-classifier sorts
//     them out at the next layer up.

export function runWithConcurrency<T>(
  jobs: ReadonlyArray<() => Promise<T>>,
  cap: number,
  signal: AbortSignal,
): Promise<PromiseSettledResult<T>[]> {
  if (jobs.length === 0) return Promise.resolve([]);

  const effectiveCap = Math.max(1, Math.min(cap, jobs.length));
  const results: PromiseSettledResult<T>[] = new Array(jobs.length);
  let nextIndex = 0;

  return new Promise<PromiseSettledResult<T>[]>((resolve) => {
    let inFlight = 0;
    let finished = 0;

    const settleOne = (index: number, result: PromiseSettledResult<T>): void => {
      results[index] = result;
      finished += 1;
      inFlight -= 1;
      if (finished === jobs.length) {
        resolve(results);
        return;
      }
      pump();
    };

    const pump = (): void => {
      while (inFlight < effectiveCap && nextIndex < jobs.length) {
        if (signal.aborted) {
          // Stop scheduling further jobs. Mark every yet-to-start job as
          // rejected with an AbortError so the result array stays the same
          // length and ordering as the input.
          while (nextIndex < jobs.length) {
            const i = nextIndex;
            nextIndex += 1;
            results[i] = {
              status: 'rejected',
              reason: new DOMException('aborted', 'AbortError'),
            };
            finished += 1;
          }
          if (inFlight === 0) {
            resolve(results);
          }
          return;
        }

        const i = nextIndex;
        nextIndex += 1;
        inFlight += 1;
        const job = jobs[i]!;
        Promise.resolve()
          .then(job)
          .then(
            (value) => settleOne(i, { status: 'fulfilled', value }),
            (reason: unknown) => settleOne(i, { status: 'rejected', reason }),
          );
      }
    };

    pump();
  });
}
