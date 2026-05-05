// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79, 128-146
//
// T040 — RED → GREEN integration tests for the action-cluster wiring on
// `<WidgetSurface />` per the amended task breakdown § T040 (ADR-0021
// supersession). The widget surface composes:
//   - format picker → eager Blob/text construction on selection
//   - three action pills (Save / Open / Copy) wired to T052/T054/T056 hooks
//   - telemetry events with the `action` field (ADR-0021)
//   - cross-cutting failure toast for `blob_construction_failed` only
//
// We mock the atlas-store + atlas-actions per the existing widget-surface
// test pattern, plus `URL.createObjectURL`, `window.open`, and
// `navigator.clipboard` so we can drive per-action outcomes deterministically.
//
// TDD discipline: RED tests authored before T036 wiring lands. The expected
// failures before the integration: the format picker / action cluster never
// renders inside the widget surface, so all action-cluster lookups return
// null. After T036 the integration paints and the cases pass (GREEN).

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
import { WidgetSurface } from '@/components/atlas/widget-surface';
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

// Sonner toast — we mock the helpers to record calls without rendering the
// actual toast container in jsdom. Per ADR-0021 only the cross-cutting blob-
// construction failure path runs through these helpers.
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

// build-export — most tests use the real implementation, but case (i)
// (cross-cutting blob-construction failure) flips this to a throw.
const buildExportThrowSignal = { value: false };

vi.mock('@/core/atlas/export/build-export', async () => {
  const actual = await vi.importActual<
    typeof import('@/core/atlas/export/build-export')
  >('@/core/atlas/export/build-export');
  return {
    ...actual,
    buildExport: (...args: Parameters<typeof actual.buildExport>) => {
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

const mutateMock = vi.fn(() => Promise.resolve(undefined));
const stubClient = {
  query: vi.fn(),
  mutate: mutateMock,
} as unknown as Parameters<typeof WidgetSurface>[0]['client'];

// --- atlas fixture (1 site, 5 pages, 3 renderings, 2 datasources) -----

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
          totalUsages: 3,
          datasources: ['ds-1'],
          pages: [
            {
              pageId: 'p1',
              pageName: 'Home',
              sitePath: '/home',
              siteId: 's1',
              siteName: 'acme',
            },
            {
              pageId: 'p2',
              pageName: 'About',
              sitePath: '/about',
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
          totalUsages: 2,
          datasources: ['ds-2'],
          pages: [
            {
              pageId: 'p3',
              pageName: 'Cards',
              sitePath: '/cards',
              siteId: 's1',
              siteName: 'acme',
            },
          ],
        },
      ],
      [
        'rid-cta',
        {
          renderingId: 'rid-cta',
          displayName: 'CTA',
          isUnknown: false,
          totalUsages: 1,
          datasources: [],
          pages: [],
        },
      ],
    ]),
    datasourceIndex: new Map([
      [
        'ds-1',
        {
          datasourceId: 'ds-1',
          displayName: 'Hero Data',
          isMissing: false,
          pages: [],
          renderings: ['rid-hero'],
        },
      ],
      [
        'ds-2',
        {
          datasourceId: 'ds-2',
          displayName: 'Card Data',
          isMissing: false,
          pages: [],
          renderings: ['rid-card'],
        },
      ],
    ]),
    skipped: [],
    totals: {
      sites: 1,
      pages: 5,
      renderings: 3,
      datasources: 2,
      skipped: 0,
    },
    ...overrides,
  };
}

function makeEmptyAtlas(): Atlas {
  return {
    scope: { kind: 'all-collections' },
    scannedAt: 1_700_000_000_000,
    isPartial: false,
    renderingIndex: new Map(),
    datasourceIndex: new Map(),
    skipped: [],
    totals: { sites: 0, pages: 0, renderings: 0, datasources: 0, skipped: 0 },
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
  // ClipboardItem ctor needed for html mode in useCopyExport availability.
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

// --- setup -------------------------------------------------------------

beforeEach(() => {
  __resetForTest();
  __resetActionsForTest();
  triggerScanMock.mockClear();
  cancelScanMock.mockClear();
  refreshAtlasMock.mockClear();
  mutateMock.mockClear();
  showSuccessToastMock.mockClear();
  showFailureToastMock.mockClear();
  buildExportThrowSignal.value = false;
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
  if (!el) {
    throw new Error('action cluster not rendered');
  }
  return el;
}

function getActionPill(name: RegExp): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

async function pickFormat(format: 'JSON' | 'CSV' | 'HTML'): Promise<void> {
  const trigger = screen.getByRole('button', { name: /export format/i });
  // Radix DropdownMenu opens via Enter on the trigger in jsdom (pointer
  // events don't carry button codes reliably). Mirrors format-picker-menu
  // test's `openMenu` helper.
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  await waitFor(() => {
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
  });
  const items = screen.getAllByRole('menuitem');
  const idx = format === 'JSON' ? 0 : format === 'CSV' ? 1 : 2;
  fireEvent.click(items[idx]);
  // Allow the eager Blob construction + async Blob.text() to land.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// --- tests -------------------------------------------------------------

describe('<WidgetSurface /> — T040 action-cluster integration (RED → GREEN)', () => {
  it('(0) renders the action cluster in the FreshnessRibbon zone when atlas is completed', () => {
    setAtlasState(makeState('completed'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    expect(getActionCluster()).toBeInTheDocument();
    // Save / Open / Copy pills present (from T032).
    expect(getActionPill(/save snapshot/i)).toBeInTheDocument();
    expect(getActionPill(/open snapshot in new tab/i)).toBeInTheDocument();
    expect(getActionPill(/copy snapshot to clipboard/i)).toBeInTheDocument();
  });

  // (a) Save success requires sandboxBlocksDownload === false; current default
  // is true. Surface integration exposes a test override prop so we can drive
  // the unblocked branch without rewriting iframe detection.
  it('(a) Save success — when sandboxBlocksDownload is false, click triggers synthetic anchor + telemetry', async () => {
    setAtlasState(makeState('completed'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
        sandboxBlocksDownload={false}
      />,
    );
    await pickFormat('JSON');
    const save = getActionPill(/save snapshot/i);
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    // Synthetic <a download> created via createObjectURL.
    expect(URL.createObjectURL).toHaveBeenCalled();
    // Telemetry: attempt + success with action=save.
    const events = getBuffer();
    expect(events.some((e) => e.kind === 'export_attempt' && e.action === 'save')).toBe(true);
    expect(events.some((e) => e.kind === 'export_success' && e.action === 'save')).toBe(true);
  });

  // (b) Save unsupported in current sandbox: pill disabled, click no-ops, no
  // success telemetry.
  it('(b) Save unsupported — disabled when sandboxBlocksDownload is true; click no-ops', async () => {
    setAtlasState(makeState('completed'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
        sandboxBlocksDownload={true}
      />,
    );
    await pickFormat('JSON');
    const save = getActionPill(/save snapshot/i);
    expect(save).toBeDisabled();
    // Save reason copy is exposed via aria-describedby (T032 surfaces it
    // through a visually-hidden span; the on-hover Radix Tooltip portals
    // out so the `title` attribute itself was dropped — testing the
    // aria-describedby is the assistive-tech-equivalent assertion).
    const describedById = save.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const reason = document.getElementById(describedById!);
    expect(reason?.textContent ?? '').toContain('iframe download permission');
    fireEvent.click(save);
    expect(getBuffer().some((e) => e.kind === 'export_success')).toBe(false);
  });

  // (c) Open success: window.open returns non-null window.
  it('(c) Open success — pick CSV → click Open → window.open called → telemetry success/action=open', async () => {
    installWindowOpen({} as Window);
    setAtlasState(makeState('completed'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await pickFormat('CSV');
    const open = getActionPill(/open snapshot in new tab/i);
    await waitFor(() => expect(open).not.toBeDisabled());
    fireEvent.click(open);
    expect(window.open).toHaveBeenCalledWith(
      'blob:mock-url',
      '_blank',
      'noopener,noreferrer',
    );
    const events = getBuffer();
    expect(events.some((e) => e.kind === 'export_attempt' && e.action === 'open')).toBe(true);
    expect(events.some((e) => e.kind === 'export_success' && e.action === 'open')).toBe(true);
  });

  // (d) Open blocked: window.open returns null.
  it('(d) Open blocked — popup blocker returns null → telemetry fail with errorCode=popup_blocked', async () => {
    installWindowOpen(null);
    setAtlasState(makeState('completed'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await pickFormat('HTML');
    const open = getActionPill(/open snapshot in new tab/i);
    await waitFor(() => expect(open).not.toBeDisabled());
    fireEvent.click(open);
    const events = getBuffer();
    const fail = events.find(
      (e) => e.kind === 'export_fail' && e.action === 'open',
    );
    expect(fail).toBeDefined();
    expect(fail?.errorCode).toBe('popup_blocked');
  });

  // (e) Copy text-path success.
  it('(e) Copy success (text) — JSON → click Copy → clipboard.writeText called → telemetry success', async () => {
    const stub = installClipboard({ writeTextResult: 'resolve', writeResult: 'resolve' });
    setAtlasState(makeState('completed'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await pickFormat('JSON');
    const copy = getActionPill(/copy snapshot to clipboard/i);
    await waitFor(() => expect(copy).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(copy);
    });
    expect(stub.writeText).toHaveBeenCalled();
    const written = stub.writeText.mock.calls[0]?.[0];
    expect(typeof written).toBe('string');
    expect(JSON.parse(String(written))).toMatchObject({
      atlas_export_schema_version: 1,
      surface: 'widget',
    });
    const events = getBuffer();
    expect(
      events.some((e) => e.kind === 'export_success' && e.action === 'copy'),
    ).toBe(true);
  });

  // (f) Copy denied — writeText rejects → sticky 'denied' status.
  it('(f) Copy denied — clipboard.writeText rejects → telemetry fail with errorCode=clipboard_blocked', async () => {
    installClipboard({ writeTextResult: 'reject', writeResult: 'reject' });
    setAtlasState(makeState('completed'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await pickFormat('CSV');
    const copy = getActionPill(/copy snapshot to clipboard/i);
    await waitFor(() => expect(copy).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(copy);
      await Promise.resolve();
      await Promise.resolve();
    });
    const events = getBuffer();
    const fail = events.find(
      (e) => e.kind === 'export_fail' && e.action === 'copy',
    );
    expect(fail).toBeDefined();
    expect(fail?.errorCode).toBe('clipboard_blocked');
  });

  // (g) Format change resets statuses to 'idle' — verify by switching formats.
  it('(g) Format change re-enables pills (idle status) without lingering blocked/denied state', async () => {
    setAtlasState(makeState('completed'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await pickFormat('JSON');
    expect(getActionPill(/open snapshot in new tab/i)).not.toBeDisabled();
    await pickFormat('CSV');
    // After switching formats, pills are still interactive.
    expect(getActionPill(/open snapshot in new tab/i)).not.toBeDisabled();
  });

  // (h) Empty atlas — pills still functional.
  it('(h) Empty atlas — Open click still produces a valid blob URL (DoD-8 / IS-18)', async () => {
    installWindowOpen({} as Window);
    setAtlasState({ kind: 'completed', atlas: makeEmptyAtlas() });
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await pickFormat('JSON');
    const open = getActionPill(/open snapshot in new tab/i);
    await waitFor(() => expect(open).not.toBeDisabled());
    fireEvent.click(open);
    expect(window.open).toHaveBeenCalled();
  });

  // (i) Cross-cutting blob-construction failure → toast.
  it('(i) Blob construction failure → telemetry fail + cross-cutting failure toast', async () => {
    setAtlasState(makeState('completed'));
    buildExportThrowSignal.value = true;
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await pickFormat('JSON');
    // Failure surfaces synchronously during format-pick.
    const events = getBuffer();
    expect(
      events.some(
        (e) =>
          e.kind === 'export_fail' && e.errorCode === 'blob_construction_failed',
      ),
    ).toBe(true);
    expect(showFailureToastMock).toHaveBeenCalled();
  });

  // (j) Refresh-with-prior — surface keeps action cluster enabled and uses
  // the prior atlas at click time.
  it('(j) Refresh-with-prior — action cluster stays enabled during refresh; exports prior atlas', async () => {
    installWindowOpen({} as Window);
    setAtlasState({
      kind: 'scanning',
      scope: { kind: 'all-collections' },
      progress: { phase: 'pages', current: 1, total: 5, elapsedMs: 1_000 },
      priorAtlas: makeAtlas(),
    });
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await pickFormat('JSON');
    const open = getActionPill(/open snapshot in new tab/i);
    expect(open).not.toBeDisabled();
    fireEvent.click(open);
    expect(window.open).toHaveBeenCalled();
  });

  // (k) Telemetry payload has action field on every export_* event.
  it('(k) Every export_* event carries an action field per ADR-0021', async () => {
    installWindowOpen({} as Window);
    setAtlasState(makeState('completed'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    await pickFormat('JSON');
    fireEvent.click(getActionPill(/open snapshot in new tab/i));
    const exportEvents = getBuffer().filter((e) =>
      e.kind === 'export_attempt' ||
      e.kind === 'export_success' ||
      e.kind === 'export_fail',
    );
    expect(exportEvents.length).toBeGreaterThan(0);
    for (const e of exportEvents) {
      expect(['save', 'open', 'copy']).toContain(e.action);
    }
  });

  // (l) Disabled-no-data — when there is no completed atlas (idle / scanning
  // without prior), action pills are disabled.
  it('(l) Disabled state — when state is idle, all three pills are disabled', () => {
    setAtlasState(makeState('idle'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    expect(getActionPill(/save snapshot/i)).toBeDisabled();
    expect(getActionPill(/open snapshot in new tab/i)).toBeDisabled();
    expect(getActionPill(/copy snapshot to clipboard/i)).toBeDisabled();
  });

  // (m) The action cluster is positioned BEFORE the Refresh atlas button in
  // DOM order on the freshness ribbon (data-out before data-mutation per
  // UI § 4.8).
  it('(m) Action cluster precedes the Refresh atlas button in DOM order', () => {
    setAtlasState(makeState('completed'));
    render(
      <WidgetSurface
        client={stubClient}
        contextId={stubContextId}
        appContext={stubAppContext}
      />,
    );
    const cluster = getActionCluster();
    const refresh = screen.getByRole('button', { name: /refresh atlas/i });
    expect(
      cluster.compareDocumentPosition(refresh) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
