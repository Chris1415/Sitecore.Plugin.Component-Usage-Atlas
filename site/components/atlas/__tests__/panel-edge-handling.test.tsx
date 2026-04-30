// T080 / T081 / T082 — Edge handling tests at the panel-surface seam.
//
// T080: "Direct bindings only" affordance is in DOM in all four primary
//       atlas states on the panel surface (idle, scanning, completed,
//       error).
// T082: Panel's UsageDrawer integration honors the forbidden-page list
//       — drawer rows for skipped/forbidden pages are aria-disabled and
//       do NOT mutate pages.context.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  __resetForTest,
  setAtlasState,
} from '@/core/atlas-store';
import { __resetActionsForTest } from '@/core/atlas-actions';
import { PanelSurface } from '@/components/atlas/panel-surface';
import type { Atlas, AtlasState } from '@/lib/sdk/types';

// --- mocks --------------------------------------------------------------

const triggerScanMock = vi.fn();

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
    cancelScan: () => undefined,
    refreshAtlas: () => ({ cancel: () => undefined, donePromise: Promise.resolve() }),
  };
});

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

const queryMock = vi.fn();
const mutateMock = vi.fn(() => Promise.resolve(undefined));
const unsubscribeMock = vi.fn();

const stubContextId = 'ctx-test';

function makeClient() {
  return {
    query: queryMock,
    mutate: mutateMock,
  } as unknown as Parameters<typeof PanelSurface>[0]['client'];
}

// --- fixtures -----------------------------------------------------------

function makeAtlas(): Atlas {
  const heroPages = [
    {
      pageId: 'p-active',
      pageName: 'Active Page',
      sitePath: '/active',
      siteId: 's1',
      siteName: 'acme',
    },
    {
      pageId: 'p-allowed',
      pageName: 'Allowed Page',
      sitePath: '/allowed',
      siteId: 's1',
      siteName: 'acme',
    },
    {
      pageId: 'p-forbidden',
      pageName: 'Forbidden Page',
      sitePath: '/forbidden',
      siteId: 's1',
      siteName: 'acme',
    },
  ];
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
          totalUsages: 3,
          datasources: ['ds-hero'],
          pages: heroPages,
        },
      ],
    ]),
    datasourceIndex: new Map(),
    skipped: [
      {
        pageId: 'p-forbidden',
        pageName: 'Forbidden Page',
        siteName: 'acme',
        reason: 'forbidden',
      },
    ],
    totals: {
      sites: 1,
      pages: 3,
      renderings: 1,
      datasources: 1,
      skipped: 1,
    },
  };
}

function makeState(kind: AtlasState['kind']): AtlasState {
  if (kind === 'idle') return { kind: 'idle' };
  if (kind === 'scanning') {
    return {
      kind: 'scanning',
      scope: { kind: 'all-collections' },
      progress: { phase: 'pages', current: 1, total: 3, elapsedMs: 1_000 },
    };
  }
  if (kind === 'completed') return { kind: 'completed', atlas: makeAtlas() };
  if (kind === 'canceled') return { kind: 'canceled', atlas: makeAtlas() };
  return { kind: 'error', reason: { kind: 'no-context' } };
}

// --- setup --------------------------------------------------------------

beforeEach(() => {
  __resetForTest();
  __resetActionsForTest();
  triggerScanMock.mockReset();
  fetchComponentsMock.mockReset();
  fetchComponentsMock.mockResolvedValue([
    {
      placementId: 'pl-1',
      renderingId: 'rid-hero',
      renderingName: 'Hero Banner',
      placeholderKey: 'main',
      datasourceId: 'ds-hero',
    },
  ]);
  queryMock.mockReset();
  mutateMock.mockReset();
  unsubscribeMock.mockReset();
  queryMock.mockImplementation(
    async (
      key: string,
      opts?: {
        subscribe?: boolean;
        onSuccess?: (data: { pageInfo?: { id?: string } }) => void;
      },
    ) => {
      if (key === 'pages.context' && opts?.subscribe && opts.onSuccess) {
        Promise.resolve().then(() =>
          opts.onSuccess?.({ pageInfo: { id: 'p-active' } }),
        );
        return { unsubscribe: unsubscribeMock };
      }
      return { data: undefined };
    },
  );
});

afterEach(() => cleanup());

// --- T080 — DirectBindingsAffordance always rendered --------------------

describe('T080 — DirectBindingsAffordance always rendered on panel', () => {
  for (const kind of ['idle', 'scanning', 'completed', 'error'] as const) {
    it(`renders the affordance in state.kind = ${kind}`, () => {
      setAtlasState(makeState(kind));
      render(<PanelSurface client={makeClient()} contextId={stubContextId} />);
      expect(
        screen.getByTestId('direct-bindings-affordance'),
      ).toBeInTheDocument();
    });
  }
});

// --- T082 — Forbidden-page click-through ---------------------------------

describe('T082 — forbidden page click-through prevented in panel drawer', () => {
  it('forbidden page rows render aria-disabled and do NOT call client.mutate', async () => {
    setAtlasState(makeState('completed'));
    render(<PanelSurface client={makeClient()} contextId={stubContextId} />);

    await waitFor(() => {
      expect(fetchComponentsMock).toHaveBeenCalled();
    });

    // S23 — clicking the rendering row expands the inline detail; the
    // drawer is opened from the "See all pages using this rendering"
    // affordance inside that detail panel.
    const heroRow = await waitFor(() => screen.getByText('Hero Banner'));
    fireEvent.click(heroRow.closest('[role="button"]') ?? heroRow);

    const seeAll = await waitFor(() =>
      screen.getByTestId('rendering-impact-row-detail-rendering'),
    );
    fireEvent.click(seeAll);

    // The drawer renders 3 page rows; the forbidden one carries
    // aria-disabled + reason chip.
    await waitFor(() => {
      expect(screen.getByText('Forbidden Page')).toBeInTheDocument();
    });

    const forbidden = screen
      .getByText('Forbidden Page')
      .closest('[role="button"]');
    expect(forbidden).not.toBeNull();
    expect(forbidden?.getAttribute('aria-disabled')).toBe('true');

    // Click forbidden — must NOT invoke client.mutate.
    fireEvent.click(forbidden!);
    expect(mutateMock).not.toHaveBeenCalled();

    // Click an allowed row — it MUST call client.mutate.
    const allowed = screen.getByText('Allowed Page').closest('[role="button"]');
    fireEvent.click(allowed!);
    expect(mutateMock).toHaveBeenCalled();
  });
});
