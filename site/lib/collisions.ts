// T045 — Display-name collision suffix utility (FR-9 / ADR-0005).
//
// Given a list of `RenderingUsage` rows (typically the visible widget
// table set), produce a per-renderingId `{ suffix }` map. Renderings
// whose display name appears more than once in the input get a
// `· <last-7-of-id>` suffix; singletons get `null`.
//
// Pure function — same input ⇒ same output. The widget table memoizes
// the result per visible result set (AR-3) so the recompute is bounded.

import type { RenderingId, RenderingUsage } from '@/lib/sdk/types';

export type CollisionEntry = { readonly suffix: string | null };

const lastN = (id: string, n: number): string =>
  id.length <= n ? id : id.slice(id.length - n);

export function computeCollisions(
  renderings: ReadonlyArray<RenderingUsage>,
): Map<RenderingId, CollisionEntry> {
  const out = new Map<RenderingId, CollisionEntry>();
  if (renderings.length === 0) return out;

  // First pass: count display-name occurrences.
  const counts = new Map<string, number>();
  for (const r of renderings) {
    counts.set(r.displayName, (counts.get(r.displayName) ?? 0) + 1);
  }

  // Second pass: build the per-renderingId entry.
  for (const r of renderings) {
    const collides = (counts.get(r.displayName) ?? 0) > 1;
    out.set(r.renderingId, {
      suffix: collides ? `· ${lastN(r.renderingId, 7)}` : null,
    });
  }

  return out;
}
