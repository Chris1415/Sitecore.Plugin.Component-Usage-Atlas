/**
 * Per-site default language. Exists because the page-list endpoint REQUIRES a
 * `language` param while the SDK's Site shape has no defaultLanguage field —
 * only `languages?: string[] | null`. Returns languages[0], else 'en'.
 *
 * The cache is per-scan, never module-scoped — module scope would leak stale
 * results across scans. See docs/build-decisions.md#site-language-resolution.
 */

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
