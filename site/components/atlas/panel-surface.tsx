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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import type {
  ApplicationContext,
  ClientSDK,
} from '@sitecore-marketplace-sdk/client';
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
import {
  DownloadButton,
  type CopyStatus,
  type DownloadButtonState,
  type ExportFormat,
  type OpenStatus,
  type SaveStatus,
} from '@/components/atlas/download-button';
import { useSaveExport } from '@/core/atlas/export/hooks/use-save-export';
import { useOpenExport } from '@/core/atlas/export/hooks/use-open-export';
import { useCopyExport } from '@/core/atlas/export/hooks/use-copy-export';
import { buildExport } from '@/core/atlas/export/build-export';
import { estimateAtlasSizeBytes } from '@/core/atlas/export/size-estimator';
import {
  cloneSurfaceContext,
  type ExportPanelPage,
  type SurfaceContext,
} from '@/core/atlas/export/surface-context';
import {
  AtlasNoContextError,
  requireTenantIdentity,
} from '@/core/tenant-identity';
import {
  emitExportAttempt,
  emitExportFail,
  emitExportSuccess,
} from '@/core/atlas/export/telemetry/events';
import {
  showExportFailureToast,
  showExportSuccessToast,
} from '@/components/atlas/export-toasts';
import { getAtlasSnapshot } from '@/core/atlas-store';
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
  /**
   * The Marketplace `application.context` payload from
   * `<MarketplaceProvider>`. Required at runtime so the export feature can
   * resolve the tenant identity at click time per ADR-0020.
   */
  readonly appContext?: ApplicationContext | null;
  /** Per ADR-0021 — see WidgetSurfaceProps for rationale. */
  readonly sandboxBlocksDownload?: boolean;
};

function defaultSandboxBlocksDownload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

// --- T037 export-cluster sub-component --------------------------------

const EMPTY_EXPORT_BLOB = new Blob([], { type: 'text/plain' });

interface BuiltExport {
  readonly blob: Blob;
  readonly text: string;
  readonly filename: string;
  readonly format: ExportFormat;
}

interface PanelExportClusterProps {
  readonly state: AtlasState;
  readonly atlas: Atlas | null;
  readonly appContext: ApplicationContext | null;
  readonly sandboxBlocksDownload: boolean;
  /**
   * Live ref into the panel's per-page snapshot — read at action-click
   * time to satisfy AC-2.7 (ADR-0016 click-time clone). Driven by the
   * panel's `useEffect` on `pages.context` updates.
   */
  readonly activePanelPageRef: React.MutableRefObject<ExportPanelPage | null>;
  readonly isPageFetchInFlight: boolean;
}

function deriveExportSurfaceState(
  state: AtlasState,
  atlas: Atlas | null,
  isPageFetchInFlight: boolean,
): DownloadButtonState {
  if (isPageFetchInFlight) return 'disabled-panel-loading';
  if (atlas) return 'enabled';
  if (state.kind === 'scanning') return 'disabled-scan-in-progress-no-prior';
  return 'disabled-no-data';
}

function PanelExportCluster({
  state,
  atlas,
  appContext,
  sandboxBlocksDownload,
  activePanelPageRef,
  isPageFetchInFlight,
}: PanelExportClusterProps): React.ReactElement {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [built, setBuilt] = useState<BuiltExport | null>(null);

  const atlasSizeBytes = useMemo(
    () => (atlas ? estimateAtlasSizeBytes(atlas) : null),
    [atlas],
  );

  const blobForHooks = built?.blob ?? EMPTY_EXPORT_BLOB;
  const textForHooks = built?.text ?? '';
  const filenameForHooks = built?.filename ?? '';
  const copyMode: 'text' | 'html' = built?.format === 'html' ? 'html' : 'text';

  const { status: rawSaveStatus, save } = useSaveExport({
    blob: blobForHooks,
    filename: filenameForHooks,
  });
  const { status: rawOpenStatus, open } = useOpenExport({ blob: blobForHooks });
  const {
    status: rawCopyStatus,
    deniedMessage,
    copy,
  } = useCopyExport({ text: textForHooks, mode: copyMode });

  const surfaceTag = 'panel' as const;

  // Build the export with the atlas snapshot + click-time panelPage clone.
  // Used by handleAction (per AC-2.7 the panel re-clones on EVERY action click
  // so mid-flight navigation does not corrupt the export). The format-pick
  // path also uses this so the Save / Open / Copy hooks have a populated
  // Blob before any user click.
  const constructForAction = useCallback(
    (
      format: ExportFormat,
      action: 'save' | 'open' | 'copy',
    ): BuiltExport | null => {
      const snapshot = getAtlasSnapshot();
      const liveAtlas =
        snapshot.kind === 'completed' || snapshot.kind === 'canceled'
          ? snapshot.atlas
          : (snapshot.kind === 'scanning' || snapshot.kind === 'error') &&
              snapshot.priorAtlas
            ? snapshot.priorAtlas
            : atlas;
      if (!liveAtlas) return null;

      let tenant: ReturnType<typeof requireTenantIdentity>;
      try {
        tenant = requireTenantIdentity(appContext ?? null);
      } catch (err) {
        if (err instanceof AtlasNoContextError) {
          emitExportFail({
            surface: surfaceTag,
            format,
            action,
            errorCode: 'unknown',
          });
          return null;
        }
        throw err;
      }

      const livePanelPage = activePanelPageRef.current;

      const ctx: SurfaceContext = {
        surface: surfaceTag,
        tenant,
        scope: { kind: 'all-collections' },
        languagesScanned: livePanelPage ? [livePanelPage.language] : [],
        scanTimestamp: new Date(liveAtlas.scannedAt).toISOString(),
        isPartial: liveAtlas.isPartial,
        totals: {
          sites: liveAtlas.totals.sites,
          pages: liveAtlas.totals.pages,
          renderings: liveAtlas.totals.renderings,
          datasources: liveAtlas.totals.datasources,
        },
        skippedPages: [],
        ...(livePanelPage
          ? {
              panelPage: {
                pageId: livePanelPage.pageId,
                pageName: livePanelPage.pageName,
                sitePath: livePanelPage.sitePath,
                siteId: livePanelPage.siteId,
                siteName: livePanelPage.siteName,
                language: livePanelPage.language,
              },
            }
          : {}),
      };

      try {
        const result = buildExport({
          atlas: liveAtlas,
          surface: surfaceTag,
          format,
          // cloneSurfaceContext deep-clones at the click moment per AC-2.7 /
          // ADR-0016. From this point on the construction function reads only
          // the clone — no live singleton or React-context lookups.
          surfaceContext: cloneSurfaceContext(ctx),
          exportedAt: new Date().toISOString(),
        });
        return {
          blob: result.blob,
          text: '',
          filename: result.filename,
          format,
        };
      } catch {
        emitExportFail({
          surface: surfaceTag,
          format,
          action,
          errorCode: 'blob_construction_failed',
        });
        showExportFailureToast({
          errorCode: 'blob_construction_failed',
          action,
        });
        return null;
      }
    },
    [appContext, atlas, activePanelPageRef],
  );

  const onSelectFormat = useCallback(
    (format: ExportFormat) => {
      // Format-pick eager construction populates the hooks so the action
      // pills can render their statuses. The action-click handlers re-build
      // with a fresh click-time clone (AC-2.7).
      const initial = constructForAction(format, 'save');
      if (!initial) {
        setSelectedFormat(null);
        setBuilt(null);
        return;
      }
      setSelectedFormat(format);
      setBuilt(initial);
      void initial.blob.text().then((body) => {
        setBuilt((prev) =>
          prev && prev.blob === initial.blob ? { ...prev, text: body } : prev,
        );
      });
    },
    [constructForAction],
  );

  const handleSave = useCallback(() => {
    if (!selectedFormat) return;
    // Re-clone at action-click time per AC-2.7 — the format-pick clone may be
    // stale if the editor navigated pages between format selection and click.
    const fresh = constructForAction(selectedFormat, 'save');
    if (!fresh) return;
    setBuilt(fresh);
    void fresh.blob.text().then((body) => {
      setBuilt((prev) =>
        prev && prev.blob === fresh.blob ? { ...prev, text: body } : prev,
      );
    });
    emitExportAttempt({
      surface: surfaceTag,
      format: selectedFormat,
      action: 'save',
      atlasSize: atlasSizeBytes ?? undefined,
    });
    save();
  }, [atlasSizeBytes, constructForAction, save, selectedFormat]);

  const handleOpen = useCallback(() => {
    if (!selectedFormat) return;
    const fresh = constructForAction(selectedFormat, 'open');
    if (!fresh) return;
    setBuilt(fresh);
    void fresh.blob.text().then((body) => {
      setBuilt((prev) =>
        prev && prev.blob === fresh.blob ? { ...prev, text: body } : prev,
      );
    });
    emitExportAttempt({
      surface: surfaceTag,
      format: selectedFormat,
      action: 'open',
      atlasSize: atlasSizeBytes ?? undefined,
    });
    open();
  }, [atlasSizeBytes, constructForAction, open, selectedFormat]);

  const handleCopy = useCallback(() => {
    if (!selectedFormat) return;
    const fresh = constructForAction(selectedFormat, 'copy');
    if (!fresh) return;
    setBuilt(fresh);
    void fresh.blob.text().then((body) => {
      setBuilt((prev) =>
        prev && prev.blob === fresh.blob ? { ...prev, text: body } : prev,
      );
    });
    emitExportAttempt({
      surface: surfaceTag,
      format: selectedFormat,
      action: 'copy',
      atlasSize: atlasSizeBytes ?? undefined,
    });
    void copy();
  }, [atlasSizeBytes, constructForAction, copy, selectedFormat]);

  // Telemetry on hook-status transitions (mirrors the widget surface). We
  // cannot place these inside the action callbacks because the hook flips
  // status asynchronously after the action runs.
  useEffect(() => {
    if (!selectedFormat) return;
    if (rawSaveStatus === 'saved') {
      emitExportSuccess({ surface: surfaceTag, format: selectedFormat, action: 'save' });
      if (built) {
        showExportSuccessToast({
          filename: built.filename,
          action: 'save',
          isEmptyAtlas: !atlas || atlas.totals.renderings === 0,
        });
      }
    }
  }, [atlas, built, rawSaveStatus, selectedFormat]);

  useEffect(() => {
    if (!selectedFormat) return;
    if (rawOpenStatus === 'opened') {
      emitExportSuccess({ surface: surfaceTag, format: selectedFormat, action: 'open' });
      if (built) {
        showExportSuccessToast({
          filename: built.filename,
          action: 'open',
          isEmptyAtlas: !atlas || atlas.totals.renderings === 0,
        });
      }
    } else if (rawOpenStatus === 'blocked') {
      emitExportFail({
        surface: surfaceTag,
        format: selectedFormat,
        action: 'open',
        errorCode: 'popup_blocked',
      });
    }
  }, [atlas, built, rawOpenStatus, selectedFormat]);

  useEffect(() => {
    if (!selectedFormat) return;
    if (rawCopyStatus === 'copied') {
      emitExportSuccess({ surface: surfaceTag, format: selectedFormat, action: 'copy' });
      if (built) {
        showExportSuccessToast({
          filename: built.filename,
          action: 'copy',
          isEmptyAtlas: !atlas || atlas.totals.renderings === 0,
        });
      }
    } else if (rawCopyStatus === 'denied') {
      emitExportFail({
        surface: surfaceTag,
        format: selectedFormat,
        action: 'copy',
        errorCode: 'clipboard_blocked',
      });
    }
  }, [atlas, built, rawCopyStatus, selectedFormat]);

  const surfaceState = deriveExportSurfaceState(state, atlas, isPageFetchInFlight);
  const saveStatus: SaveStatus = rawSaveStatus;
  const openStatus: OpenStatus = rawOpenStatus;
  const copyStatus: CopyStatus = rawCopyStatus;

  return (
    <DownloadButton
      surface="panel"
      state={surfaceState}
      atlasSizeBytes={atlasSizeBytes}
      onSelectFormat={onSelectFormat}
      selectedFormat={selectedFormat}
      saveStatus={saveStatus}
      openStatus={openStatus}
      copyStatus={copyStatus}
      copyDeniedMessage={deniedMessage}
      onSave={handleSave}
      onOpen={handleOpen}
      onCopy={handleCopy}
      sandboxBlocksDownload={sandboxBlocksDownload}
    />
  );
}

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
  appContext = null,
  sandboxBlocksDownload,
}: PanelSurfaceProps): React.ReactElement {
  const state = useAtlasSlice((s) => s);
  const sandboxBlocked =
    sandboxBlocksDownload ?? defaultSandboxBlocksDownload();

  // Active page tracked locally — pages.context onSuccess updates it.
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [activePageName, setActivePageName] = useState<string | null>(null);
  const [activePagePath, setActivePagePath] = useState<string | null>(null);

  // AC-2.7 click-time clone backing — the panel mirrors its current page
  // snapshot into a ref so the export cluster reads it at action click,
  // independent of React render scheduling. The ref is intentionally
  // unsynchronized with React state for export purposes — it tracks the
  // LATEST `pages.context` onSuccess payload synchronously so click-time
  // clones see the correct page even mid-batch.
  const activePanelPageRef = useRef<ExportPanelPage | null>(null);

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
            // AC-2.7 — mirror the panel snapshot into the export ref
            // SYNCHRONOUSLY so a Save/Open/Copy click that fires in the
            // same tick as a page-switch (or before React processes the
            // setState batch) sees the latest page identity.
            activePanelPageRef.current = id
              ? {
                  pageId: id,
                  pageName: name ?? id,
                  sitePath: path ?? '',
                  siteId: '',
                  siteName: '',
                  language: 'en',
                }
              : null;
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

      {/* Zone 2 — direct-bindings affordance + export cluster + page-context card */}
      <div className="zone-2 border-b border-border">
        <div className="flex items-center justify-between gap-3 bg-card px-4 py-2">
          <DirectBindingsAffordance />
          {/* T037 — action cluster sits in zone-2 (panel layout has no
              Refresh button next door — refresh lives inside PageContextCard
              below). Inserted before the skipped-link warning per UI § 4.8. */}
          <PanelExportCluster
            state={state}
            atlas={atlas}
            appContext={appContext ?? null}
            sandboxBlocksDownload={sandboxBlocked}
            activePanelPageRef={activePanelPageRef}
            isPageFetchInFlight={isPageFetchInFlight}
          />
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
