// T027 — `detectFailure` is the 5 s heuristic per ADR-0017 § Detection
// contract.
//
// The function is a thin classifier over the trigger outcome:
//   - If the trigger already failed (`outcome: 'failed'`), short-circuit
//     to `{ result: 'fail', errorCode }` synchronously. No timer.
//   - Otherwise the click was issued without a synchronous throw — but
//     in a sandboxed iframe the browser may silently drop the download.
//     Wait 5 s; if no observable failure surfaces in that window,
//     return `{ result: 'success' }`.
//
// ADR-0017 § Detection contract acknowledges the heuristic is imperfect
// by design — false positives + false negatives are acceptable for v1.
// `export.attempt` always fires (telemetry is the caller's job — this
// module is a pure classifier) so operators can compute attempt-vs-
// success ratios.
//
// Implementation note: uses `setTimeout` (testable with Vitest fake
// timers — `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(5000)`).
// No external observation hook is wired in v1 (per ADR-0017 § Detection
// contract — the iframe sandbox swallows console/error events that would
// be needed to actually detect a silent drop). The 5 s wait is the
// load-bearing guard.

const DETECT_FAILURE_TIMEOUT_MS = 5000;

export interface TriggerOutcomeInput {
  readonly outcome: 'started' | 'failed';
  readonly errorCode?: string;
}

export interface DetectFailureResult {
  readonly result: 'success' | 'fail';
  readonly errorCode?: string;
}

export async function detectFailure(
  triggerOutcome: TriggerOutcomeInput,
): Promise<DetectFailureResult> {
  if (triggerOutcome.outcome === 'failed') {
    return { result: 'fail', errorCode: triggerOutcome.errorCode };
  }

  return new Promise<DetectFailureResult>((resolve) => {
    setTimeout(() => {
      resolve({ result: 'success' });
    }, DETECT_FAILURE_TIMEOUT_MS);
  });
}
