'use client';

// T050 / T052 / T053 / T054 — `<PanelSurface />`.
//
// Page-context-first panel for the `xmc:pages:context-panel` extension
// point. Differs from the widget surface in three load-bearing ways
// (architecture § 4.5.2 / ADR-0004):
//
//   1. Subscribes to `pages.context` via `client.query('pages.context',
//      { subscribe: true, onSuccess })` — the Pages-host fires the
//      callback whenever the editor navigates pages so Zone 3 re-paints
//      immediately. The widget surface NEVER subscribes (per
//      `client.md` § 7 — `xmc:dashboardblocks` doesn't expose this).
//
//   2. Issues a SECOND independent fetch for the components on the
//      ACTIVE page on a separate `AbortBus` so the rendering stack
//      paints in <1s even on a 5k-page tenant whose global scan is
//      still in progress (OQ-A5).
//
//   3. Suppresses Zone 4 — no KPI rail. The panel viewport is narrow
//      and the cross-tenant counter is the primary signal, not the
//      tenant aggregates.
//
// The surface owns ONLY local UI state (active pageId, drawer open
// flag, per-page components result). Atlas state is read via
// `useAtlasSlice` exactly the same way the widget reads it.
//
// Lifecycle:
//   mount         → subscribe(pages.context); start global scan if idle
//                   → fetchComponents(activePageId) on a new AbortBus
//   page-switch   → cancel old AbortBus, fetchComponents(newPageId) on
//                   a fresh bus, do NOT re-trigger global scan
//   unmount       → unsubscribe; abort the page-fetch bus

import { useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import type { ClientSDK } from '@sitecore-marketplace-sdk/client';
import { useAtlasSlice } from '@/core/use-atlas-slice';
import { useDatasourceNames } from '@/core/use-datasource-names';
import {
  cancelScan,
  refreshAtlas,
  triggerScan,
} from '@/core/atlas-actions';
import { fetchComponents } from '@/core/components-fetcher';
import { createAbortBus } from '@/core/abort-bus';
import { track } from '@/core/telemetry';
import { ScanStatusBar } from '@/components/atlas/scan-status-bar';
import { DirectBindingsAffordance } from '@/components/atlas/direct-bindings-affordance';
import { PageContextCard } from '@/components/atlas/page-context-card';
import { RenderingImpactList } from '@/components/atlas/rendering-impact-list';
import { DatasourceImpactGroup } from '@/components/atlas/datasource-impact-group';
import { UsageDrawer } from '@/components/atlas/usage-drawer';
import { DatasourceUsageDrawer } from '@/components/atlas/datasource-usage-drawer';
import { SkippedDrawer } from '@/components/atlas/skipped-drawer';
import type {
  Atlas,
  AtlasState,
  ComponentRecord,
  DatasourceUsage,
  PageStub,
  RenderingUsage,
  Skipped,
} from '@/lib/sdk/types';

export type PanelSurfaceProps = {
  readonly client: ClientSDK;
  readonly contextId: string;
};

// --- helpers ---------------------------------------------------------

function visibleAtlas(state: AtlasState): Atlas | null {
  if (state.kind === 'completed' || state.kind === 'canceled') {
    return state.atlas;
  }
  if (state.kind === 'scanning' && state.priorAtlas) {
    return state.priorAtlas;
  }
  if (state.kind === 'error' && state.priorAtlas) {
    return state.priorAtlas;
  }
  return null;
}

function phaseStatesFor(
  state: AtlasState,
): Parameters<typeof ScanStatusBar>[0]['phases'] {
  if (state.kind !== 'scanning') {
    return { sites: 'pending', pages: 'pending', components: 'pending' };
  }
  const phase = state.progress.phase;
  return {
    sites: phase === 'sites' ? 'active' : 'completed',
    pages:
      phase === 'pages'
        ? 'active'
        : phase === 'components'
          ? 'completed'
          : 'pending',
    components: phase === 'components' ? 'active' : 'pending',
  };
}

// pages.context subscribe-via-query Path A return type — we can't import
// the SDK's internal callback shape in a typed way without coupling to
// hey-api internals, so we model it locally. The returned object exposes
// an `unsubscribe()` per `client.md` § 6a.
type PagesContextSubscribeResult = {
  readonly unsubscribe?: () => void;
};

type PagesContextEvent = {
  readonly pageInfo?: { readonly id?: string; readonly name?: string; readonly path?: string };
};

// `client.query` overloads in `@sitecore-marketplace-sdk/client/dist/types.d.ts`
// (`BaseQueryOptions`) accept `subscribe`, `onSuccess`, `onError`, but the
// generated `QueryMap['pages.context']` does not surface a typed callback
// signature for `onSuccess`. We model the subscription option shape
// locally and cross to it through `unknown` once — no `any`.
type PagesContextSubscribeOptions = {
  readonly subscribe: true;
  readonly onSuccess: (data: PagesContextEvent) => void;
  readonly onError?: (err: unknown) => void;
};

// --- main component --------------------------------------------------

export function PanelSurface({
  client,
  contextId,
}: PanelSurfaceProps): React.ReactElement {
  const state = useAtlasSlice((s) => s);

  // Active page tracked locally — pages.context onSuccess updates it.
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [activePageName, setActivePageName] = useState<string | null>(null);
  const [activePagePath, setActivePagePath] = useState<string | null>(null);

  // Per-page fetch result tagged with the page it was fetched FOR. We
  // derive the visible list (`displayedComponents` below) by comparing
  // `forPageId` to the current `activePageId` — that way a page-switch
  // doesn't have to flush state from inside an effect.
  const [pageComponents, setPageComponents] = useState<{
    readonly forPageId: string;
    readonly components: ReadonlyArray<ComponentRecord>;
  } | null>(null);

  // Drawer state.
  const [selectedRenderingId, setSelectedRenderingId] = useState<string | null>(
    null,
  );
  const [selectedDatasourceId, setSelectedDatasourceId] = useState<string | null>(
    null,
  );
  const [hoveredDatasourceId, setHoveredDatasourceId] = useState<string | null>(
    null,
  );
  const [skippedOpen, setSkippedOpen] = useState(false);

  // Per-page AbortBus — separate from the global scan's bus so the
  // panel can cancel the active-page fetch on page-switch / unmount
  // without aborting the global scan.
  const pageBusRef = useRef<{ abort: () => void } | null>(null);

  // 1. First-mount: kick off the global scan if we're idle.
  useEffect(() => {
    if (state.kind === 'idle') {
      // M5 fix from code-review-20260428T110500Z: tag the scan as
      // panel-initiated so telemetry events emitted by the engine
      // surface as `surface: 'panel'` not `'widget'`.
      triggerScan({ kind: 'all-collections' }, client, contextId, 'panel');
    }
    track({
      timestamp_ms: Date.now(),
      kind: 'surface_mounted',
      surface: 'panel',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Subscribe to `pages.context` on mount; unsubscribe on unmount.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    const subscribe = async () => {
      try {
        const options: PagesContextSubscribeOptions = {
          subscribe: true,
          onSuccess: (data: PagesContextEvent) => {
            if (!active) return;
            const id = data?.pageInfo?.id ?? null;
            const name = data?.pageInfo?.name ?? null;
            const path = data?.pageInfo?.path ?? null;
            setActivePageId(id);
            setActivePageName(name);
            setActivePagePath(path);
          },
          onError: (err: unknown) => {
            track({
              timestamp_ms: Date.now(),
              kind: 'scan_error',
              surface: 'panel',
              cause: err instanceof Error ? err.message : String(err),
            });
          },
        };
        // Cross to the SDK signature through `unknown` once — the SDK's
        // generated `QueryMap['pages.context']` does not advertise the
        // typed callback shape, but `BaseQueryOptions` (cited above)
        // does. The cast surface is now a single typed interface, not
        // `any`.
        const res = (await client.query(
          'pages.context',
          options as unknown as Parameters<typeof client.query>[1],
        )) as PagesContextSubscribeResult;
        if (!active) {
          res?.unsubscribe?.();
          return;
        }
        unsubscribe = res?.unsubscribe;
      } catch (err) {
        track({
          timestamp_ms: Date.now(),
          kind: 'scan_error',
          surface: 'panel',
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    };

    void subscribe();

    return () => {
      active = false;
      // Abort any in-flight per-page fetch.
      pageBusRef.current?.abort();
      // Unsubscribe from pages.context.
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Per-page fetch — issue a fresh fetch whenever activePageId changes.
  //    Each fetch lives on its own AbortBus so page-switch cancels the
  //    prior fetch but does NOT touch the global scan.
  //
  //    We track the FETCHED pageId alongside the components so that on
  //    page-switch the stale list can be discarded by a derived value
  //    (instead of `setPageComponents([])` inside the effect, which
  //    would trip `react-hooks/set-state-in-effect`).
  useEffect(() => {
    if (!activePageId) return;
    pageBusRef.current?.abort();
    const bus = createAbortBus();
    pageBusRef.current = bus;

    let alive = true;
    void (async () => {
      try {
        const stub: PageStub = {
          pageId: activePageId,
          pageName: activePageName ?? activePageId,
          sitePath: activePagePath ?? '',
          siteId: '',
          siteName: '',
          language: 'en',
        };
        const result = await fetchComponents(client, contextId, stub, bus.signal, 'panel');
        if (!alive || bus.signal.aborted) return;
        setPageComponents({ forPageId: activePageId, components: result });
      } catch (err) {
        if (bus.signal.aborted) return;
        track({
          timestamp_ms: Date.now(),
          kind: 'scan_error',
          surface: 'panel',
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      alive = false;
      bus.abort();
    };
  }, [activePageId, activePageName, activePagePath, client, contextId]);

  // The visible component list is the LAST fetched result IF it matches
  // the current active page. Otherwise we render an empty list while
  // the new fetch is in flight — derived rather than effect-mutated.
  // Memoized so downstream `useMemo` dependents have stable refs.
  const displayedComponents: ReadonlyArray<ComponentRecord> = useMemo(
    () =>
      pageComponents && pageComponents.forPageId === activePageId
        ? pageComponents.components
        : [],
    [pageComponents, activePageId],
  );

  // S16 — true while we have an active page but the components fetch
  // for it has not yet landed. Drives the skeleton in zone-3 lists.
  const isPageFetchInFlight =
    activePageId !== null &&
    (pageComponents === null || pageComponents.forPageId !== activePageId);

  // S12 — gather the unique datasource IDs visible on the current page
  // and ask the Authoring API to resolve human-readable names for any
  // GUID/path-shaped ones. The hook caches results process-wide so
  // navigating between pages doesn't re-fetch.
  const visibleDatasourceIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of displayedComponents) {
      if (c.datasourceId) set.add(c.datasourceId);
    }
    return Array.from(set);
  }, [displayedComponents]);
  const resolvedDatasourceNames = useDatasourceNames(
    client,
    contextId,
    visibleDatasourceIds,
  );

  // Atlas + skipped projection.
  const atlas = visibleAtlas(state);
  const renderings: ReadonlyMap<string, RenderingUsage> = useMemo(
    () => atlas?.renderingIndex ?? new Map(),
    [atlas],
  );
  const skipped: ReadonlyArray<Skipped> = atlas?.skipped ?? [];
  const totals = atlas?.totals ?? null;
  void totals;

  const selectedRendering = useMemo(() => {
    if (!selectedRenderingId) return null;
    return renderings.get(selectedRenderingId) ?? null;
  }, [renderings, selectedRenderingId]);

  const selectedDatasource: DatasourceUsage | null = useMemo(() => {
    if (!selectedDatasourceId) return null;
    return atlas?.datasourceIndex.get(selectedDatasourceId) ?? null;
  }, [atlas, selectedDatasourceId]);

  return (
    <div
      className="surface-frame surface-frame--panel flex h-full flex-col bg-background"
      data-surface="panel"
    >
      {/* Zone 1 — status bar OR a lightweight build-artifact summary */}
      <div className="zone-1">
        {state.kind === 'scanning' ? (
          <ScanStatusBar
            phases={phaseStatesFor(state)}
            currentPhase={state.progress.phase}
            counts={{
              current: state.progress.current,
              total: state.progress.total,
            }}
            elapsedMs={state.progress.elapsedMs}
            onCancel={() => cancelScan()}
            isCancellable={true}
          />
        ) : (
          <div className="freshness flex items-center gap-3 border-b border-border bg-card px-4 py-2 text-sm">
            <span aria-hidden="true" className="text-success-fg">
              ✓
            </span>
            <span className="text-muted-foreground font-mono text-xs">
              {state.kind === 'completed' && atlas
                ? `${atlas.totals.renderings} renderings · ${atlas.totals.datasources} datasources · ${atlas.totals.pages} pages`
                : state.kind === 'canceled'
                  ? 'Last scan canceled — partial results visible'
                  : state.kind === 'error'
                    ? 'Atlas unavailable'
                    : 'Atlas idle'}
            </span>
          </div>
        )}
      </div>

      {/* Zone 2 — direct-bindings affordance + page-context card */}
      <div className="zone-2 border-b border-border">
        <div className="flex items-center justify-between gap-3 bg-card px-4 py-2">
          <DirectBindingsAffordance />
          {skipped.length > 0 ? (
            <button
              type="button"
              className="text-warning-fg inline-flex items-center gap-1 text-xs"
              onClick={() => setSkippedOpen(true)}
              aria-label={`${skipped.length} pages skipped — view`}
            >
              <span aria-hidden="true">⚠</span>
              <span>{skipped.length} skipped</span>
            </button>
          ) : null}
        </div>
        <PageContextCard
          pageName={activePageName ?? undefined}
          pagePath={activePagePath ?? undefined}
          onRefresh={() => refreshAtlas(client, contextId, 'panel')}
        />
      </div>

      {/* Zone 3 — unified rendering tree (datasource impact nested per row, S23) */}
      <div className="zone-3 min-h-0 flex-1 overflow-y-auto">
        <RenderingImpactList
          activePageId={activePageId}
          components={displayedComponents}
          atlas={atlas}
          onSelectRendering={(rid) => setSelectedRenderingId(rid)}
          onSelectDatasource={(dsId) => setSelectedDatasourceId(dsId)}
          hoveredDatasourceId={hoveredDatasourceId}
          onHoverDatasource={setHoveredDatasourceId}
          isLoading={isPageFetchInFlight}
          resolvedDatasourceNames={resolvedDatasourceNames}
        />
      </div>

      {/* No Zone 4 — KPI rail is widget-only per architecture § 4.5.2 */}

      {/* Rendering drawer — opened by RENDERINGS ON THIS PAGE rows */}
      {selectedRendering ? (
        <UsageDrawer
          open={selectedRenderingId !== null}
          rendering={selectedRendering}
          allRenderings={renderings}
          forbiddenPageIds={
            new Set(
              skipped
                .filter((s) => s.reason === 'forbidden')
                .map((s) => s.pageId),
            )
          }
          onClose={() => setSelectedRenderingId(null)}
          onNavigate={(pageId) => {
            void client.mutate('pages.context', { params: { itemId: pageId } });
            setSelectedRenderingId(null);
          }}
        />
      ) : null}

      {/* Datasource drawer — opened by DATASOURCE IMPACT rows (S10) */}
      {selectedDatasource ? (
        <DatasourceUsageDrawer
          open={selectedDatasourceId !== null}
          datasource={selectedDatasource}
          allRenderings={renderings}
          forbiddenPageIds={
            new Set(
              skipped
                .filter((s) => s.reason === 'forbidden')
                .map((s) => s.pageId),
            )
          }
          onClose={() => setSelectedDatasourceId(null)}
          onNavigate={(pageId) => {
            void client.mutate('pages.context', { params: { itemId: pageId } });
            setSelectedDatasourceId(null);
          }}
        />
      ) : null}

      <SkippedDrawer
        open={skippedOpen}
        skipped={skipped}
        onClose={() => setSkippedOpen(false)}
      />
    </div>
  );
}
