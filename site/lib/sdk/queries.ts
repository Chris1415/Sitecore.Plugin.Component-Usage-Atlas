// THE SDK boundary. Every function takes an already-narrowed `contextId:
// string` (never `string | undefined`) and returns a normalised Atlas-shape
// value, so `core/` and `components/` never touch a raw SDK type.
//
// ⚠ DOUBLE unwrap: `QueryResult.data` is itself a hey-api envelope, so the
// payload is at `result.data?.data`. `unwrapOk` below peels both once and
// discriminates on `error`, which keeps `as` casts off this boundary.
//
// Per rule 40, every call cites the `.d.ts` it targets at the call site.
// Verified response shapes and the lean-vs-rich endpoint split:
// docs/build-decisions.md#double-unwrap.
//
// Errors propagate to the caller; fetches are wrapped in `withBackoff` and
// raced against PER_PAGE_TIMEOUT_MS.

import type { ClientSDK } from '@sitecore-marketplace-sdk/client';

import { PER_PAGE_TIMEOUT_MS, withBackoff, type ScanSurface } from '@/core/scan-config';
import type {
  Collection,
  ComponentRecord,
  PageStub,
  SiteDetails,
  SiteSummary,
} from '@/lib/sdk/types';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/**
 * `withBackoff` retries on rate-limit only. The SDK surfaces 429s either
 * as an Error with `status === 429` or as a hey-api envelope with
 * `response.status === 429`. We accept either shape.
 */
const isRateLimit = (err: unknown): boolean => {
  if (typeof err !== 'object' || err === null) return false;
  const direct = (err as { readonly status?: unknown }).status;
  if (direct === 429) return true;
  const nested = (err as { readonly response?: { readonly status?: unknown } }).response?.status;
  return nested === 429;
};

/**
 * Race a promise against a per-page timeout. After `ms`, reject with an
 * `AbortError`-named DOMException so the error classifier maps the
 * failure to `'timeout'`.
 *
 * `signal` allows caller-side cancel to short-circuit the timer.
 */
const withTimeout = <T,>(p: Promise<T>, ms: number, signal: AbortSignal): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new DOMException('aborted', 'AbortError'));
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new DOMException('aborted', 'AbortError'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        cleanup();
        resolve(v);
      },
      (e: unknown) => {
        cleanup();
        reject(e as Error);
      },
    );
  });

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new DOMException('aborted', 'AbortError');
  }
};

/**
 * Hey-api `RequestResult` shape. Source:
 *   `node_modules/@hey-api/client-fetch/src/types.ts:61` (RequestResult)
 *
 *   ThrowOnError === true:
 *     { data: T; request: Request; response: Response }
 *
 *   ThrowOnError === false:
 *     ({ data: T; error: undefined } | { data: undefined; error: E })
 *       & { request: Request; response: Response }
 *
 * Both branches expose `data` — when `error` is missing or `undefined`
 * we treat it as success. Returns the payload (`T`) on success, or
 * `undefined` if the call surfaced an error envelope (callers decide
 * what to do with undefined).
 */
type HeyApiSuccess<T> = { readonly data: T };
type HeyApiFailure = { readonly data: undefined; readonly error: unknown };

const unwrapOk = <T,>(envelope: HeyApiSuccess<T> | HeyApiFailure | undefined | null): T | undefined => {
  if (envelope == null) return undefined;
  // Failure branches set `error` to something non-undefined and `data`
  // to undefined. Success branches set `data` to the payload.
  const errorSlot = (envelope as HeyApiFailure).error;
  if (errorSlot !== undefined) return undefined;
  return (envelope as HeyApiSuccess<T>).data;
};

// ---------------------------------------------------------------------------
// 1. Sites list — agent endpoint (lean shape)
// ---------------------------------------------------------------------------

/**
 * Lists all sites visible to the current `sitecoreContextId`.
 *
 * SDK shape: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-agent/types.gen.d.ts`
 *   - `ListSitesResponse = { sites: Array<SiteBasicModel> }`
 *   - `SiteBasicModel = { id, name, targetHostname, rootPath }`
 *
 * Note (per M2 OQ-A1 friction-log entry T005): the agent endpoint is
 * LEAN — no `displayName`, no `collectionId`, no `languages`. Callers
 * needing those fields must follow up with `queryRetrieveSite`.
 */
export async function queryAllSites(
  client: ClientSDK,
  contextId: string,
): Promise<ReadonlyArray<SiteSummary>> {
  const result = await client.query('xmc.agent.sitesGetSitesList', {
    params: { query: { sitecoreContextId: contextId } },
  });

  // Double-unwrap per `client.md` § 8b: `result.data` is the hey-api
  // envelope; the actual `ListSitesResponse = { sites: SiteBasicModel[] }`
  // payload is at `.data` inside that envelope.
  const payload = unwrapOk(result.data);
  const sites = payload?.sites ?? [];

  return sites.map(
    (s): SiteSummary => ({
      siteId: s.id,
      siteName: s.name,
      targetHostname: s.targetHostname,
      rootPath: s.rootPath,
    }),
  );
}

// ---------------------------------------------------------------------------
// 2. List collections — sites module
// ---------------------------------------------------------------------------

/**
 * Lists site collections in the environment.
 *
 * SDK shape: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-sites/types.gen.d.ts`
 *   - `ListCollectionsResponses[200] = Array<SiteCollection>`
 *   - `SiteCollection = { id?, name?, displayName?, ... }`
 */
export async function queryListCollections(
  client: ClientSDK,
  contextId: string,
): Promise<ReadonlyArray<Collection>> {
  const result = await client.query('xmc.sites.listCollections', {
    params: { query: { sitecoreContextId: contextId } },
  });

  // Double-unwrap: `result.data` is hey-api envelope; the
  // `Array<SiteCollection>` payload is at `.data` inside. All
  // SiteCollection fields are optional — synthesize sane defaults for
  // missing ids/names so the rest of the engine never has to special-case
  // them.
  const raw = unwrapOk(result.data) ?? [];
  const out: Collection[] = [];
  for (const c of raw) {
    if (typeof c.id !== 'string' || c.id.length === 0) continue;
    out.push({
      collectionId: c.id,
      name: c.name ?? c.id,
      displayName: c.displayName ?? c.name ?? c.id,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Retrieve site — sites module (rich shape, used for language resolution)
// ---------------------------------------------------------------------------

/**
 * Retrieves the rich `Site` shape for a given site ID. Used by
 * `core/site-language-resolver.ts` (T021) to derive the per-site default
 * language for the page-list query.
 *
 * SDK shape: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-sites/types.gen.d.ts`
 *   - `RetrieveSiteResponses[200] = Site`
 *   - `Site = { id?, name?, displayName?, collectionId?, languages?: Array<string> | null, ... }`
 *
 * Throws if the SDK response is empty (the engine treats this as a
 * site-level fault and skips the site without aborting the scan).
 */
export async function queryRetrieveSite(
  client: ClientSDK,
  contextId: string,
  siteId: string,
): Promise<SiteDetails> {
  const result = await client.query('xmc.sites.retrieveSite', {
    params: {
      path: { siteId },
      query: { sitecoreContextId: contextId },
    },
  });

  // Double-unwrap: hey-api envelope → `Site` payload.
  const site = unwrapOk(result.data);
  if (!site || typeof site.id !== 'string' || site.id.length === 0) {
    throw new Error(`retrieveSite returned empty for ${siteId}`);
  }

  return {
    siteId: site.id,
    siteName: site.name ?? site.id,
    displayName: site.displayName ?? undefined,
    collectionId: site.collectionId ?? undefined,
    languages: Array.isArray(site.languages) ? Array.from(site.languages) : [],
  };
}

// ---------------------------------------------------------------------------
// 4. All pages by site — agent endpoint (FLAT list per M2 OQ-A2)
// ---------------------------------------------------------------------------

/**
 * Returns every page (route) under the given site for the given
 * language. Per OQ-A2 (M2 friction log T005), the SDK returns a FLAT
 * `Array<PageModel>` with NO pagination — there is no continuation
 * token, no `next` cursor. The previous prose in § 4c-6.5 hinting at a
 * pagination loop is dead code in v1.
 *
 * SDK shape: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-agent/types.gen.d.ts`
 *   - `SitesGetAllPagesBySiteResponses[200] = Array<PageModel>`
 *   - `PageModel = { id: string; path: string }`
 *
 * Note path key is `siteName`, NOT `siteId` (architecture § 5.5).
 *
 * The lean `PageModel` is enriched here with the calling-site context
 * (siteId, siteName, language, collectionId) so the index-builder can
 * group by site without re-joining tables.
 */
export async function queryAllPagesBySite(
  client: ClientSDK,
  contextId: string,
  site: { readonly siteId: string; readonly siteName: string; readonly collectionId?: string },
  language: string,
  signal: AbortSignal,
): Promise<ReadonlyArray<PageStub>> {
  throwIfAborted(signal);

  const result = await client.query('xmc.agent.sitesGetAllPagesBySite', {
    params: {
      path: { siteName: site.siteName },
      query: { language, sitecoreContextId: contextId },
    },
  });

  throwIfAborted(signal);

  // Double-unwrap: hey-api envelope → `Array<PageModel>`.
  const pages = unwrapOk(result.data) ?? [];

  // Derive a friendly `pageName` from the path's last non-empty segment;
  // the agent endpoint does NOT supply one. Drawer rows show the path
  // anyway, but search/sort needs SOMETHING readable in `pageName`.
  return pages.map(
    (p): PageStub => ({
      pageId: p.id,
      pageName: deriveNameFromPath(p.path),
      sitePath: p.path,
      siteId: site.siteId,
      siteName: site.siteName,
      language,
      collectionId: site.collectionId,
    }),
  );
}

const deriveNameFromPath = (path: string): string => {
  if (typeof path !== 'string' || path.length === 0) return 'Home';
  const trimmed = path.replace(/\/+$/, '');
  if (trimmed.length === 0) return 'Home';
  const parts = trimmed.split('/').filter((p) => p.length > 0);
  if (parts.length === 0) return 'Home';
  const raw = parts[parts.length - 1]!;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

// ---------------------------------------------------------------------------
// 5. Components on page — agent endpoint (ENVELOPE per M2 OQ-A1)
// ---------------------------------------------------------------------------

/**
 * Components placed on one page.
 *
 * ⚠ The response is an ENVELOPE, not a flat array — the components live at
 * `.components`, so this unwraps `result.data?.components ?? []` and maps each
 * SDK model onto the Atlas shape (id -> placementId, componentId -> renderingId,
 * componentName -> renderingName, placeholder -> placeholderKey,
 * dataSource -> datasourceId).
 *
 * SDK shape: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-agent/types.gen.d.ts`
 *   PagesGetComponentsOnPageResponses[200] = GetPageComponentsResponse
 *
 * Re-throws so Promise.allSettled in the engine can collect the failure.
 */
export async function queryComponentsOnPage(
  client: ClientSDK,
  contextId: string,
  pageId: string,
  language: string,
  signal: AbortSignal,
  surface?: ScanSurface,
): Promise<ReadonlyArray<ComponentRecord>> {
  throwIfAborted(signal);

  const fetch = (): Promise<ReadonlyArray<ComponentRecord>> =>
    (async () => {
      const result = await client.query('xmc.agent.pagesGetComponentsOnPage', {
        params: {
          path: { pageId },
          query: { language, sitecoreContextId: contextId },
        },
      });

      throwIfAborted(signal);

      // OQ-A1 envelope unwrap. Double-unwrap pattern:
      //   result.data        → hey-api envelope
      //   result.data.data   → GetPageComponentsResponse (the Atlas-relevant envelope)
      //   .components        → ComponentModel[] (per OQ-A1)
      const payload = unwrapOk(result.data);
      const components = payload?.components ?? [];

      return components.map(
        (c): ComponentRecord => ({
          placementId: c.id,
          renderingId:
            typeof c.componentId === 'string' && c.componentId.length > 0
              ? c.componentId
              : undefined,
          renderingName:
            typeof c.componentName === 'string' && c.componentName.length > 0
              ? c.componentName
              : undefined,
          placeholderKey:
            typeof c.placeholder === 'string' && c.placeholder.length > 0
              ? c.placeholder
              : undefined,
          datasourceId:
            typeof c.dataSource === 'string' && c.dataSource.length > 0
              ? c.dataSource
              : undefined,
        }),
      );
    })();

  return withTimeout(
    withBackoff(fetch, isRateLimit, signal, { surface }),
    PER_PAGE_TIMEOUT_MS,
    signal,
  );
}
