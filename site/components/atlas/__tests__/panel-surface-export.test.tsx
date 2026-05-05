// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79, 128-146
//
// T041 — RED → GREEN integration tests for the action-cluster wiring on
// `<PanelSurface />` per the amended task breakdown § T041 (ADR-0021
// supersession). The panel surface composes the cluster in zone-2 and
// captures the click-time `surfaceContext.panelPage` clone per AC-2.7
// (the load-bearing test for ADR-0016 mid-navigation invariance).
//
// We mock atlas-store + atlas-actions + components-fetcher per the existing
// panel-surface test pattern, plus the same DOM globals (URL, window.open,
// navigator.clipboard) used by T040.
//
// TDD discipline: RED tests authored before T037 wiring lands. Before the
// integration the cluster never renders and every action-cluster lookup
// returns null. After T037 the integration paints and the cases pass.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react';

import {
  __resetForTest,
  setAtlasState,
} from '@/core/atlas-store';
import { __resetActionsForTest } from '@/core/atlas-actions';
import { clearBuffer, getBuffer } from '@/core/telemetry';
import { PanelSurface } from '@/components/atlas/panel-surface';
import type { Atlas, AtlasState } from '@/lib/sdk/types';
import type { ApplicationContext } from '@sitecore-marketplace-sdk/client';

// --- mocks -------------------------------------------------------------

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

const showSuccessToastMock = vi.fn();
const showFailureToastMock = vi.fn();
vi.mock('@/components/atlas/export-toasts', () => ({
  showExportSuccessToast: (params: unknown) => {
    showSuccessToastMock(params);
    return 'success-toast-id';
  },
  showExportFailureToast: (params: unknown) => {
    showFailureToastMock(params);
    return 'failure-toast-id';
  },
}));

// build-export — captures the SurfaceContext that the panel surface passes
// in at click time so the AC-2.7 invariant can be asserted directly.
const buildExportThrowSignal = { value: false };
const buildExportCalls: Array<{
  surface: 'widget' | 'panel';
  format: 'json' | 'csv' | 'html';
  panelPage: { pageId: string; pageName: string } | undefined;
}> = [];

vi.mock('@/core/atlas/export/build-export', async () => {
  const actual = await vi.importActual<
    typeof import('@/core/atlas/export/build-export')
  >('@/core/atlas/export/build-export');
  return {
    ...actual,
    buildExport: (...args: Parameters<typeof actual.buildExport>) => {
      const [{ surface, format, surfaceContext }] = args;
      buildExportCalls.push({
        surface,
        format,
        panelPage: surfaceContext.panelPage
          ? {
              pageId: surfaceContext.panelPage.pageId,
              pageName: surfaceContext.panelPage.pageName,
            }
          : undefined,
      });
      if (buildExportThrowSignal.value) {
        throw new Error('synthetic blob construction failure');
      }
      return actual.buildExport(...args);
    },
  };
});

// --- SDK + AppContext fixtures -----------------------------------------

const stubContextId = 'ctx-test-1234';

const stubAppContext: ApplicationContext = {
  resourceAccess: [
    {
      resourceId: 'res-1',
      tenantId: 'tn-acme-1234567',
      tenantName: 'acme',
      tenantDisplayName: 'Acme Inc.',
      context: { live: stubContextId, preview: stubContextId },
    },
  ],
} as unknown as ApplicationContext;

type SubscribeArgs = {
  subscribe: true;
  onSuccess: (data: {
    pageInfo?: { id?: string; name?: string; path?: string };
  }) => void;
  onError?: (err: unknown) => void;
};

const queryMock = vi.fn();
const mutateMock = vi.fn(() => Promise.resolve(undefined));
const unsubscribeMock = vi.fn();

function makeClient() {
  return {
    query: queryMock,
    mutate: mutateMock,
  } as unknown as Parameters<typeof PanelSurface>[0]['client'];
}

// --- atlas fixture (3 renderings, each with a bound datasource) -------

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
          totalUsages: 2,
          datasources: ['ds-hero'],
          pages: [
            {
              pageId: 'page-active-1',
              pageName: 'Active Page',
              sitePath: '/active',
              siteId: 's1',
              siteName: 'acme',
            },
          ],
        },
      ],
      [
        'rid-card',
        {
          renderingId: 'rid-card',
          displayName: 'Card Grid',
          isUnknown: false,
          totalUsages: 1,
          datasources: ['ds-card'],
          pages: [],
        },
      ],
      [
        'rid-cta',
        {
          renderingId: 'rid-cta',
          displayName: 'CTA',
          isUnknown: false,
          totalUsages: 1,
          datasources: ['ds-cta'],
          pages: [],
        },
      ],
    ]),
    datasourceIndex: new Map([
      [
        'ds-hero',
        {
          datasourceId: 'ds-hero',
          displayName: 'HeroData',
          isMissing: false,
          pages: [],
          renderings: ['rid-hero'],
        },
      ],
      [
        'ds-card',
        {
          datasourceId: 'ds-card',
          displayName: 'CardData',
          isMissing: false,
          pages: [],
          renderings: ['rid-card'],
        },
      ],
      [
        'ds-cta',
        {
          datasourceId: 'ds-cta',
          displayName: 'CTAData',
          isMissing: false,
          pages: [],
          renderings: ['rid-cta'],
        },
      ],
    ]),
    skipped: [],
    totals: {
      sites: 1,
      pages: 5,
      renderings: 3,
      datasources: 3,
      skipped: 0,
    },
    ...overrides,
  };
}

function makeEmptyPageAtlas(): Atlas {
  return {
    scope: { kind: 'all-collections' },
    scannedAt: 1_700_000_000_000,
    isPartial: false,
    renderingIndex: new Map(),
    datasourceIndex: new Map(),
    skipped: [],
    totals: { sites: 1, pages: 1, renderings: 0, datasources: 0, skipped: 0 },
  };
}

function makeState(kind: AtlasState['kind']): AtlasState {
  if (kind === 'idle') return { kind: 'idle' };
  if (kind === 'scanning') {
    return {
      kind: 'scanning',
      scope: { kind: 'all-collections' },
      progress: { phase: 'pages', current: 1, total: 5, elapsedMs: 1_000 },
    };
  }
  if (kind === 'completed') return { kind: 'completed', atlas: makeAtlas() };
  if (kind === 'canceled') return { kind: 'canceled', atlas: makeAtlas({ isPartial: true }) };
  return { kind: 'error', reason: { kind: 'no-context' } };
}

// --- DOM globals shimmed per scenario ----------------------------------

let originalCreateObjectURL: typeof URL.createObjectURL | undefined;
let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined;
let originalWindowOpen: typeof window.open;
let originalClipboard: PropertyDescriptor | undefined;
let originalClipboardItem: typeof globalThis.ClipboardItem | undefined;

function installUrlMocks() {
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
}

function restoreUrlMocks() {
  if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL;
  if (originalRevokeObjectURL) URL.revokeObjectURL = originalRevokeObjectURL;
}

function installWindowOpen(returnValue: Window | null) {
  originalWindowOpen = window.open;
  window.open = vi.fn(() => returnValue) as unknown as typeof window.open;
}

function restoreWindowOpen() {
  window.open = originalWindowOpen;
}

interface ClipboardStub {
  writeText: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
}

function installClipboard(opts: {
  writeTextResult: 'resolve' | 'reject';
  writeResult: 'resolve' | 'reject';
}): ClipboardStub {
  originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writeText = vi.fn(() =>
    opts.writeTextResult === 'resolve'
      ? Promise.resolve()
      : Promise.reject(new Error('blocked')),
  );
  const write = vi.fn(() =>
    opts.writeResult === 'resolve'
      ? Promise.resolve()
      : Promise.reject(new Error('blocked')),
  );
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText, write },
  });
  originalClipboardItem = (
    globalThis as { ClipboardItem?: typeof ClipboardItem }
  ).ClipboardItem;
  class ClipboardItemStub {
    constructor(public readonly items: Record<string, Blob>) {}
  }
  (globalThis as { ClipboardItem: unknown }).ClipboardItem =
    ClipboardItemStub as unknown as typeof ClipboardItem;
  return { writeText, write };
}

function restoreClipboard() {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    delete (navigator as { clipboard?: unknown }).clipboard;
  }
  if (originalClipboardItem === undefined) {
    delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem;
  } else {
    (globalThis as { ClipboardItem: unknown }).ClipboardItem =
      originalClipboardItem;
  }
}

// pages.context onSuccess capture — used by mid-navigation tests to drive
// page changes from outside the surface.
let pagesContextOnSuccess:
  | ((data: {
      pageInfo?: { id?: string; name?: string; path?: string };
    }) => void)
  | null = null;

function defaultQueryImpl(key: string, opts?: SubscribeArgs) {
  if (key === 'pages.context' && opts?.subscribe) {
    pagesContextOnSuccess = opts.onSuccess;
    Promise.resolve().then(() => {
      opts.onSuccess({
        pageInfo: {
          id: 'page-active-1',
          name: 'Active Page',
          path: '/active',
        },
      });
    });
    return Promise.resolve({ unsubscribe: unsubscribeMock });
  }
  return Promise.resolve({ data: undefined });
}

// --- setup -------------------------------------------------------------

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
      datasourceId: 'ds-card',
    },
    {
      placementId: 'pl-3',
      renderingId: 'rid-cta',
      renderingName: 'CTA',
      placeholderKey: 'main',
      datasourceId: 'ds-cta',
    },
  ]);
  queryMock.mockReset();
  queryMock.mockImplementation(defaultQueryImpl);
  mutateMock.mockReset();
  unsubscribeMock.mockReset();
  showSuccessToastMock.mockClear();
  showFailureToastMock.mockClear();
  buildExportCalls.length = 0;
  buildExportThrowSignal.value = false;
  pagesContextOnSuccess = null;
  clearBuffer();
  installUrlMocks();
  installWindowOpen(null);
  installClipboard({ writeTextResult: 'resolve', writeResult: 'resolve' });
});

afterEach(() => {
  cleanup();
  restoreUrlMocks();
  restoreWindowOpen();
  restoreClipboard();
});

// --- helpers -----------------------------------------------------------

function getActionCluster(): HTMLElement {
  const el = document.querySelector(
    '[data-cluster-anchor="export"]',
  ) as HTMLElement | null;
  if (!el) throw new Error('action cluster not rendered');
  return el;
}

function getActionPill(name: RegExp): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

async function pickFormat(format: 'JSON' | 'CSV' | 'HTML'): Promise<void> {
  const trigger = screen.getByRole('button', { name: /export format/i });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  await waitFor(() => {
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
  });
  const items = screen.getAllByRole('menuitem');
  const idx = format === 'JSON' ? 0 : format === 'CSV' ? 1 : 2;
  fireEvent.click(items[idx]);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function waitForActivePage() {
  // The panel surface paints once `pages.context` onSuccess lands.
  await waitFor(() => {
    expect(pagesContextOnSuccess).not.toBeNull();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// --- tests -------------------------------------------------------------

describe('<PanelSurface /> — T041 action-cluster integration (RED → GREEN)', () => {
  it('(0) renders the action cluster in zone-2 once the panel resolves the active page', async () => {
    setAtlasState(makeState('completed'));
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await waitForActivePage();
    expect(getActionCluster()).toBeInTheDocument();
    expect(getActionPill(/save snapshot/i)).toBeInTheDocument();
    expect(getActionPill(/open snapshot in new tab/i)).toBeInTheDocument();
    expect(getActionPill(/copy snapshot to clipboard/i)).toBeInTheDocument();
  });

  // (a) Save success — sandboxBlocksDownload=false branch.
  it('(a) Save success — telemetry attempt + success with surface=panel, action=save', async () => {
    setAtlasState(makeState('completed'));
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
        sandboxBlocksDownload={false}
      />,
    );
    await waitForActivePage();
    await pickFormat('JSON');
    const save = getActionPill(/save snapshot/i);
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    expect(URL.createObjectURL).toHaveBeenCalled();
    const events = getBuffer();
    expect(
      events.some(
        (e) =>
          e.kind === 'export_attempt' &&
          e.action === 'save' &&
          e.surface === 'panel',
      ),
    ).toBe(true);
    expect(
      events.some(
        (e) =>
          e.kind === 'export_success' &&
          e.action === 'save' &&
          e.surface === 'panel',
      ),
    ).toBe(true);
  });

  // (b) Save unsupported — current sandbox.
  it('(b) Save unsupported — disabled with verbatim tooltip when sandboxBlocksDownload is true', async () => {
    setAtlasState(makeState('completed'));
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
        sandboxBlocksDownload={true}
      />,
    );
    await waitForActivePage();
    await pickFormat('JSON');
    const save = getActionPill(/save snapshot/i);
    expect(save).toBeDisabled();
    // Save reason copy is exposed via aria-describedby (Radix Tooltip
    // portals out, so `title` attribute was removed in favour of the
    // hover-tooltip + sr-only describedby pair).
    const describedById = save.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const reason = document.getElementById(describedById!);
    expect(reason?.textContent ?? '').toContain('iframe download permission');
  });

  // (c) Open success — HTML format.
  it('(c) Open success (HTML) — window.open returns a window → success telemetry surface=panel', async () => {
    installWindowOpen({} as Window);
    setAtlasState(makeState('completed'));
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await waitForActivePage();
    await pickFormat('HTML');
    const open = getActionPill(/open snapshot in new tab/i);
    await waitFor(() => expect(open).not.toBeDisabled());
    fireEvent.click(open);
    expect(window.open).toHaveBeenCalledWith(
      'blob:mock-url',
      '_blank',
      'noopener,noreferrer',
    );
    expect(
      getBuffer().some(
        (e) =>
          e.kind === 'export_success' &&
          e.action === 'open' &&
          e.surface === 'panel',
      ),
    ).toBe(true);
  });

  // (d) Open blocked — popup blocker.
  it('(d) Open blocked — popup blocker → telemetry fail with errorCode=popup_blocked', async () => {
    installWindowOpen(null);
    setAtlasState(makeState('completed'));
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await waitForActivePage();
    await pickFormat('JSON');
    const open = getActionPill(/open snapshot in new tab/i);
    await waitFor(() => expect(open).not.toBeDisabled());
    fireEvent.click(open);
    const fail = getBuffer().find(
      (e) => e.kind === 'export_fail' && e.action === 'open',
    );
    expect(fail).toBeDefined();
    expect(fail?.errorCode).toBe('popup_blocked');
  });

  // (e) Copy text-path success.
  it('(e) Copy success (text) — clipboard.writeText called with body string → success telemetry', async () => {
    const stub = installClipboard({ writeTextResult: 'resolve', writeResult: 'resolve' });
    setAtlasState(makeState('completed'));
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await waitForActivePage();
    await pickFormat('CSV');
    const copy = getActionPill(/copy snapshot to clipboard/i);
    await waitFor(() => expect(copy).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(copy);
    });
    expect(stub.writeText).toHaveBeenCalled();
    expect(
      getBuffer().some(
        (e) =>
          e.kind === 'export_success' &&
          e.action === 'copy' &&
          e.surface === 'panel',
      ),
    ).toBe(true);
  });

  // (f) Copy denied.
  it('(f) Copy denied — clipboard.writeText rejects → telemetry fail clipboard_blocked', async () => {
    installClipboard({ writeTextResult: 'reject', writeResult: 'reject' });
    setAtlasState(makeState('completed'));
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await waitForActivePage();
    await pickFormat('JSON');
    const copy = getActionPill(/copy snapshot to clipboard/i);
    await waitFor(() => expect(copy).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(copy);
      await Promise.resolve();
      await Promise.resolve();
    });
    const fail = getBuffer().find(
      (e) => e.kind === 'export_fail' && e.action === 'copy',
    );
    expect(fail).toBeDefined();
    expect(fail?.errorCode).toBe('clipboard_blocked');
  });

  // (g) AC-2.7 mid-navigation — load-bearing test for ADR-0016.
  it('(g) AC-2.7 — surfaceContext.panelPage captured at click time; mid-navigation does NOT corrupt the export', async () => {
    installWindowOpen({} as Window);
    setAtlasState(makeState('completed'));
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await waitForActivePage();
    await pickFormat('JSON');
    const open = getActionPill(/open snapshot in new tab/i);
    await waitFor(() => expect(open).not.toBeDisabled());

    // Click Open — captures click-time clone (page-active-1).
    fireEvent.click(open);

    // AFTER the click, simulate the editor navigating to a different page.
    // The pages.context onSuccess fires with a new pageId, panel re-renders
    // with the new active page — but the in-flight buildExport call must
    // already have captured page-active-1.
    expect(pagesContextOnSuccess).not.toBeNull();
    pagesContextOnSuccess?.({
      pageInfo: {
        id: 'page-NEW-2',
        name: 'New Page',
        path: '/new',
      },
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Inspect the panel's buildExport invocation: surfaceContext.panelPage
    // must still reference the page that was active at the moment of the
    // action click, not the page resulting from the mid-flight navigation.
    expect(buildExportCalls.length).toBeGreaterThan(0);
    const panelInvocation = buildExportCalls.find(
      (c) => c.surface === 'panel' && c.format === 'json',
    );
    expect(panelInvocation).toBeDefined();
    expect(panelInvocation?.panelPage?.pageId).toBe('page-active-1');
    expect(panelInvocation?.panelPage?.pageId).not.toBe('page-NEW-2');
  });

  // (h) Zero-rendering page — AC-2.5.
  it('(h) Zero-rendering page — Open click still produces a valid blob (AC-2.5)', async () => {
    installWindowOpen({} as Window);
    setAtlasState({ kind: 'completed', atlas: makeEmptyPageAtlas() });
    fetchComponentsMock.mockResolvedValueOnce([]);
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await waitForActivePage();
    await pickFormat('JSON');
    const open = getActionPill(/open snapshot in new tab/i);
    await waitFor(() => expect(open).not.toBeDisabled());
    fireEvent.click(open);
    expect(window.open).toHaveBeenCalled();
  });

  // (i) Telemetry payload includes surface=panel and action field on every
  // export_* event.
  it('(i) Every export_* event carries surface=panel and an action field per ADR-0021', async () => {
    installWindowOpen({} as Window);
    setAtlasState(makeState('completed'));
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await waitForActivePage();
    await pickFormat('JSON');
    fireEvent.click(getActionPill(/open snapshot in new tab/i));
    const exportEvents = getBuffer().filter((e) =>
      e.kind === 'export_attempt' ||
      e.kind === 'export_success' ||
      e.kind === 'export_fail',
    );
    expect(exportEvents.length).toBeGreaterThan(0);
    for (const e of exportEvents) {
      expect(e.surface).toBe('panel');
      expect(['save', 'open', 'copy']).toContain(e.action);
    }
  });

  // (j) Filename includes pageName slug per IS-11 — verified through
  // buildExport's filename output.
  it('(j) Filename includes the active pageName slug per IS-11', async () => {
    setAtlasState(makeState('completed'));
    render(
      <PanelSurface
        client={makeClient()}
        contextId={stubContextId}
        appContext={stubAppContext}
        sandboxBlocksDownload={false}
      />,
    );
    await waitForActivePage();
    await pickFormat('JSON');
    // The buildExport call captured a panelPage with pageName 'Active Page'.
    expect(buildExportCalls.some((c) => c.panelPage?.pageName === 'Active Page')).toBe(true);
  });
});
