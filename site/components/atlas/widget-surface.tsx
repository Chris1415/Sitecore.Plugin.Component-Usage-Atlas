'use client';

// T040 — `<WidgetSurface />`. Composes the M4 atomic primitives + the
// new M5 widget components into the dashboardblocks surface.
//
// Composition flow:
//   atlas-store (M3)   ── useAtlasSlice (M3) ───────┐
//                                                   ▼
//   <WidgetSurface />                ── triggers ── atlas-actions (M3)
//      ├── Zone 1 ── <ScanStatusBar /> | freshness summary
//      ├── Zone 2 ── <DirectBindingsAffordance /> + Skipped link
//      ├── Zone 3 ── <WidgetTable /> (search + table rows)
//      └── Zone 4 ── <CounterRail /> (4 CounterRow cells)
//   Click row → <UsageDrawer /> → onNavigate → client.mutate('pages.context')
//   Skipped link / KPI → <SkippedDrawer /> (no navigation; rows disabled)
//
// The surface owns ONLY local UI state (selected rendering, drawer open
// flags, search query, density). Atlas state is the source of truth.
//
// Per T064: atlas-store is a module singleton, so unmount/re-mount is a
// no-op for the scan; the surface re-attaches via useAtlasSlice and
// renders the current state immediately.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import type {
  ApplicationContext,
  ClientSDK,
} from '@sitecore-marketplace-sdk/client';
import { mdiRefresh } from '@mdi/js';
import { useAtlasSlice } from '@/core/use-atlas-slice';
import {
  cancelScan,
  refreshAtlas,
  triggerScan,
} from '@/core/atlas-actions';
import { track } from '@/core/telemetry';
import { ScanStatusBar } from '@/components/atlas/scan-status-bar';
import { DirectBindingsAffordance } from '@/components/atlas/direct-bindings-affordance';
import { CounterRail } from '@/components/atlas/counter-rail';
import { DensityToggle, type Density } from '@/components/atlas/density-toggle';
import { WidgetTable } from '@/components/atlas/widget-table';
import { SkippedDrawer } from '@/components/atlas/skipped-drawer';
import { ThemeSwitcher } from '@/components/theme-switcher';
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
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import type {
  Atlas,
  AtlasState,
  Skipped,
} from '@/lib/sdk/types';
import { cn } from '@/lib/utils';

export type WidgetSurfaceProps = {
  readonly client: ClientSDK;
  readonly contextId: string;
  /**
   * The Marketplace `application.context` payload from
   * `<MarketplaceProvider>`. Required at runtime so the export feature can
   * resolve the tenant identity at click time per ADR-0020. Optional in the
   * type so existing call sites compile while the integration lands; in
   * production the provider always passes it (see `app/widget/page.tsx`).
   */
  readonly appContext?: ApplicationContext | null;
  /**
   * Per ADR-0021, the Save action is rendered disabled while the Marketplace
   * iframe sandbox blocks `allow-downloads`. The default uses a runtime probe
   * (`window.self !== window.top`) so the same code paints correctly in both
   * the iframed Marketplace and the standalone dev preview. Tests override
   * the default to drive the Save-enabled branch.
   */
  readonly sandboxBlocksDownload?: boolean;
};

// Per § 4c-4 the Save action is disabled whenever the app runs inside an
// iframe (the Marketplace sandbox lacks `allow-downloads`). When Sitecore
// adds `allow-downloads`, flip the prop default to `false` — no other code
// change required.
function defaultSandboxBlocksDownload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin frame access throws — assume sandboxed.
    return true;
  }
}

// --- pure selectors / helpers ----------------------------------------

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

// --- sub-components ---------------------------------------------------

function FreshnessRibbon({
  state,
  totals,
  hostSiteName,
  onRefresh,
  exportCluster,
}: {
  state: AtlasState;
  totals: Atlas['totals'] | null;
  hostSiteName: string | null;
  onRefresh: () => void;
  exportCluster: React.ReactElement | null;
}): React.ReactElement {
  const isCanceled = state.kind === 'canceled';
  return (
    <div className="freshness flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
      <div className="freshness__left flex items-center gap-3 text-sm">
        <span
          aria-hidden="true"
          className={cn(
            'freshness__icon inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
            isCanceled
              ? 'bg-warning-bg text-warning-fg'
              : 'bg-success-bg text-success-fg',
          )}
        >
          {isCanceled ? '⚠' : '✓'}
        </span>
        <span className="freshness__summary text-foreground font-mono tabular-nums">
          {hostSiteName ? (
            <>
              <span className="text-muted-foreground">site </span>
              <strong>{hostSiteName}</strong>
              <span className="text-muted-foreground"> · </span>
            </>
          ) : null}
          {totals ? (
            <>
              <strong>{totals.pages.toLocaleString('en-US')} pages</strong>
              <span className="text-muted-foreground"> · </span>
              <strong>
                {totals.renderings.toLocaleString('en-US')} renderings
              </strong>
              {totals.skipped > 0 ? (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <strong className="text-warning-fg">
                    {totals.skipped.toLocaleString('en-US')} skipped
                  </strong>
                </>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">No scan results yet.</span>
          )}
        </span>
      </div>
      <div className="freshness__right inline-flex items-center gap-2">
        {/* T036 — Action cluster mounted FIRST (data-out before data-mutation
            per UI § 4.8). Refresh follows so the visual order is
            [Format | Save | Open | Copy] [Refresh atlas]. */}
        {exportCluster}
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onRefresh}
          aria-label="Refresh atlas"
        >
          <Icon path={mdiRefresh} size={0.75} />
          <span>Refresh atlas</span>
        </Button>
      </div>
    </div>
  );
}

// --- T036 export integration -----------------------------------------

// Empty-blob placeholder used when no format is selected yet. The action
// pills are disabled in this state (cohortDisabled in <DownloadButton>) so
// the hooks never actually fire on this blob — but the hooks still need a
// stable Blob reference at render time per the React Rules of Hooks.
const EMPTY_EXPORT_BLOB = new Blob([], { type: 'text/plain' });

interface BuiltExport {
  readonly blob: Blob;
  readonly text: string;
  readonly filename: string;
  readonly format: ExportFormat;
}

function deriveExportSurfaceState(
  state: AtlasState,
  atlas: Atlas | null,
): DownloadButtonState {
  if (atlas) return 'enabled';
  if (state.kind === 'scanning') return 'disabled-scan-in-progress-no-prior';
  return 'disabled-no-data';
}

function deriveExportScopeKind(atlas: Atlas | null): 'all-collections' | 'collection' {
  if (!atlas) return 'all-collections';
  return atlas.scope.kind === 'collection' ? 'collection' : 'all-collections';
}

interface WidgetExportClusterProps {
  readonly state: AtlasState;
  readonly atlas: Atlas | null;
  readonly appContext: ApplicationContext | null;
  readonly sandboxBlocksDownload: boolean;
}

function WidgetExportCluster({
  state,
  atlas,
  appContext,
  sandboxBlocksDownload,
}: WidgetExportClusterProps): React.ReactElement {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [built, setBuilt] = useState<BuiltExport | null>(null);

  // Atlas size for the format-picker tier annotation. Lazily computed so the
  // estimator only runs when the menu actually opens (DownloadButton calls
  // sizeAnnotationTier on each render, but estimateAtlasSizeBytes is the
  // expensive piece). Memoized over `atlas` referential identity which is
  // stable per the singleton's bail-out.
  const atlasSizeBytes = useMemo(
    () => (atlas ? estimateAtlasSizeBytes(atlas) : null),
    [atlas],
  );

  // The hooks need stable Blob / text references; we feed them either the
  // built export or the empty placeholder. `selectedFormat === null` keeps
  // the cluster disabled at the component level so the placeholder hooks
  // never actually fire.
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

  // Telemetry helpers. We only emit success/fail when the corresponding hook
  // status TRANSITIONS — tracking via refs in the hooks would couple the
  // hook to the surface; instead we react to the status change here.
  const surfaceTag = 'widget' as const;
  const scopeKind = deriveExportScopeKind(atlas);

  const onSelectFormat = useCallback(
    (format: ExportFormat) => {
      // Read atlas at click-time per ADR-0010 / ADR-0016; falls back to the
      // hook closure when the singleton happens to be unset.
      const snapshot = getAtlasSnapshot();
      const liveAtlas =
        snapshot.kind === 'completed' || snapshot.kind === 'canceled'
          ? snapshot.atlas
          : (snapshot.kind === 'scanning' || snapshot.kind === 'error') &&
              snapshot.priorAtlas
            ? snapshot.priorAtlas
            : atlas;

      if (!liveAtlas) return;

      // Resolve tenant identity. Failure here is a planning gap (the surface
      // should not have rendered the cluster); we still guard so a missing
      // appContext doesn't crash the render.
      let tenant: ReturnType<typeof requireTenantIdentity>;
      try {
        tenant = requireTenantIdentity(appContext ?? null);
      } catch (err) {
        if (err instanceof AtlasNoContextError) {
          emitExportFail({
            surface: surfaceTag,
            format,
            action: 'save',
            errorCode: 'unknown',
          });
          return;
        }
        throw err;
      }

      // Build the click-time surface context per ADR-0016.
      const ctx: SurfaceContext = {
        surface: surfaceTag,
        tenant,
        scope: { kind: scopeKind },
        languagesScanned: [],
        scanTimestamp: new Date(liveAtlas.scannedAt).toISOString(),
        isPartial: liveAtlas.isPartial,
        totals: {
          sites: liveAtlas.totals.sites,
          pages: liveAtlas.totals.pages,
          renderings: liveAtlas.totals.renderings,
          datasources: liveAtlas.totals.datasources,
        },
        skippedPages: [],
      };

      try {
        const result = buildExport({
          atlas: liveAtlas,
          surface: surfaceTag,
          format,
          surfaceContext: cloneSurfaceContext(ctx),
          exportedAt: new Date().toISOString(),
        });
        // The hook for Copy needs the body as a string. We read it from the
        // freshly-built Blob asynchronously — the Copy pill stays disabled
        // until the text resolves (a single microtask in jsdom; for low-MB
        // atlases in production this completes well within one frame).
        setSelectedFormat(format);
        setBuilt({
          blob: result.blob,
          text: '',
          filename: result.filename,
          format,
        });
        void result.blob.text().then((body) => {
          setBuilt((prev) =>
            prev && prev.blob === result.blob ? { ...prev, text: body } : prev,
          );
        });
      } catch {
        emitExportFail({
          surface: surfaceTag,
          format,
          action: 'save',
          errorCode: 'blob_construction_failed',
        });
        showExportFailureToast({
          errorCode: 'blob_construction_failed',
          action: 'save',
        });
        setSelectedFormat(null);
        setBuilt(null);
      }
    },
    [appContext, atlas, scopeKind],
  );

  // --- per-action wiring ------------------------------------------------

  const handleSave = useCallback(() => {
    if (!built || !selectedFormat) return;
    emitExportAttempt({
      surface: surfaceTag,
      format: selectedFormat,
      action: 'save',
      atlasSize: atlasSizeBytes ?? undefined,
      scopeKind,
    });
    save();
  }, [atlasSizeBytes, built, save, scopeKind, selectedFormat]);

  const handleOpen = useCallback(() => {
    if (!built || !selectedFormat) return;
    emitExportAttempt({
      surface: surfaceTag,
      format: selectedFormat,
      action: 'open',
      atlasSize: atlasSizeBytes ?? undefined,
      scopeKind,
    });
    open();
  }, [atlasSizeBytes, built, open, scopeKind, selectedFormat]);

  const handleCopy = useCallback(() => {
    if (!built || !selectedFormat) return;
    emitExportAttempt({
      surface: surfaceTag,
      format: selectedFormat,
      action: 'copy',
      atlasSize: atlasSizeBytes ?? undefined,
      scopeKind,
    });
    void copy();
  }, [atlasSizeBytes, built, copy, scopeKind, selectedFormat]);

  // React to status transitions and emit success/fail telemetry exactly once
  // per terminal transition. The hooks self-revert success states to 'idle'
  // after their own windows; we fire on the rising edge into 'saved' /
  // 'opened' / 'copied' / 'blocked' / 'denied'.
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

  // Cluster-level disabled state. When no atlas yet, surface state is the
  // primary driver; when atlas is loaded, individual pills follow their
  // hook statuses.
  const surfaceState = deriveExportSurfaceState(state, atlas);

  // Collapse hook statuses into the props expected by <DownloadButton>.
  const saveStatus: SaveStatus = rawSaveStatus;
  const openStatus: OpenStatus = rawOpenStatus;
  const copyStatus: CopyStatus = rawCopyStatus;

  return (
    <DownloadButton
      surface="widget"
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

function SkippedLink({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}): React.ReactElement | null {
  if (count <= 0) return null;
  const labelText = `${count} page${count === 1 ? '' : 's'} skipped — view`;
  return (
    <button
      type="button"
      className="skipped-link disclosure__skipped text-warning-fg inline-flex items-center gap-1 text-xs"
      aria-label={labelText}
      onClick={onClick}
    >
      <span aria-hidden="true">⚠</span>
      <span>{labelText}</span>
    </button>
  );
}

// --- main component ---------------------------------------------------

export function WidgetSurface({
  client,
  contextId,
  appContext = null,
  sandboxBlocksDownload,
}: WidgetSurfaceProps): React.ReactElement {
  const state = useAtlasSlice((s) => s);
  const sandboxBlocked =
    sandboxBlocksDownload ?? defaultSandboxBlocksDownload();

  // Local UI state — drawer open flags, query, density. Atlas state is
  // the source of truth for everything else.
  const [query, setQuery] = useState('');
  const [density, setDensity] = useState<Density>('compact');
  // D2 v1 — inline expansion replaces the right-side drawer on this
  // surface. The state semantic is "which row is currently expanded";
  // empty drawer == collapsed.
  const [expandedRenderingId, setExpandedRenderingId] = useState<
    string | null
  >(null);
  const [skippedOpen, setSkippedOpen] = useState(false);

  // S21 — The dashboard widget runs under a specific site (Image #15
  // shows it in the solo-website dashboard). We resolve that site name
  // via `client.query('site.context')` BEFORE kicking off the scan so
  // the scan walks only the host site instead of all tenant sites.
  // SDK contract: `node_modules/@sitecore-marketplace-sdk/client/dist/
  // sdk-types.d.ts` declares `QueryMap['site.context']` returning
  // `SiteContext = { siteInfo: { siteId, name, displayName, url, hosts } }`.
  const [hostSite, setHostSite] = useState<{
    readonly siteId: string;
    readonly name: string;
    readonly displayName: string;
  } | null>(null);
  const [hostSiteResolved, setHostSiteResolved] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = (await client.query('site.context')) as {
          data?: {
            siteInfo?: {
              siteId?: string;
              name?: string;
              displayName?: string;
            };
          };
        };
        const info = res?.data?.siteInfo;
        if (!alive) return;
        if (info?.name) {
          setHostSite({
            siteId: info.siteId ?? '',
            name: info.name,
            displayName: info.displayName ?? info.name,
          });
        }
      } catch {
        // No host site context — fall back to all-collections scope.
      } finally {
        if (alive) setHostSiteResolved(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [client]);

  // T040 — first-mount scan trigger; T064 — re-mount-during-scan does
  // NOT duplicate the scan because we only call triggerScan when state
  // is 'idle'. atlas-actions also has its own guard, so even if the
  // surface re-mounts during scanning, the second triggerScan no-ops.
  // S21: hold the trigger until the site.context resolution lands so
  // we don't fire an all-collections scan only to immediately replace
  // it with a site-scoped one.
  useEffect(() => {
    if (!hostSiteResolved) return;
    if (state.kind === 'idle') {
      const scope = hostSite
        ? { kind: 'site' as const, siteName: hostSite.name }
        : { kind: 'all-collections' as const };
      triggerScan(scope, client, contextId);
    }
    track({
      timestamp_ms: Date.now(),
      kind: 'surface_mounted',
      surface: 'widget',
    });
    // We deliberately depend only on the bare minimum so a state change
    // mid-scan doesn't re-trigger. A full restart goes through the
    // refreshAtlas action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostSiteResolved]);

  const atlas = visibleAtlas(state);

  // Memoize the empty-Map fallback so referential identity is stable
  // across renders when the atlas isn't ready yet (otherwise the React
  // Compiler refuses to memoize downstream consumers).
  const renderings = useMemo(
    () => atlas?.renderingIndex ?? new Map(),
    [atlas],
  );
  const skipped: ReadonlyArray<Skipped> = useMemo(
    () => atlas?.skipped ?? [],
    [atlas],
  );
  const totals = atlas?.totals ?? null;
  void renderings;

  const forbiddenPageIds = useMemo(
    () =>
      new Set(
        skipped
          .filter((s) => s.reason === 'forbidden')
          .map((s) => s.pageId),
      ),
    [skipped],
  );

  // CounterRail status mapping — drives the cell visual primitive.
  const railStatus: Parameters<typeof CounterRail>[0]['status'] =
    state.kind === 'idle'
      ? 'idle'
      : state.kind === 'scanning' && !atlas
        ? 'loading'
        : state.kind === 'error' && !atlas
          ? 'error'
          : 'ready';

  // Search is disabled while scanning AND we have no prior atlas to
  // filter against. After the first scan completes, the input is live
  // even during re-scan (FR-2.5).
  const searchDisabled = state.kind === 'scanning' && !atlas;

  // T040 — surface composition. POC class anchors preserved on
  // wrappers (`.surface-frame`, `.zone-1`, etc.) for visual diff.
  return (
    <div className="surface-frame flex h-full flex-col bg-background">
      {/* Zone 1 — status bar (scanning) OR freshness ribbon (otherwise) */}
      <div className="zone-1">
        {state.kind === 'scanning' ? (
          <>
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
            {/* AC-1.1 — refresh-with-prior: when a completed atlas is still in
                memory, the export cluster stays visible (and operational on the
                prior atlas) while the new scan runs in the background. */}
            {atlas ? (
              <div className="freshness-while-scanning flex items-center justify-end gap-2 border-b border-border bg-card px-4 py-2">
                <WidgetExportCluster
                  state={state}
                  atlas={atlas}
                  appContext={appContext ?? null}
                  sandboxBlocksDownload={sandboxBlocked}
                />
              </div>
            ) : null}
          </>
        ) : (
          <FreshnessRibbon
            state={state}
            totals={totals}
            hostSiteName={hostSite?.displayName ?? null}
            onRefresh={() => refreshAtlas(client, contextId)}
            exportCluster={
              <WidgetExportCluster
                state={state}
                atlas={atlas}
                appContext={appContext ?? null}
                sandboxBlocksDownload={sandboxBlocked}
              />
            }
          />
        )}
      </div>

      {/* Zone 2 — disclosure: direct-bindings affordance + skipped link + density */}
      <div className="zone-2 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
        <div className="zone-2__left inline-flex items-center gap-3">
          <DirectBindingsAffordance />
          <SkippedLink
            count={skipped.length}
            onClick={() => setSkippedOpen(true)}
          />
        </div>
        <div className="zone-2__right inline-flex items-center gap-2">
          <span className="text-muted-foreground font-mono text-xs">
            density
          </span>
          <DensityToggle value={density} onChange={setDensity} />
          <ThemeSwitcher />
        </div>
      </div>

      {/* Zone 3 — search + table (with inline-expansion detail per D2 v1) */}
      <div className="zone-3 min-h-0 flex-1 overflow-hidden">
        <WidgetTable
          renderings={atlas?.renderingIndex ?? new Map()}
          query={query}
          density={density}
          searchDisabled={searchDisabled}
          isScanning={state.kind === 'scanning' && !atlas}
          onQueryChange={setQuery}
          onSelectRendering={(rid) =>
            setExpandedRenderingId((prev) => (prev === rid ? null : rid))
          }
          expandedRenderingId={expandedRenderingId}
          atlas={atlas}
          forbiddenPageIds={forbiddenPageIds}
          onCollapse={() => setExpandedRenderingId(null)}
          onNavigatePage={(pageId) => {
            void client.mutate('pages.context', { params: { itemId: pageId } });
            setExpandedRenderingId(null);
          }}
          client={client}
          contextId={contextId}
        />
      </div>

      {/* Zone 4 — KPI rail */}
      <div className="zone-4 border-t border-border">
        <CounterRail
          totals={totals}
          status={railStatus}
          onOpenSkipped={() => setSkippedOpen(true)}
        />
      </div>

      {/* Skipped pages sub-drawer */}
      <SkippedDrawer
        open={skippedOpen}
        skipped={skipped}
        onClose={() => setSkippedOpen(false)}
      />
    </div>
  );
}
