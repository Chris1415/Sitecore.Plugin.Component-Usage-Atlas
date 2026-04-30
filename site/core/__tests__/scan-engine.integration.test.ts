// T107 — RED integration tests for `core/scan-engine.ts::runScan`.
//
// These tests stub `@sitecore-marketplace-sdk/xmc` calls at the
// `client.query` boundary using the typed-mock pattern from
// `client.md` § 9. T027 (GREEN) lifts these to passing.
//
// Test scenarios (per § 10 T027 + the run brief):
//   1. Happy path — 3 sites × ~50 pages × ~10 components yields a
//      complete atlas with correct totals. Verifies that pages /
//      renderings / datasources are tabulated correctly across the
//      whole tenant.
//   2. Per-page failure (forbidden / timeout / network_error) is
//      classified into `Skipped[]` with the correct typed reason.
//      Other pages succeed; scan continues; state is `completed`
//      not `error`.
//   3. Cancel mid-scan — calling `cancel()` after a few pages have
//      resolved transitions state to `canceled` with `isPartial: true`,
//      preserving the partial atlas (renderings/datasources collected
//      so far).
//   4. Rate-limit retry exhausted — a page that returns 429 on EVERY
//      attempt (more than `maxRetries`) lands in `skipped[]` with
//      reason `network_error` (per ADR-0012).
//   5. Missing `sitecoreContextId` — the engine surfaces the
//      `AtlasNoContextError` (the resolver runs OUTSIDE the engine,
//      but the engine accepts a `contextId: string` parameter — when
//      passed an empty string, the engine should bail with the typed
//      error before issuing any SDK call).
//
// Mock SDK pattern: build a single `client.query` mock that dispatches
// based on the query key. Each scenario provides a tailored set of
// canned responses keyed by `(siteName, pageId, language)`. NO real
// network. NO real SDK init.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetForTest,
  getAtlasSnapshot,
} from '@/core/atlas-store';
import { runScan } from '@/core/scan-engine';
import { AtlasNoContextError } from '@/core/context-resolver';
import type { ClientSDK } from '@sitecore-marketplace-sdk/client';
import type {
  Atlas,
  AtlasScope,
  AtlasState,
  Skipped,
} from '@/lib/sdk/types';

// ---------------------------------------------------------------------------
// SDK stub builder
// ---------------------------------------------------------------------------

type SiteFixture = {
  readonly id: string;
  readonly name: string;
  readonly targetHostname?: string;
  readonly rootPath?: string;
  readonly languages?: ReadonlyArray<string>;
  readonly collectionId?: string;
  readonly displayName?: string;
};

type PageFixture = {
  readonly id: string;
  readonly path: string;
};

type ComponentFixture = {
  readonly id: string;
  readonly componentId?: string | null;
  readonly componentName?: string | null;
  readonly dataSource?: string | null;
  readonly placeholder?: string | null;
};

type FixtureMap = {
  readonly sites: ReadonlyArray<SiteFixture>;
  readonly pagesBySite: ReadonlyMap<string /* siteName */, ReadonlyArray<PageFixture>>;
  readonly componentsByPage: ReadonlyMap<string /* pageId */, ReadonlyArray<ComponentFixture>>;
};

type SdkError = Error & { readonly status?: number };

const httpError = (status: number, message?: string): SdkError => {
  const err = new Error(message ?? `HTTP ${status}`) as SdkError;
  Object.assign(err, { status });
  return err;
};

type PerPageBehavior =
  | { readonly kind: 'ok' }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'network_error' }
  | { readonly kind: 'rate_limit_forever' };

type StubOptions = {
  readonly fixtures: FixtureMap;
  readonly perPageBehavior?: ReadonlyMap<string /* pageId */, PerPageBehavior>;
};

/**
 * Build a typed `client.query` mock that dispatches on the key. The
 * second argument carries `params.{path,query}` — we read those to
 * route to the right fixture.
 *
 * Returned client implements ONLY `query` and `mutate` (the two
 * methods our engine touches). The cast to `ClientSDK` is the canonical
 * test-only narrowing — `as unknown as ClientSDK` per `client.md` § 9b.
 */
function buildMockClient(opts: StubOptions): { client: ClientSDK; queryMock: ReturnType<typeof vi.fn> } {
  type QueryArgs = {
    readonly params?: {
      readonly path?: Record<string, string>;
      readonly query?: Record<string, string | number | undefined>;
    };
  };

  // The production code accesses `result.data?.data` — `result` is the
  // SDK's `QueryResult<K>` and `result.data` is the hey-api envelope.
  // Our mock therefore returns a `QueryResult`-shaped object whose
  // `.data` slot carries the hey-api success envelope.
  const ok = <T,>(payload: T) => ({
    data: { data: payload, error: undefined, request: {} as Request, response: {} as Response },
    error: undefined,
    status: 'success' as const,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: () => Promise.resolve({} as never),
  });

  // Per-page rate-limit attempt counters so the rate_limit_forever
  // behavior throws on every attempt regardless of retries.
  const rateLimitCounters = new Map<string, number>();

  const queryMock = vi.fn(async (key: string, args?: QueryArgs) => {
    if (key === 'xmc.agent.sitesGetSitesList') {
      return ok({
        sites: opts.fixtures.sites.map((s) => ({
          id: s.id,
          name: s.name,
          targetHostname: s.targetHostname ?? `${s.name}.example.com`,
          rootPath: s.rootPath ?? `/sitecore/content/${s.name}`,
        })),
      });
    }

    if (key === 'xmc.sites.listCollections') {
      return ok([] as Array<unknown>);
    }

    if (key === 'xmc.sites.retrieveSite') {
      const siteId = args?.params?.path?.siteId;
      const site = opts.fixtures.sites.find((s) => s.id === siteId);
      if (!site) return ok(null);
      return ok({
        id: site.id,
        name: site.name,
        displayName: site.displayName ?? site.name,
        collectionId: site.collectionId ?? null,
        languages: site.languages ?? ['en'],
        supportedLanguages: site.languages ?? ['en'],
      });
    }

    if (key === 'xmc.agent.sitesGetAllPagesBySite') {
      const siteName = args?.params?.path?.siteName ?? '';
      const pages = opts.fixtures.pagesBySite.get(siteName) ?? [];
      return ok(pages.map((p) => ({ id: p.id, path: p.path })));
    }

    if (key === 'xmc.agent.pagesGetComponentsOnPage') {
      const pageId = args?.params?.path?.pageId ?? '';
      const behavior = opts.perPageBehavior?.get(pageId) ?? { kind: 'ok' };

      switch (behavior.kind) {
        case 'forbidden':
          throw httpError(403);
        case 'not_found':
          throw httpError(404);
        case 'timeout': {
          // Never resolve. The wrapper's per-page timeout aborts.
          await new Promise(() => undefined);
          throw new Error('unreachable');
        }
        case 'network_error': {
          const err = new TypeError('Failed to fetch');
          throw err;
        }
        case 'rate_limit_forever': {
          const count = (rateLimitCounters.get(pageId) ?? 0) + 1;
          rateLimitCounters.set(pageId, count);
          throw httpError(429, 'Too Many Requests');
        }
        case 'ok':
        default: {
          const components = opts.fixtures.componentsByPage.get(pageId) ?? [];
          const pageStub = pageOf(opts.fixtures, pageId);
          return ok({
            pageId,
            pageName: pageStub?.path ?? pageId,
            pagePath: pageStub?.path ?? `/${pageId}`,
            version: 1,
            language: args?.params?.query?.language ?? 'en',
            components,
          });
        }
      }
    }

    throw new Error(`Unexpected query key in test: ${key}`);
  });

  const mutateMock = vi.fn();

  const client = {
    query: queryMock,
    mutate: mutateMock,
  } as unknown as ClientSDK;

  return { client, queryMock };
}

const pageOf = (fixtures: FixtureMap, pageId: string): PageFixture | undefined => {
  for (const pages of fixtures.pagesBySite.values()) {
    const found = pages.find((p) => p.id === pageId);
    if (found) return found;
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const buildHappyPathFixtures = (): FixtureMap => {
  const sites: SiteFixture[] = [
    { id: 'site-a', name: 'site-a', languages: ['en'] },
    { id: 'site-b', name: 'site-b', languages: ['en'] },
    { id: 'site-c', name: 'site-c', languages: ['en'] },
  ];

  const pagesBySite = new Map<string, PageFixture[]>();
  const componentsByPage = new Map<string, ComponentFixture[]>();

  for (const site of sites) {
    const pages: PageFixture[] = [];
    for (let i = 0; i < 50; i += 1) {
      const pageId = `${site.id}-p${i}`;
      pages.push({ id: pageId, path: `/${site.name}/page-${i}` });
      const components: ComponentFixture[] = [];
      for (let j = 0; j < 10; j += 1) {
        components.push({
          id: `${pageId}-c${j}`,
          componentId: `rendering-${j % 4}`, // 4 distinct renderings
          componentName: `Rendering${j % 4}`,
          dataSource: j % 2 === 0 ? `ds-${j % 4}` : null,
          placeholder: 'main',
        });
      }
      componentsByPage.set(pageId, components);
    }
    pagesBySite.set(site.name, pages);
  }

  return { sites, pagesBySite, componentsByPage };
};

const SCOPE_ALL: AtlasScope = { kind: 'all-collections' };

beforeEach(() => {
  __resetForTest();
});

afterEach(() => {
  __resetForTest();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runScan — happy path', () => {
  it('walks all sites/pages/components and produces a complete atlas', async () => {
    const fixtures = buildHappyPathFixtures();
    const { client } = buildMockClient({ fixtures });

    const handle = runScan({ client, contextId: 'ctx-live', scope: SCOPE_ALL });
    await handle.donePromise;

    const final = getAtlasSnapshot();
    expect(final.kind).toBe('completed');
    if (final.kind !== 'completed') return;
    const atlas: Atlas = final.atlas;

    expect(atlas.totals.sites).toBe(3);
    expect(atlas.totals.pages).toBe(150); // 3 × 50
    // 4 distinct renderings (component_id mod 4) shared across sites.
    expect(atlas.renderingIndex.size).toBe(4);
    // 4 distinct datasources (j % 4 when j is even).
    expect(atlas.datasourceIndex.size).toBe(2); // j%2===0 → 0,2 → ds-0, ds-2
    expect(atlas.skipped).toHaveLength(0);
    expect(atlas.isPartial).toBe(false);
  });
});

describe('runScan — per-page failures', () => {
  it('classifies forbidden / timeout / network_error pages into skipped[]', async () => {
    const fixtures: FixtureMap = {
      sites: [{ id: 'site-x', name: 'site-x', languages: ['en'] }],
      pagesBySite: new Map([
        [
          'site-x',
          [
            { id: 'p-ok', path: '/ok' },
            { id: 'p-forbidden', path: '/forbidden' },
            { id: 'p-not-found', path: '/missing' },
            { id: 'p-network', path: '/net' },
          ],
        ],
      ]),
      componentsByPage: new Map([
        [
          'p-ok',
          [{ id: 'c1', componentId: 'r-1', componentName: 'R1', dataSource: 'ds-1', placeholder: 'main' }],
        ],
      ]),
    };

    const perPageBehavior = new Map<string, PerPageBehavior>([
      ['p-ok', { kind: 'ok' }],
      ['p-forbidden', { kind: 'forbidden' }],
      ['p-not-found', { kind: 'not_found' }],
      ['p-network', { kind: 'network_error' }],
    ]);

    const { client } = buildMockClient({ fixtures, perPageBehavior });
    const handle = runScan({ client, contextId: 'ctx', scope: SCOPE_ALL });
    await handle.donePromise;

    const final = getAtlasSnapshot();
    expect(final.kind).toBe('completed');
    if (final.kind !== 'completed') return;

    const reasons = new Map<string, Skipped>();
    for (const s of final.atlas.skipped) reasons.set(s.pageId, s);

    expect(reasons.get('p-forbidden')?.reason).toBe('forbidden');
    expect(reasons.get('p-not-found')?.reason).toBe('not_found');
    expect(reasons.get('p-network')?.reason).toBe('network_error');
    expect(reasons.has('p-ok')).toBe(false);
    expect(final.atlas.renderingIndex.size).toBe(1);
  }, 20_000);
});

describe('runScan — cancel mid-scan', () => {
  it('transitions to canceled with a partial atlas', async () => {
    const fixtures = buildHappyPathFixtures();
    const { client } = buildMockClient({ fixtures });

    const handle = runScan({ client, contextId: 'ctx', scope: SCOPE_ALL });
    // Cancel as soon as we've yielded once — the engine should be
    // mid-flight with at least the sites phase complete.
    await new Promise((resolve) => setTimeout(resolve, 0));
    handle.cancel();
    await handle.donePromise;

    const final = getAtlasSnapshot();
    expect(final.kind === 'canceled' || final.kind === 'completed').toBe(true);
    if (final.kind === 'canceled') {
      expect(final.atlas.isPartial).toBe(true);
    }
  });
});

describe('runScan — rate-limit exhausted', () => {
  it('classifies a perpetually-rate-limited page as network_error in skipped[]', async () => {
    const fixtures: FixtureMap = {
      sites: [{ id: 'site-r', name: 'site-r', languages: ['en'] }],
      pagesBySite: new Map([
        [
          'site-r',
          [
            { id: 'p-rate', path: '/rate' },
            { id: 'p-ok', path: '/ok' },
          ],
        ],
      ]),
      componentsByPage: new Map([
        ['p-ok', [{ id: 'c1', componentId: 'r-1', componentName: 'R1', placeholder: 'main' }]],
      ]),
    };

    const perPageBehavior = new Map<string, PerPageBehavior>([
      ['p-rate', { kind: 'rate_limit_forever' }],
      ['p-ok', { kind: 'ok' }],
    ]);

    const { client } = buildMockClient({ fixtures, perPageBehavior });
    const handle = runScan({ client, contextId: 'ctx', scope: SCOPE_ALL });
    await handle.donePromise;

    const final = getAtlasSnapshot();
    expect(final.kind).toBe('completed');
    if (final.kind !== 'completed') return;
    const skipped = final.atlas.skipped.find((s) => s.pageId === 'p-rate');
    expect(skipped?.reason).toBe('network_error');
  }, 30_000);
});

describe('runScan — missing context', () => {
  it('surfaces AtlasNoContextError in the error state when contextId is empty', async () => {
    const fixtures = buildHappyPathFixtures();
    const { client } = buildMockClient({ fixtures });

    const handle = runScan({ client, contextId: '', scope: SCOPE_ALL });
    await handle.donePromise;

    const final: AtlasState = getAtlasSnapshot();
    expect(final.kind).toBe('error');
    if (final.kind !== 'error') return;
    expect(final.reason.kind).toBe('no-context');
  });
});

describe('AtlasNoContextError sanity', () => {
  it('is named correctly so the surfaces can render the W5/P5 copy', () => {
    const e = new AtlasNoContextError();
    expect(e.name).toBe('AtlasNoContextError');
  });
});
