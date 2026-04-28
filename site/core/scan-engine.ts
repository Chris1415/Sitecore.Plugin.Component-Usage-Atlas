// T027 — Scan engine orchestrator (architecture § 4.5).
//
// `runScan(input)` returns a `ScanHandle = { cancel, donePromise }`.
// The handle is owned by the action layer (T033) which stores it as
// `currentHandle` and exposes `cancelScan()` / `refreshAtlas()`.
//
// Steps (per § 4 T027 + architecture § 4.5):
//
//   1. Validate `contextId` (empty string → AtlasNoContextError →
//      transition to error state with reason 'no-context').
//   2. Set state → `scanning(phase: 'sites')`. Emit `scan_started`.
//   3. Enumerate sites via `enumerateSites`. On failure → error
//      state ('sites-fetch-failed'). Emit `scan_error`.
//   4. Phase transition → 'pages'. Resolve site language via
//      `resolveSiteLanguageWithCache` (concurrency-pool, cap 8).
//      Per-site language resolution failures fall back to 'en' so
//      the scan continues (architecture § 4.4 / § 5.4 — site-level
//      faults aren't fatal to the scan).
//   5. Per-site `enumeratePages` to flatten into `pageRefs[]`.
//   6. Phase transition → 'components'. `runWithConcurrency` over
//      `pageRefs.map(p => () => fetchComponents(...))`. Each per-page
//      result is a `PromiseSettledResult<ComponentRecord[]>` —
//      rejections are classified as `Skipped` by the index-builder.
//   7. `buildIndices(pageRefs, results)`. `freezeAtlas(...)`.
//   8. If `signal.aborted` at any point during the components phase
//      AND the user explicitly canceled → state = `canceled` with
//      `isPartial: true`. Emit `scan_canceled`. Otherwise state =
//      `completed`. Emit `scan_completed`.
//
// The scan-state-machine guards every transition (T025) so a buggy
// engine emits a clearly named error rather than corrupting state.
//
// Errors NOT from per-page fan-out (sites enumeration, language
// resolution if the bus catastrophically fails) → state = 'error'.
// Per-page rejections are NORMAL and end up in `skipped[]`.
//
// SDK isolation: this module never reaches into `client.query` /
// `client.mutate` directly. All SDK access is brokered by the
// queries/enumerator/fetcher modules so M3's "mock SDK at the
// queries.ts boundary" rule (per § 4 T015 friction note) holds.

import { createAbortBus } from '@/core/abort-bus';
import {
  clearScanInFlight,
  getAtlasSnapshot,
  markScanStarting,
  setAtlasState,
} from '@/core/atlas-store';
import { runWithConcurrency } from '@/core/concurrency-pool';
import { AtlasNoContextError } from '@/core/context-resolver';
import { fetchComponents } from '@/core/components-fetcher';
import { freezeAtlas } from '@/core/atlas-freeze';
import { buildIndices } from '@/core/index-builder';
import { enumeratePages } from '@/core/pages-enumerator';
import { SCAN_CONCURRENCY, type ScanSurface } from '@/core/scan-config';
import { transitionTo } from '@/core/scan-state-machine';
import {
  createSiteLanguageCache,
  resolveSiteLanguageWithCache,
} from '@/core/site-language-resolver';
import { enumerateSites } from '@/core/sites-enumerator';
import { track } from '@/core/telemetry';
import type { ClientSDK } from '@sitecore-marketplace-sdk/client';
import type {
  Atlas,
  AtlasErrorReason,
  AtlasScope,
  AtlasState,
  ComponentRecord,
  PageRef,
  PageStub,
  ScanProgress,
  Site,
} from '@/lib/sdk/types';

// Re-export `ScanSurface` from scan-config for backwards compatibility.
// The canonical definition lives in scan-config.ts so withBackoff can
// reference it without forming a circular import.
export type { ScanSurface };

export type ScanInput = {
  readonly client: ClientSDK;
  readonly contextId: string;
  readonly scope: AtlasScope;
  /**
   * The surface that initiated the scan. Used to tag every telemetry
   * event emitted by this run. Defaults to `'widget'` for backwards
   * compatibility with callers (and tests) that don't supply it.
   * M5 fix from code-review-20260428T110500Z.
   */
  readonly surface?: ScanSurface;
};

export type ScanHandle = {
  readonly cancel: () => void;
  readonly donePromise: Promise<void>;
};

const initialProgress = (
  phase: ScanProgress['phase'],
  total: number,
  startedAt: number,
): ScanProgress => ({
  phase,
  current: 0,
  total,
  elapsedMs: Date.now() - startedAt,
});

const transitionState = (next: AtlasState): void => {
  const prev = getAtlasSnapshot();
  setAtlasState(transitionTo(prev, next));
};

const buildAtlas = (
  scope: AtlasScope,
  pageRefs: ReadonlyArray<PageRef>,
  results: ReadonlyArray<PromiseSettledResult<ReadonlyArray<ComponentRecord>>>,
  isPartial: boolean,
): Atlas => {
  const indices = buildIndices(pageRefs, results);
  return freezeAtlas({
    scope,
    scannedAt: Date.now(),
    isPartial,
    renderingIndex: indices.renderingIndex,
    datasourceIndex: indices.datasourceIndex,
    skipped: indices.skipped,
    totals: indices.totals,
  });
};

const errorState = (reason: AtlasErrorReason): AtlasState => ({ kind: 'error', reason });

const safeTransitionToError = (reason: AtlasErrorReason): void => {
  const prev = getAtlasSnapshot();
  // The state machine only allows scanning → error; if we never
  // entered scanning (e.g. context check failed up front), shortcut by
  // first lifting to a synthetic scanning state. We do this with a
  // direct setAtlasState bypass for the no-context case because
  // architecture § 4.1 lists `idle → error` as DISALLOWED but
  // architecture § 10.1 W5/P5 expects the surfaces to render the
  // `error` state from a fresh mount. Implementation: from idle, lift
  // through scanning briefly so the state-machine guard passes.
  if (prev.kind === 'idle') {
    setAtlasState({
      kind: 'scanning',
      scope: { kind: 'all-collections' },
      progress: { phase: 'sites', current: 0, total: 0, elapsedMs: 0 },
    });
  }
  setAtlasState(transitionTo(getAtlasSnapshot(), errorState(reason)));
};

export function runScan(input: ScanInput): ScanHandle {
  const { client, contextId, scope } = input;
  const surface: ScanSurface = input.surface ?? 'widget';
  const bus = createAbortBus();
  const startedAt = Date.now();

  const cancel = (): void => {
    bus.abort();
  };

  // Strict-mode guard — if a scan is already in flight, return a
  // no-op handle whose donePromise resolves immediately. This makes
  // double-mount scenarios under React 18 strict-mode safe.
  if (!markScanStarting()) {
    return { cancel, donePromise: Promise.resolve() };
  }

  const donePromise = (async (): Promise<void> => {
    try {
      // 1. Context guard.
      if (typeof contextId !== 'string' || contextId.length === 0) {
        throw new AtlasNoContextError();
      }

      // 2. Phase: sites.
      transitionState({
        kind: 'scanning',
        scope,
        progress: initialProgress('sites', 0, startedAt),
      });
      track({
        timestamp_ms: Date.now(),
        kind: 'scan_started',
        surface,
        scopeKind: scope.kind,
      });

      let sites: ReadonlyArray<Site>;
      try {
        sites = await enumerateSites(client, contextId, scope);
      } catch (err) {
        const reason: AtlasErrorReason = {
          kind: 'sites-fetch-failed',
          cause: err instanceof Error ? err.message : String(err),
        };
        safeTransitionToError(reason);
        track({
          timestamp_ms: Date.now(),
          kind: 'scan_error',
          surface,
          reasonKind: reason.kind,
        });
        return;
      }

      // 3. Phase: pages.
      transitionState({
        kind: 'scanning',
        scope,
        progress: initialProgress('pages', sites.length, startedAt),
      });
      track({
        timestamp_ms: Date.now(),
        kind: 'phase_transition',
        surface,
        from: 'sites',
        to: 'pages',
      });

      const languageCache = createSiteLanguageCache();
      const perSiteLanguages: Array<{ readonly site: Site; readonly language: string }> =
        await runWithConcurrency<{ readonly site: Site; readonly language: string }>(
          sites.map((site) => async () => {
            try {
              const language = await resolveSiteLanguageWithCache(
                client,
                contextId,
                site,
                languageCache,
              );
              return { site, language };
            } catch {
              // Site-level fault — fall back to 'en' rather than
              // dropping the site entirely. Per architecture § 5.4
              // the editor wants visibility on every accessible site
              // even when language resolution fails.
              return { site, language: 'en' };
            }
          }),
          SCAN_CONCURRENCY,
          bus.signal,
        ).then((settled) =>
          settled
            .filter(
              (r): r is PromiseFulfilledResult<{ readonly site: Site; readonly language: string }> =>
                r.status === 'fulfilled',
            )
            .map((r) => r.value),
        );

      // Enumerate pages per site, flatten to a single pageRefs[].
      const pageRefs: PageRef[] = [];
      const pageStubs: PageStub[] = [];
      for (const { site, language } of perSiteLanguages) {
        if (bus.aborted()) break;
        try {
          const stubs = await enumeratePages(client, contextId, site, language, bus.signal);
          for (const stub of stubs) {
            pageStubs.push(stub);
            pageRefs.push({
              pageId: stub.pageId,
              pageName: stub.pageName,
              sitePath: stub.sitePath,
              siteId: stub.siteId,
              siteName: stub.siteName,
            });
          }
        } catch {
          // Site-level page-list failure → skip the site quietly.
          // (We never knew the page IDs, so no `Atlas.skipped` entry
          // is possible. The widget's "Sites scanned" counter
          // reflects only what made it through.)
        }
      }

      // 4. Phase: components.
      transitionState({
        kind: 'scanning',
        scope,
        progress: initialProgress('components', pageStubs.length, startedAt),
      });
      track({
        timestamp_ms: Date.now(),
        kind: 'phase_transition',
        surface,
        from: 'pages',
        to: 'components',
      });

      const componentResults = await runWithConcurrency<ReadonlyArray<ComponentRecord>>(
        pageStubs.map((stub) => () => fetchComponents(client, contextId, stub, bus.signal, surface)),
        SCAN_CONCURRENCY,
        bus.signal,
      );

      // 5. Build atlas.
      const isPartial = bus.aborted();
      const atlas = buildAtlas(scope, pageRefs, componentResults, isPartial);

      if (isPartial) {
        transitionState({ kind: 'canceled', atlas });
        track({
          timestamp_ms: Date.now(),
          kind: 'scan_canceled',
          surface,
          pages: pageStubs.length,
          skipped: atlas.skipped.length,
        });
      } else {
        transitionState({ kind: 'completed', atlas });
        track({
          timestamp_ms: Date.now(),
          kind: 'scan_completed',
          surface,
          pages: pageStubs.length,
          skipped: atlas.skipped.length,
          renderings: atlas.totals.renderings,
          datasources: atlas.totals.datasources,
        });
      }
    } catch (err) {
      // Unexpected fault outside the per-page fan-out (e.g. context
      // resolution, atlas freeze, state-machine misuse). Distinguish
      // AtlasNoContextError from generic faults so the surfaces can
      // render the correct copy.
      if (err instanceof AtlasNoContextError) {
        safeTransitionToError({ kind: 'no-context' });
      } else {
        safeTransitionToError({
          kind: 'unexpected',
          cause: err instanceof Error ? err.message : String(err),
        });
      }
      track({
        timestamp_ms: Date.now(),
        kind: 'scan_error',
        surface,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      // Allow the next scan to start.
      clearScanInFlight();
    }
  })();

  return { cancel, donePromise };
}
