# ADR-0011: Loading visualization in v1 — branded animation; generative bloom and mini-game deferred

## Status

Accepted

## Context

PRD OQ-2 left the v1 loading-visual treatment open. Three options were on the table:

1. **Branded animation** — a polished, low-complexity visual using Blok semantic tokens (e.g., a phased ring/pulse showing sites → pages → components). 60fps story is straightforward.
2. **Generative-art bloom** — a procedural visual that "grows" as pages complete. More distinctive, but adds canvas/SVG complexity and tuning risk for performance on lower-end editor laptops.
3. **Mini-game** — interactive distraction (Snake, Pong, themed flip-cards). Highest engagement potential and explicitly endorsed by the user during discovery — but already moved to OS-12 / Phase 2 during the post-Round-1 PRD revision (gated on S6 underperforming).

The loading visual is a substantive UX investment: it is the visible difference between "the app is working" and "the app is broken." It must work first-run, on the first tenant the editor scans, without tuning. It must compose Blok primitives (ADR-0009).

## Decision

**Ship branded animation in v1. Defer generative-art bloom to Phase 2 if S6 ("felt fast") underperforms or qualitative pulse signals demand more engagement. Mini-game stays deferred per OS-12.**

Concretely:

- The loading visualizer is a single React component `<LoadingVisualizer />` placed at the top of both surfaces during scan.
- It exposes an interface friendly to swap-out:
  ```ts
  type LoadingVisualizerProps = {
    phase: 'sites' | 'pages' | 'components';
    progress: { current: number; total: number };
    elapsedMs: number;
    onCancel: () => void;
  };
  ```
- v1 implementation: a phased ring/pulse using Blok semantic tokens (`--blok-color-primary`, `--blok-surface-canvas`, `--blok-spacing-*`). Phase label, current/total counter, elapsed time, cancel button (Blok's `@blok/button` ghost variant).
- 60fps target on a typical editor laptop; verify in QA per DoD-6.
- Cancel uses the shared `AbortController` from `core/atlas-store.ts` (per ADR-0010).
- `aria-live="polite"` announces phase transitions for screen readers (per NFR-4.2).
- The "Distract me" toggle from PRD AC-4.3 **does not appear in v1** because the only distraction mode is the branded animation itself — there is no "off / branded / mini-game" tri-state.

## Consequences

**Easier:**
- 60fps is straightforward without canvas tuning or generative-art complexity.
- Renders identically in light/dark via Blok tokens — no custom palette branch.
- The `<LoadingVisualizer />` interface is stable; Phase 2 swaps the implementation behind it without touching the scan engine or the surface routes.
- Accessibility (NFR-4.2) is straightforward with semantic HTML + `aria-live`.

**Harder:**
- Lower delight ceiling than the deferred generative-art bloom or mini-game. If S6 underperforms, Phase 2 must produce a more engaging visual — the work is real but the swap point is clean.
- The single-mode design removes the user's promised "Distract me" toggle. Documented as a v1 simplification; revisit if early feedback asks for it.
- Branded animation that uses Blok tokens but does not look like an existing Blok primitive may feel borderline-Blok; the UI Designer (05) must spec it carefully so it reads as "Sitecore-native" and not "stock loading spinner."

**Forbidden in this ADR:**
- Shipping a generative-art bloom or mini-game in v1.
- Using non-Blok colors or custom hex values "to make the loading visual pop." The animation lives inside the Blok token system.
- Adding a "Distract me" tri-state toggle in v1 (it returns when there is more than one mode to toggle between).
- Per-frame work in the JS main thread that interferes with scan responsiveness; if the animation needs work, push it to CSS animations or a low-cost requestAnimationFrame loop.

**Phase-2 escape hatch:** if `S6` ≥30% of editors mark scans as "not fast enough," or qualitative pulse asks for more engagement, the next iteration ships a generative-art bloom or revisits OS-12 (mini-game). Both swap into the same `<LoadingVisualizer />` interface; this ADR is superseded only when the implementation genuinely changes.

## Date

2026-04-27
