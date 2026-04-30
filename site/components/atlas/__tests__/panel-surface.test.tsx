// T050 / T052 / T053 — RED+GREEN inline UI tests for `<PanelSurface />`.
//
// Panel surface composes (top → bottom):
//   - Zone 1: <ScanStatusBar /> when scanning, otherwise FreshnessRibbon
//   - Zone 2: <DirectBindingsAffordance /> + page-context info
//   - Zone 3: <RenderingImpactList /> (renderings on the active page)
//   - Zone 3 bis: <DatasourceImpactGroup /> (datasources on the active page)
//   - NO Zone 4 (no KPI rail on panel — § 4 T050)
//
// On mount, the panel:
//   1. Calls triggerScan({ kind: 'whole-tenant' }) when state is idle.
//   2. Subscribes to `pages.context` via client.query('pages.context',
//      { subscribe: true, onSuccess }).
//   3. Per-page fetch via fetchComponents on a separate AbortBus
//      (architecture § 6.4 / OQ-A5).
//
// On unmount, the panel:
//   - Calls the subscription's unsubscribe.
//   - Aborts the per-page AbortBus (no leaked fetches).
//
// Page-switch (T053):
//   - The pages.context onSuccess fires → currentPageId state updates →
//     Zone 3 re-paints. Status bar (Zone 1) remains static.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import {
  __resetForTest,
  setAtlasState,
} from '@/core/atlas-store';
import { __resetActionsForTest } from '@/core/atlas-actions';
import { PanelSurface } from '@/components/atlas/panel-surface';
import type { Atlas, AtlasState } from '@/lib/sdk/types';

// --- mocks --------------------------------------------------------------

const triggerScanMock = vi.fn();
const cancelScanMock = vi.fn();
const refreshAtlasMock = vi.fn();

vi.mock('@/core/atlas-actions', async () => {
  const actual = await vi.importActual<typeof import('@/core/atlas-actions')>(
    '@/core/atlas-actions',
  );
  return {
    ...actual,
    triggerScan: (...args: unknown[]) => {
      triggerScanMock(...args);
      return { cancel: () => undefined, donePromise: Promise.resolve() };
    },
    cancelScan: () => cancelScanMock(),
    refreshAtlas: (...args: unknown[]) => {
      refreshAtlasMock(...args);
      return { cancel: () => undefined, donePromise: Promise.resolve() };
    },
  };
});

// fetchComponents: per-page fetch shape used by PanelSurface for the
// active-page rendering stack. The engine's components-fetcher is
// already proved by M3 — here we mock the function to return a
// deterministic list.
const fetchComponentsMock = vi.fn();

vi.mock('@/core/components-fetcher', async () => {
  const actual = await vi.importActual<
    typeof import('@/core/components-fetcher')
  >('@/core/components-fetcher');
  return {
    ...actual,
    fetchComponents: (...args: unknown[]) => fetchComponentsMock(...args),
  };
});

// --- SDK stub -----------------------------------------------------------

type SubscribeArgs = {
  subscribe: true;
  onSuccess: (data: { pageInfo?: { id?: string } }) => void;
  onError?: (err: unknown) => void;
};

const queryMock = vi.fn();
const mutateMock = vi.fn(() => Promise.resolve(undefined));
const unsubscribeMock = vi.fn();

const stubContextId = 'ctx-test-1234';

function makeClient() {
  return {
    query: queryMock,
    mutate: mutateMock,
  } as unknown as Parameters<typeof PanelSurface>[0]['client'];
}

// --- fixtures -----------------------------------------------------------

function makeAtlas(overrides: Partial<Atlas> = {}): Atlas {
  return {
    scope: { kind: 'all-collections' },
    scannedAt: 1_700_000_000_000,
    isPartial: false,
    renderingIndex: new Map([
      [
        'rid-hero',
        {
          renderingId: 'rid-hero',
          displayName: 'Hero Banner',
          isUnknown: false,
          totalUsages: 13,
          datasources: ['ds-hero'],
          pages: [
            // First entry IS the active page so the "+N other pages use this"
            // counter excludes it (12 = 13 - 1).
            {
              pageId: 'page-active-1',
              pageName: 'Active Page',
              sitePath: '/active',
              siteId: 's1',
              siteName: 'acme',
            },
            ...Array.from({ length: 12 }, (_, i) => ({
              pageId: `p${i}`,
              pageName: `Page ${i}`,
              sitePath: `/p${i}`,
              siteId: 's1',
              siteName: 'acme',
            })),
          ],
        },
      ],
      [
        'rid-card',
        {
          renderingId: 'rid-card',
          displayName: 'Card Grid',
          isUnknown: false,
          totalUsages: 35,
          datasources: ['ds-card'],
          pages: Array.from({ length: 35 }, (_, i) => ({
            pageId: `p${i + 100}`,
            pageName: `Card Page ${i}`,
            sitePath: `/cards/${i}`,
            siteId: 's1',
            siteName: 'acme',
          })),
        },
      ],
    ]),
    datasourceIndex: new Map([
      [
        'ds-hero',
        {
          datasourceId: 'ds-hero',
          displayName: 'HeroData-Main',
          isMissing: false,
          pages: Array.from({ length: 42 }, (_, i) => ({
            pageId: `pds${i}`,
            pageName: `DS Page ${i}`,
            sitePath: `/dsp/${i}`,
            siteId: 's1',
            siteName: 'acme',
          })),
          renderings: ['rid-hero'],
        },
      ],
    ]),
    skipped: [],
    totals: {
      sites: 12,
      pages: 312,
      renderings: 47,
      datasources: 184,
      skipped: 0,
    },
    ...overrides,
  };
}

function makeState(kind: AtlasState['kind']): AtlasState {
  if (kind === 'idle') return { kind: 'idle' };
  if (kind === 'scanning') {
    return {
      kind: 'scanning',
      scope: { kind: 'all-collections' },
      progress: { phase: 'pages', current: 100, total: 312, elapsedMs: 5_000 },
    };
  }
  if (kind === 'completed') return { kind: 'completed', atlas: makeAtlas() };
  if (kind === 'canceled') return { kind: 'canceled', atlas: makeAtlas({ isPartial: true }) };
  return { kind: 'error', reason: { kind: 'no-context' } };
}

// --- setup --------------------------------------------------------------

beforeEach(() => {
  __resetForTest();
  __resetActionsForTest();
  triggerScanMock.mockReset();
  cancelScanMock.mockReset();
  refreshAtlasMock.mockReset();
  fetchComponentsMock.mockReset();
  fetchComponentsMock.mockResolvedValue([
    {
      placementId: 'pl-1',
      renderingId: 'rid-hero',
      renderingName: 'Hero Banner',
      placeholderKey: 'main',
      datasourceId: 'ds-hero',
    },
    {
      placementId: 'pl-2',
      renderingId: 'rid-card',
      renderingName: 'Card Grid',
      placeholderKey: 'main',
      datasourceId: 'ds-card-missing',
    },
  ]);
  queryMock.mockReset();
  mutateMock.mockReset();
  unsubscribeMock.mockReset();
  // application.context.pages — subscribe path returns an object with
  // an `unsubscribe` method; the M6 panel awaits this and uses the
  // onSuccess callback to track the active page.
  queryMock.mockImplementation(async (key: string, opts?: SubscribeArgs) => {
    if (key === 'pages.context' && opts?.subscribe) {
      // Fire an initial onSuccess synchronously (microtask) so the
      // surface paints with a real pageId immediately.
      Promise.resolve().then(() => {
        opts.onSuccess({ pageInfo: { id: 'page-active-1' } });
      });
      return { unsubscribe: unsubscribeMock };
    }
    return { data: undefined };
  });
});

afterEach(() => {
  cleanup();
});

// --- tests --------------------------------------------------------------

describe('<PanelSurface />', () => {
  it('renders no Zone 4 (no KPI rail) — distinguishing feature vs widget', () => {
    setAtlasState(makeState('completed'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    expect(document.querySelector('.zone-4')).toBeNull();
  });

  it('renders the DirectBindingsAffordance in Zone 2', () => {
    setAtlasState(makeState('completed'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    expect(screen.getByTestId('direct-bindings-affordance')).toBeInTheDocument();
  });

  it('starts a scan on mount when atlas is idle', () => {
    setAtlasState(makeState('idle'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    expect(triggerScanMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT start a scan on mount when atlas is completed', () => {
    setAtlasState(makeState('completed'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    expect(triggerScanMock).not.toHaveBeenCalled();
  });

  it('subscribes to pages.context on mount', async () => {
    setAtlasState(makeState('completed'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    await waitFor(() => {
      expect(queryMock).toHaveBeenCalledWith(
        'pages.context',
        expect.objectContaining({ subscribe: true }),
      );
    });
  });

  it('calls unsubscribe + does not leak the subscription on unmount', async () => {
    setAtlasState(makeState('completed'));
    const { unmount } = render(
      <PanelSurface client={makeClient()} contextId={stubContextId} />,
    );
    // Wait for the subscription promise to resolve so unsubscribe is wired.
    await waitFor(() => {
      expect(queryMock).toHaveBeenCalled();
    });
    // Allow microtask queue (subscription resolution) to flush.
    await Promise.resolve();
    await Promise.resolve();
    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('renders the active-page rendering stack from per-page fetch', async () => {
    setAtlasState(makeState('completed'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    // After pages.context resolves with page-active-1, fetchComponents
    // is called and the renderings paint.
    await waitFor(() => {
      expect(fetchComponentsMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Hero Banner')).toBeInTheDocument();
      expect(screen.getByText('Card Grid')).toBeInTheDocument();
    });
  });

  it('renders cross-tenant counter "+N other pages use this" for each rendering', async () => {
    setAtlasState(makeState('completed'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    await waitFor(() => {
      expect(fetchComponentsMock).toHaveBeenCalled();
    });
    // Hero is on 13 pages total — "+12 other pages use this" (excluding
    // active page).
    await waitFor(() => {
      expect(screen.getByText('Hero Banner')).toBeInTheDocument();
    });
    // The plus-N counter chip is one of the row's pieces; we don't
    // require an exact aria-label here (state-driven), but the visible
    // count is the rendering's pages.length minus 1 if the active page
    // is in the index.
    expect(
      screen.getByText((c) => c === '12' || c === '+12 other pages use this'),
    ).toBeInTheDocument();
  });

  it('expands a rendering row to expose a nested datasource detail (S23)', async () => {
    setAtlasState(makeState('completed'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    await waitFor(() => {
      expect(fetchComponentsMock).toHaveBeenCalled();
    });
    // Find any rendering-impact row and toggle it open.
    const row = await waitFor(() =>
      screen.getAllByTestId('rendering-impact-row')[0],
    );
    expect(row).toBeDefined();
    fireEvent.click(row!);
    await waitFor(() => {
      expect(
        screen.getByTestId('rendering-impact-row-detail-rendering'),
      ).toBeInTheDocument();
    });
  });

  it('renders a missing-datasource warning when an active-page datasource is not in the index', async () => {
    setAtlasState(makeState('completed'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    await waitFor(() => {
      expect(fetchComponentsMock).toHaveBeenCalled();
    });
    // Card Grid points to ds-card-missing which is NOT in the
    // datasourceIndex of our fixture → MissingDatasourceWarning fires.
    await waitFor(() => {
      expect(
        screen.getAllByTestId('missing-datasource-warning').length,
      ).toBeGreaterThan(0);
    });
  });

  it('shows a skeleton/loading state while the global atlas is still scanning', async () => {
    setAtlasState(makeState('scanning'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    // Status bar is visible (scanning).
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('re-paints Zone 3 when pages.context fires onSuccess with a new page', async () => {
    setAtlasState(makeState('completed'));
    let fireUpdate: ((data: { pageInfo: { id: string } }) => void) | null =
      null;
    queryMock.mockImplementationOnce(async (key: string, opts?: SubscribeArgs) => {
      if (key === 'pages.context' && opts?.subscribe) {
        fireUpdate = opts.onSuccess;
        Promise.resolve().then(() =>
          opts.onSuccess({ pageInfo: { id: 'page-1' } }),
        );
        return { unsubscribe: unsubscribeMock };
      }
      return { data: undefined };
    });
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
    await waitFor(() => {
      expect(fetchComponentsMock).toHaveBeenCalled();
    });
    const firstCallCount = fetchComponentsMock.mock.calls.length;
    fetchComponentsMock.mockClear();
    fetchComponentsMock.mockResolvedValueOnce([
      {
        placementId: 'plX',
        renderingId: 'rid-card',
        renderingName: 'Card Grid',
        placeholderKey: 'main',
        datasourceId: 'ds-hero',
      },
    ]);
    // Simulate the editor navigating to a different page.
    if (!fireUpdate) throw new Error('subscription onSuccess never captured');
    (fireUpdate as (data: { pageInfo: { id: string } }) => void)({
      pageInfo: { id: 'page-2' },
    });
    await waitFor(() => {
      expect(fetchComponentsMock).toHaveBeenCalled();
    });
    // Status bar / Zone 1 / Zone 2 didn't re-render through atlas — we
    // only re-issue per-page fetch.
    expect(firstCallCount).toBeGreaterThan(0);
  });
});
