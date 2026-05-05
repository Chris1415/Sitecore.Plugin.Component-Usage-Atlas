// T011 — Shared metadata header builder for the Atlas export.
//
// Emits the canonical top-level metadata block per PRD-001 § 10.1.
// Field order is CONTRACTUAL (IS-14 / AC-4.1 / § 10.4) — adapters
// receive the header object literal in declared order and must not
// mutate it before stringifying. ADR-0019 mandates that the schema
// version come from a single source-of-truth constant; this builder
// imports it from `./schema-version` and never declares a literal `1`
// inline.
//
// Per ADR-0020: `tenant.tenant_name` is the SDK-resolved name when
// available, else `null` — the `tenant-<last-7-of-tenantId>` fallback
// string is synthesized only by the filename builder, NOT here.
// Keeping the JSON header `null` lets downstream tooling detect the
// fallback case unambiguously.
//
// Header is surface-agnostic at the body level: callers (JSON / CSV /
// HTML adapters) take the header and append their own surface-specific
// body. The shape returned here matches PRD-001 § 10.1 top-level keys
// only — `format` and `body` are NOT part of the header.

import { ATLAS_EXPORT_SCHEMA_VERSION } from './schema-version';
import type { SurfaceContext } from './surface-context';

export interface AtlasExportPartialInfo {
  readonly pages_scanned: number;
  readonly pages_total: number;
  readonly cancel_reason: 'user_canceled' | 'timeout' | 'error';
}

export interface AtlasExportTenant {
  readonly tenant_id: string;
  readonly tenant_name: string | null;
}

export interface AtlasExportScope {
  readonly kind: 'all-collections' | 'collection';
  readonly collection_id?: string;
  readonly collection_name?: string;
}

export interface AtlasExportTotals {
  readonly sites: number;
  readonly pages: number;
  readonly renderings: number;
  readonly datasources: number;
}

export interface AtlasExportSkippedPage {
  readonly page_id: string;
  readonly reason: 'forbidden' | 'timeout' | 'not_found' | 'network_error' | 'other';
}

export interface AtlasExportHeader {
  readonly atlas_export_schema_version: typeof ATLAS_EXPORT_SCHEMA_VERSION;
  readonly surface: 'widget' | 'panel';
  readonly exported_at: string;
  readonly scan_timestamp: string;
  readonly is_partial: boolean;
  readonly partial_info?: AtlasExportPartialInfo;
  readonly tenant: AtlasExportTenant;
  readonly scope: AtlasExportScope;
  readonly languages_scanned: ReadonlyArray<string>;
  readonly totals: AtlasExportTotals;
  readonly skipped_pages: ReadonlyArray<AtlasExportSkippedPage>;
}

/**
 * Build the canonical export header from a click-time SurfaceContext
 * clone + an ISO timestamp. Output key order matches § 10.1 declared
 * order — DO NOT reorder. Tests assert the order via
 * `Object.keys(JSON.parse(JSON.stringify(...)))` and will fail if the
 * literal construction order is changed.
 */
export function buildHeader(ctx: SurfaceContext, exportedAt: string): AtlasExportHeader {
  // Build scope in declared sub-order: kind → collection_id? → collection_name?
  const scope: AtlasExportScope = {
    kind: ctx.scope.kind,
    ...(ctx.scope.collectionId !== undefined ? { collection_id: ctx.scope.collectionId } : {}),
    ...(ctx.scope.collectionName !== undefined
      ? { collection_name: ctx.scope.collectionName }
      : {}),
  };

  const tenant: AtlasExportTenant = {
    tenant_id: ctx.tenant.tenantId,
    tenant_name: ctx.tenant.tenantName,
  };

  const totals: AtlasExportTotals = {
    sites: ctx.totals.sites,
    pages: ctx.totals.pages,
    renderings: ctx.totals.renderings,
    datasources: ctx.totals.datasources,
  };

  const skipped_pages: AtlasExportSkippedPage[] = ctx.skippedPages.map((p) => ({
    page_id: p.pageId,
    reason: p.reason,
  }));

  // Construct the header literal in declared order. The optional
  // `partial_info` slot is interleaved at the documented position
  // (between `is_partial` and `tenant`) only when present.
  if (ctx.isPartial && ctx.partialInfo !== undefined) {
    const partial_info: AtlasExportPartialInfo = {
      pages_scanned: ctx.partialInfo.pagesScanned,
      pages_total: ctx.partialInfo.pagesTotal,
      cancel_reason: ctx.partialInfo.cancelReason,
    };
    return {
      atlas_export_schema_version: ATLAS_EXPORT_SCHEMA_VERSION,
      surface: ctx.surface,
      exported_at: exportedAt,
      scan_timestamp: ctx.scanTimestamp,
      is_partial: true,
      partial_info,
      tenant,
      scope,
      languages_scanned: ctx.languagesScanned.slice(),
      totals,
      skipped_pages,
    };
  }

  return {
    atlas_export_schema_version: ATLAS_EXPORT_SCHEMA_VERSION,
    surface: ctx.surface,
    exported_at: exportedAt,
    scan_timestamp: ctx.scanTimestamp,
    is_partial: ctx.isPartial,
    tenant,
    scope,
    languages_scanned: ctx.languagesScanned.slice(),
    totals,
    skipped_pages,
  };
}
