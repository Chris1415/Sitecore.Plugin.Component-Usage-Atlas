// T021 — Per-site default language resolver.
//
// The page list endpoint (`xmc.agent.sitesGetAllPagesBySite`) requires
// a `language` query parameter. Per IS-13 / FR-1.3 the editor only
// cares about the site's default language for v1; localization variants
// are out of scope (PRD-000 § 5).
//
// Per OQ-A1 finding (M2 friction log T005): the SDK's `Site` shape has
// NO `defaultLanguage` field. Only `languages?: Array<string> | null`
// is exposed. This resolver therefore:
//
//   1. Calls `queryRetrieveSite` once per `siteId` (cached for the
//      scan's duration via the module-scoped `Map`).
//   2. Returns `languages[0]` when present.
//   3. Falls back to the v1 hardcoded `'en'` when the site's languages
//      list is empty / undefined. The friction-log entry recording the
//      fallback is appended by the engine when this branch fires (the
//      resolver itself is pure; the engine + telemetry layer is the
//      logging surface).
//
// SDK shape: `node_modules/@sitecore-marketplace-sdk/xmc/dist/xmc/src/client-sites/types.gen.d.ts`
//   `Site = { id?, name?, ..., languages?: Array<string> | null }`
//
// Public API:
//
//   resolveSiteLanguage(client, contextId, site)            → Promise<string>
//   resolveSiteLanguageWithCache(client, contextId, site, cache) → Promise<string>
//   createSiteLanguageCache()                               → SiteLanguageCache
//
// The cache is created per-scan (the engine constructs one per `runScan`
// invocation) so that successive scans pick up edits to a site's
// language list. It is NOT module-scoped — module-scoping would leak
// stale results across scans.

import type { ClientSDK } from '@sitecore-marketplace-sdk/client';

import { queryRetrieveSite } from '@/lib/sdk/queries';
import type { Site, SiteId } from '@/lib/sdk/types';

const FALLBACK_LANGUAGE = 'en';

export type SiteLanguageCache = Map<SiteId, string>;

export const createSiteLanguageCache = (): SiteLanguageCache => new Map();

export async function resolveSiteLanguageWithCache(
  client: ClientSDK,
  contextId: string,
  site: Site,
  cache: SiteLanguageCache,
): Promise<string> {
  const cached = cache.get(site.siteId);
  if (typeof cached === 'string' && cached.length > 0) return cached;

  // Per ADR-0006 / FR-1.3: prefer the site's first declared language.
  // The lean agent shape doesn't carry it, so ask the rich sites
  // endpoint. Errors propagate so the engine can decide whether to
  // skip this site (T020 already runs `retrieveSite` per site under
  // collection scope; we tolerate the duplicated call in v1 — the
  // network round-trip is amortized by the cache).
  const detail = await queryRetrieveSite(client, contextId, site.siteId);
  const first = detail.languages[0];
  const language = typeof first === 'string' && first.length > 0 ? first : FALLBACK_LANGUAGE;
  cache.set(site.siteId, language);
  return language;
}

export async function resolveSiteLanguage(
  client: ClientSDK,
  contextId: string,
  site: Site,
): Promise<string> {
  return resolveSiteLanguageWithCache(client, contextId, site, createSiteLanguageCache());
}

export const __FALLBACK_LANGUAGE_FOR_TEST = FALLBACK_LANGUAGE;
