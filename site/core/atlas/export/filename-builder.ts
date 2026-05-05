// T013 — Filename builder for Atlas exports.
//
// Implements the slug rules per PRD-001 § 9.4 + ADR-0020 (canonical
// tenant-name fallback) + IS-17 (collection collision suffix). All
// inputs are project-internal (TenantIdentity comes from
// `core/tenant-identity.ts`); no SDK shapes touched here.
//
// Pattern:
//   widget: atlas-<tenantSlug>-widget-<scopeSlug>-<tsCompact>.<ext>
//   panel:  atlas-<tenantSlug>-panel-<pageSlug>-<tsCompact>.<ext>
//
// Slug rules (§ 9.4):
//   - lowercase ASCII
//   - replace whitespace + punctuation with '-'
//   - collapse '-' runs
//   - trim leading / trailing '-'
//
// Tenant fallback (ADR-0020): when `tenant.tenantName === null` (or
// slugifies to empty), use `tenant-<last-7-of-tenantId>` — a single
// canonical token, applied uniformly across filename and CSV/HTML
// header presentation. JSON header keeps `null` (NOT this string) so
// tooling can detect the fallback case.
//
// Length cap: total filename ≤ 200 chars. When over, truncate the
// page-name slug component first per FR-6.3 (drops the human-readable
// part before any other field).

import type { TenantIdentity } from '@/core/tenant-identity';

export interface FilenameInput {
  readonly tenant: TenantIdentity;
  readonly surface: 'widget' | 'panel';
  readonly scopeKind: 'all-collections' | 'collection';
  readonly scopeCollectionName?: string;
  readonly scopeCollectionId?: string;
  readonly scanTimestamp: string;
  readonly pageName?: string;
  readonly pageId?: string;
  readonly format: 'json' | 'csv' | 'html';
}

const MAX_FILENAME_LENGTH = 200;
const MAX_PAGE_NAME_SLUG_LENGTH = 60;

/**
 * Slugify per § 9.4 rules. Returns empty string for input that is
 * empty, whitespace-only, or fully punctuation.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    // strip combining marks left over from NFKD
    .replace(/[\u0300-\u036f]/g, '')
    // anything that is not lowercase ascii letter / digit becomes '-'
    .replace(/[^a-z0-9]+/g, '-')
    // collapse runs of '-' (already collapsed by + above; defensive)
    .replace(/-+/g, '-')
    // trim leading / trailing '-'
    .replace(/^-+|-+$/g, '');
}

/** Compact ISO-8601 → `YYYYMMDDTHHMMSSZ` (no `:`, `-`, milliseconds). */
function toCompactTimestamp(iso: string): string {
  // Strip any non-digit/non-T character. Keeps the trailing Z.
  // e.g. '2026-05-03T10:14:41.123Z' → '20260503T101441Z'
  const trimmed = iso.replace(/\.\d+/, '');
  return trimmed.replace(/[^0-9TZ]/g, '');
}

function tenantSlug(tenant: TenantIdentity): string {
  if (tenant.tenantName !== null) {
    const slug = slugify(tenant.tenantName);
    if (slug.length > 0) return slug;
  }
  // ADR-0020 canonical fallback
  return `tenant-${tenant.tenantId.slice(-7)}`;
}

function scopeSlug(input: FilenameInput): string {
  if (input.scopeKind === 'all-collections') {
    return 'all-collections';
  }
  // collection scope
  const id = input.scopeCollectionId ?? '';
  const idTail = id.slice(-7);
  if (input.scopeCollectionName !== undefined) {
    const nameSlug = slugify(input.scopeCollectionName);
    if (nameSlug.length > 0) {
      return idTail.length > 0 ? `${nameSlug}-${idTail}` : nameSlug;
    }
  }
  return idTail.length > 0 ? idTail : 'collection';
}

function pageSlug(pageName: string | undefined, pageId: string | undefined): string {
  const idTail = (pageId ?? '').slice(-7);
  if (pageName !== undefined) {
    const slug = slugify(pageName);
    if (slug.length > 0) {
      if (slug.length > MAX_PAGE_NAME_SLUG_LENGTH) {
        const truncated = slug.slice(0, MAX_PAGE_NAME_SLUG_LENGTH);
        return idTail.length > 0 ? `${truncated}-${idTail}` : truncated;
      }
      return slug;
    }
  }
  return idTail.length > 0 ? `page-${idTail}` : 'page';
}

export function buildFilename(input: FilenameInput): string {
  const tenant = tenantSlug(input.tenant);
  const ts = toCompactTimestamp(input.scanTimestamp);

  let middle: string;
  if (input.surface === 'panel') {
    middle = `panel-${pageSlug(input.pageName, input.pageId)}`;
  } else {
    middle = `widget-${scopeSlug(input)}`;
  }

  let candidate = `atlas-${tenant}-${middle}-${ts}.${input.format}`;

  if (candidate.length <= MAX_FILENAME_LENGTH) {
    return candidate;
  }

  // FR-6.3: trim the page-name slug FIRST — for panel surface, replace
  // the page slug with the page-${last7} fallback; for widget, trim
  // the collection-name slug to its id-tail.
  if (input.surface === 'panel') {
    const idTail = (input.pageId ?? '').slice(-7);
    const fallbackPage = idTail.length > 0 ? `page-${idTail}` : 'page';
    middle = `panel-${fallbackPage}`;
  } else if (input.scopeKind === 'collection') {
    const idTail = (input.scopeCollectionId ?? '').slice(-7);
    middle = `widget-${idTail.length > 0 ? idTail : 'collection'}`;
  }
  candidate = `atlas-${tenant}-${middle}-${ts}.${input.format}`;

  if (candidate.length <= MAX_FILENAME_LENGTH) {
    return candidate;
  }

  // Last resort: hard truncate from the end, preserving the extension.
  const ext = `.${input.format}`;
  const cap = MAX_FILENAME_LENGTH - ext.length;
  const head = candidate.slice(0, candidate.length - ext.length);
  return `${head.slice(0, cap)}${ext}`;
}
