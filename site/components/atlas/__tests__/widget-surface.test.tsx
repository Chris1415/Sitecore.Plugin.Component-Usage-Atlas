// T040 / T043 / T060 / T061 / T062 / T064 — RED+GREEN inline UI tests
// for `<WidgetSurface />`. The surface composes:
//   - <ScanStatusBar />     when state.kind === 'scanning'
//   - Refresh button + summary  when state.kind === 'completed' / 'canceled'
//   - <CounterRail />       always (driven by atlas totals)
//   - <DirectBindingsAffordance /> always (Zone 2)
//   - <WidgetTable />       (search + click rows)
//   - <UsageDrawer />       opens on row click
//   - <SkippedDrawer />     opens from skipped link
//   - <DensityToggle />     compact ↔ comfortable
//
// We mock atlas-store + atlas-actions so tests can drive state. The
// SDK is mocked with a tiny client that records `mutate` calls (for the
// pages.context navigation contract).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  __resetForTest,
  setAtlasState,
  getAtlasSnapshot,
} from '@/core/atlas-store';
import {
  __resetActionsForTest,
} from '@/core/atlas-actions';
import { WidgetSurface } from '@/components/atlas/widget-surface';
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

const mutateMock = vi.fn(() => Promise.resolve(undefined));
const stubClient = {
  query: vi.fn(),
  mutate: mutateMock,
} as unknown as Parameters<typeof WidgetSurface>[0]['client'];

const stubContextId = 'ctx-test-1234';

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
          totalUsages: 124,
          datasources: ['ds-1'],
          pages: [
            {
              pageId: 'p1',
              pageName: 'Home',
              sitePath: '/home',
              siteId: 's1',
              siteName: 'acme',
            },
          ],
        },
      ],
    ]),
    datasourceIndex: new Map(),
    skipped: [],
    totals: {
      sites: 38,
      pages: 1247,
      renderings: 312,
      datasources: 847,
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
      progress: { phase: 'pages', current: 412, total: 1247, elapsedMs: 23_000 },
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
  triggerScanMock.mockClear();
  cancelScanMock.mockClear();
  refreshAtlasMock.mockClear();
  mutateMock.mockClear();
});

afterEach(() => {
  cleanup();
});

// --- T040 + T064 (re-mount-during-scan) -------------------------------

describe('<WidgetSurface /> — T040 mount + scan trigger', () => {
  it('on first mount with state idle, calls triggerScan with all-collections + client + contextId', () => {
    setAtlasState({ kind: 'idle' });
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    expect(triggerScanMock).toHaveBeenCalledTimes(1);
    expect(triggerScanMock).toHaveBeenCalledWith(
      { kind: 'all-collections' },
      stubClient,
      stubContextId,
    );
  });

  it('re-mount-during-scan does NOT trigger a duplicate scan when state is already scanning (T064)', () => {
    setAtlasState(makeState('scanning'));
    const { unmount } = render(
      <WidgetSurface client={stubClient} contextId={stubContextId} />,
    );
    expect(triggerScanMock).not.toHaveBeenCalled();
    unmount();
    // Second mount sees state still scanning — no fresh scan.
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    expect(triggerScanMock).not.toHaveBeenCalled();
  });

  it('re-mount-after-completed does NOT auto-restart a scan (state is `completed`)', () => {
    setAtlasState(makeState('completed'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    expect(triggerScanMock).not.toHaveBeenCalled();
  });
});

// --- T060 + T061 (status bar / freshness swap) -----------------------

describe('<WidgetSurface /> — T060/T061 zone-1 status bar swap', () => {
  it('renders <ScanStatusBar /> while scanning', () => {
    setAtlasState(makeState('scanning'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    expect(
      screen.getByRole('status', { name: /scan progress/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render <ScanStatusBar /> when completed; renders Refresh affordance instead', () => {
    setAtlasState(makeState('completed'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    expect(screen.queryByRole('status', { name: /scan progress/i })).toBeNull();
    expect(
      screen.getByRole('button', { name: /refresh atlas/i }),
    ).toBeInTheDocument();
  });
});

// --- T062 — cancel-with-act flow -------------------------------------

describe('<WidgetSurface /> — T062 cancel-with-act', () => {
  it('clicking Cancel during scanning calls cancelScan()', () => {
    setAtlasState(makeState('scanning'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel scan/i }));
    expect(cancelScanMock).toHaveBeenCalledTimes(1);
  });

  it('after cancel-with-act (state=canceled), partial atlas table renders + Refresh button is visible', () => {
    setAtlasState(makeState('canceled'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    // Partial table renders the rendering name from the partial atlas.
    expect(screen.getByText('Hero Banner')).toBeInTheDocument();
    // Refresh button is visible to re-scan.
    expect(
      screen.getByRole('button', { name: /refresh atlas/i }),
    ).toBeInTheDocument();
  });
});

// --- T043 — refresh atlas ---------------------------------------------

describe('<WidgetSurface /> — T043 refresh atlas', () => {
  it('clicking Refresh calls refreshAtlas with client+contextId', () => {
    setAtlasState(makeState('completed'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh atlas/i }));
    expect(refreshAtlasMock).toHaveBeenCalledWith(stubClient, stubContextId);
  });
});

// --- T040 + T042 + T046 — drawer click-through -----------------------

describe('<WidgetSurface /> — drawer click-through', () => {
  it('clicking a table row opens the drawer for that rendering', () => {
    setAtlasState(makeState('completed'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    // Click the row.
    fireEvent.click(screen.getByText('Hero Banner'));
    // The drawer body now lists the rendering's pages.
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('clicking a page row in the drawer calls client.mutate("pages.context", { params: { itemId } })', async () => {
    setAtlasState(makeState('completed'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    fireEvent.click(screen.getByText('Hero Banner'));
    fireEvent.click(screen.getByText('Home'));
    expect(mutateMock).toHaveBeenCalledWith('pages.context', {
      params: { itemId: 'p1' },
    });
  });
});

// --- T047 — skipped sub-drawer ----------------------------------------

describe('<WidgetSurface /> — T047 skipped sub-drawer', () => {
  it('renders a Skipped link when atlas has skipped pages and opens the sub-drawer on click', () => {
    setAtlasState({
      kind: 'completed',
      atlas: makeAtlas({
        skipped: [
          {
            pageId: 'sp1',
            pageName: 'Restricted',
            reason: 'forbidden',
          },
        ],
        totals: {
          sites: 1,
          pages: 1,
          renderings: 1,
          datasources: 0,
          skipped: 1,
        },
      }),
    });
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    // Skipped link shows the count.
    const link = screen.getByRole('button', { name: /1 page skipped — view/i });
    fireEvent.click(link);
    // The sub-drawer is now open.
    expect(screen.getByText(/forbidden \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Restricted')).toBeInTheDocument();
  });

  it('does NOT render the Skipped link when no pages were skipped', () => {
    setAtlasState(makeState('completed'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    expect(screen.queryByText(/page.*skipped — view/i)).toBeNull();
  });
});

// --- T065 — density toggle wiring -------------------------------------

describe('<WidgetSurface /> — T065 density toggle', () => {
  it('renders a density toggle that flips internal state on click', () => {
    setAtlasState(makeState('completed'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    expect(screen.getByRole('radio', { name: /compact/i })).toHaveAttribute(
      'data-state',
      'on',
    );
    fireEvent.click(screen.getByRole('radio', { name: /comfortable/i }));
    expect(screen.getByRole('radio', { name: /comfortable/i })).toHaveAttribute(
      'data-state',
      'on',
    );
  });
});

// --- T040 — DirectBindingsAffordance always visible ------------------

describe('<WidgetSurface /> — T040 always-visible affordances', () => {
  it('mounts the DirectBindingsAffordance in Zone 2 in every state', () => {
    setAtlasState(makeState('idle'));
    const { unmount } = render(
      <WidgetSurface client={stubClient} contextId={stubContextId} />,
    );
    expect(
      screen.getByTestId('direct-bindings-affordance'),
    ).toBeInTheDocument();
    unmount();
    setAtlasState(makeState('scanning'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    expect(
      screen.getByTestId('direct-bindings-affordance'),
    ).toBeInTheDocument();
  });
});

// --- T060 ETA computation ---------------------------------------------

describe('<WidgetSurface /> — T063 ETA readout', () => {
  it('the status bar readout reflects scanning progress current/total/elapsed', () => {
    setAtlasState(makeState('scanning'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    // The ScanStatusBar prints `Pages 412 / 1,247 · 00:23` (formatter).
    const bar = screen.getByRole('status', { name: /scan progress/i });
    expect(bar.textContent).toMatch(/Pages/);
    expect(bar.textContent).toMatch(/412/);
    expect(bar.textContent).toMatch(/1,247/);
    expect(bar.textContent).toMatch(/00:23/);
  });
});

// Sanity helper — referenced from CounterRail to ensure totals map correctly
describe('<WidgetSurface /> — totals wired from atlas', () => {
  it('CounterRail values reflect atlas totals on completed', () => {
    setAtlasState(makeState('completed'));
    render(<WidgetSurface client={stubClient} contextId={stubContextId} />);
    // 312 / 847 / 1,247 / 0 from the fixture totals.
    expect(screen.getByText('312')).toBeInTheDocument();
    expect(screen.getByText('847')).toBeInTheDocument();
    expect(screen.getByText('1,247')).toBeInTheDocument();
    // skipped count of 0 renders zero-state (em-dash via CounterRow).
    expect(getAtlasSnapshot().kind).toBe('completed');
  });
});
