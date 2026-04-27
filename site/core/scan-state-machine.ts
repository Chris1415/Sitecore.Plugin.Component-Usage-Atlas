// T025 — Atlas state-machine guard.
//
// Allowed transitions per architecture § 4.1:
//
//   idle      → scanning
//   scanning  → completed | canceled | error
//   completed → scanning   (re-scan)
//   canceled  → scanning   (recover)
//   error     → scanning   (recover)
//   (any)     → idle       ONLY when called with `{ allowReset: true }`,
//                          which is the dedicated `resetAtlas()` path.
//
// Disallowed transitions throw an `Error` whose message names BOTH the
// `prev.kind` and the `next.kind` so test failures and runtime
// exceptions are immediately diagnosable.

import type { AtlasState } from '@/lib/sdk/types';

export type AtlasStateKind = AtlasState['kind'];

const SCANNING: ReadonlySet<AtlasStateKind> = new Set(['completed', 'canceled', 'error']);
const FROM_TERMINAL: ReadonlySet<AtlasStateKind> = new Set(['scanning']);

export const ALLOWED_TRANSITIONS: ReadonlyMap<
  AtlasStateKind,
  ReadonlySet<AtlasStateKind>
> = new Map<AtlasStateKind, ReadonlySet<AtlasStateKind>>([
  ['idle', new Set(['scanning'])],
  ['scanning', SCANNING],
  ['completed', FROM_TERMINAL],
  ['canceled', FROM_TERMINAL],
  ['error', FROM_TERMINAL],
]);

export type TransitionOptions = {
  /** Set true only by `resetAtlas()` — the only path back to `idle`. */
  readonly allowReset?: boolean;
};

export function transitionTo(
  prev: AtlasState,
  next: AtlasState,
  opts: TransitionOptions = {},
): AtlasState {
  if (next.kind === 'idle') {
    if (prev.kind === 'idle' || opts.allowReset === true) {
      return next;
    }
    throw new Error(
      `Disallowed atlas transition: ${prev.kind} → ${next.kind} (only resetAtlas may set idle from non-idle)`,
    );
  }

  const allowed = ALLOWED_TRANSITIONS.get(prev.kind);
  if (!allowed || !allowed.has(next.kind)) {
    throw new Error(`Disallowed atlas transition: ${prev.kind} → ${next.kind}`);
  }
  return next;
}
