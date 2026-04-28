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

import { useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import type { ClientSDK } from '@sitecore-marketplace-sdk/client';
import { mdiRefresh } from '@mdi/js';
import { useAtlasSlice } from '@/core/use-atlas-slice';
import {
  cancelScan,
  refreshAtlas,
  triggerScan,
} from '@/core/atlas-actions';
import { ScanStatusBar } from '@/components/atlas/scan-status-bar';
import { DirectBindingsAffordance } from '@/components/atlas/direct-bindings-affordance';
import { CounterRail } from '@/components/atlas/counter-rail';
import { DensityToggle, type Density } from '@/components/atlas/density-toggle';
import { WidgetTable } from '@/components/atlas/widget-table';
import { UsageDrawer } from '@/components/atlas/usage-drawer';
import { SkippedDrawer } from '@/components/atlas/skipped-drawer';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import type {
  Atlas,
  AtlasState,
  RenderingUsage,
  Skipped,
} from '@/lib/sdk/types';
import { cn } from '@/lib/utils';

export type WidgetSurfaceProps = {
  readonly client: ClientSDK;
  readonly contextId: string;
};

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
  onRefresh,
}: {
  state: AtlasState;
  totals: Atlas['totals'] | null;
  onRefresh: () => void;
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
          {totals ? (
            <>
              <strong>{totals.pages.toLocaleString('en-US')} pages</strong>
              <span className="text-muted-foreground"> · </span>
              <strong>{totals.sites.toLocaleString('en-US')} sites</strong>
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
}: WidgetSurfaceProps): React.ReactElement {
  const state = useAtlasSlice((s) => s);

  // Local UI state — drawer open flags, query, density. Atlas state is
  // the source of truth for everything else.
  const [query, setQuery] = useState('');
  const [density, setDensity] = useState<Density>('compact');
  const [selectedRenderingId, setSelectedRenderingId] = useState<
    string | null
  >(null);
  const [skippedOpen, setSkippedOpen] = useState(false);

  // T040 — first-mount scan trigger; T064 — re-mount-during-scan does
  // NOT duplicate the scan because we only call triggerScan when state
  // is 'idle'. atlas-actions also has its own guard, so even if the
  // surface re-mounts during scanning, the second triggerScan no-ops.
  useEffect(() => {
    if (state.kind === 'idle') {
      triggerScan({ kind: 'all-collections' }, client, contextId);
    }
    // We deliberately depend only on the bare minimum so a state change
    // mid-scan doesn't re-trigger. A full restart goes through the
    // refreshAtlas action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atlas = visibleAtlas(state);

  // Memoize the empty-Map fallback so referential identity is stable
  // across renders when the atlas isn't ready yet (otherwise the React
  // Compiler refuses to memoize downstream consumers).
  const renderings: ReadonlyMap<string, RenderingUsage> = useMemo(
    () => atlas?.renderingIndex ?? new Map(),
    [atlas],
  );
  const skipped: ReadonlyArray<Skipped> = atlas?.skipped ?? [];
  const totals = atlas?.totals ?? null;

  const selectedRendering = useMemo(() => {
    if (!selectedRenderingId) return null;
    return renderings.get(selectedRenderingId) ?? null;
  }, [renderings, selectedRenderingId]);

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
          <FreshnessRibbon
            state={state}
            totals={totals}
            onRefresh={() => refreshAtlas(client, contextId)}
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
        </div>
      </div>

      {/* Zone 3 — search + table */}
      <div className="zone-3 min-h-0 flex-1 overflow-hidden">
        <WidgetTable
          renderings={renderings}
          query={query}
          density={density}
          searchDisabled={searchDisabled}
          onQueryChange={setQuery}
          onSelectRendering={(rid) => setSelectedRenderingId(rid)}
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

      {/* Drawer — per-rendering page list */}
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

      {/* Skipped pages sub-drawer */}
      <SkippedDrawer
        open={skippedOpen}
        skipped={skipped}
        onClose={() => setSkippedOpen(false)}
      />
    </div>
  );
}
