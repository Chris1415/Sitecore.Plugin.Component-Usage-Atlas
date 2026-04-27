# ADR-0010: Atlas state via module-level singleton + `useSyncExternalStore` pub/sub — no Zustand, no Redux, no Context

## Status

Accepted

## Context

ADR-0003 forbids persistence and mandates that the atlas die with the tab. ADR-0004 ships two iframe entries that share scan logic but render different surfaces. The state layer must:

- Hold the scan engine, scan-state machine (idle / scanning / completed / canceled / error), and the frozen `Atlas` result (per PRD § 10).
- Be reactive — UI subscribes; updates trigger re-renders; concurrent scans are not possible (one at a time).
- Survive React 18 strict-mode double-mount in development (the scan engine must not start twice).
- Live entirely in one iframe's JS heap; never accidentally leak across iframes (because each iframe loads its own JS module heap, this is automatic — but the design must not rely on globals like `window`).
- Add zero runtime dependencies if the same shape can be achieved with a 50-line module.

Options considered:

1. **Zustand** — popular and lightweight, but adds a dep for a state surface that has one global store and ~6 actions. Overkill.
2. **Redux Toolkit** — heavy weight; reducers / actions are over-engineering for this surface.
3. **React Context + reducer** — Context re-renders the whole tree on any change; with a frozen atlas object this is OK but adds a subscriber-fan-out problem when the loading visualization updates phase progress every ~100ms.
4. **Module-level singleton + `useSyncExternalStore`** — a small in-module pub/sub (`subscribe`, `getSnapshot`, `dispatch`) wired via React 18's official `useSyncExternalStore` hook. Selector hooks subscribe to the slices they need; React handles the rest.

Option (4) gives fine-grained reactivity without a dependency, survives strict-mode double-mount (the singleton is initialized once per module load), and is contained per iframe by construction.

## Decision

**Atlas state lives in a module-level singleton (`core/atlas-store.ts`) exposing a tiny pub/sub interface, and React surfaces subscribe via `useSyncExternalStore`.**

Concretely:

- `core/atlas-store.ts` exports:
  - A typed `AtlasState` (`status: 'idle' | 'scanning' | 'completed' | 'canceled' | 'error'`, `atlas: Atlas | null`, `scanProgress: { sites, pages, components, elapsed_ms }`, `errors: string[]`).
  - `subscribe(listener)` and `getSnapshot()` for the `useSyncExternalStore` contract.
  - Action functions: `startScan(scope)`, `cancelScan()`, `refreshAtlas()`, `setScope(scope)`. These mutate the singleton and emit notifications.
- `core/atlas-store.ts` holds the `AbortController` for the in-flight scan and a strict-mode guard (a module-level boolean) preventing double-start.
- React selector hooks (`useAtlas()`, `useScanStatus()`, `useScanProgress()`) wrap `useSyncExternalStore` with selectors; components subscribe only to the slice they render.
- **No `window.*` globals.** All state is inside the module's closure.
- **No localStorage / sessionStorage / IndexedDB writes** — ADR-0003 forbids persistence, and this state surface is the obvious place such a violation would creep in. Reviewers must reject any PR that introduces them.

## Consequences

**Easier:**
- One file, no dependency. Easy to read, easy to test (the action functions are pure-ish — they take an SDK client and the singleton).
- Fine-grained reactivity — the loading visualization updates without re-rendering the search-first table.
- Strict-mode safe by construction — module-level guard means double-mount in dev does not start two scans.
- Contained per iframe — the singleton is part of the iframe's module heap; cross-tab and cross-iframe leakage are physically impossible.

**Harder:**
- No devtools / time-travel debugging out of the box (Redux DevTools won't see this). Mitigation: the in-iframe telemetry buffer (ADR-0013) captures every state transition with timestamps; the editor-facing debug panel can render it.
- Module-level singletons can be confusing for engineers expecting hooks-only state. Mitigation: the public API is the selector hooks; the singleton is an implementation detail.
- Test setups that import the module multiple times must reset the singleton between tests; provide a `__resetForTest()` export gated by `NODE_ENV === 'test'`.

**Forbidden in this ADR:**
- Adding Zustand, Redux, Jotai, Recoil, MobX, or any other state-management library.
- Putting atlas state in React Context.
- Using `window.__ATLAS__` or any `window` global as a backing store.
- Persisting any part of the state to localStorage / sessionStorage / IndexedDB / cookies.

## Date

2026-04-27
