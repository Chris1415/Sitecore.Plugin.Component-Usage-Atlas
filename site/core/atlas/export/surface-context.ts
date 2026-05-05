// T009 — `SurfaceContext` shape + click-time clone helper.
//
// ADR-0016 (purity): the click handler resolves the live atlas snapshot
// AND a SurfaceContext at click time, then passes BOTH into
// `buildExport`. The construction function never re-reads the singleton
// or React context — `cloneSurfaceContext` produces a deep copy here so
// mid-scan navigation cannot mutate the in-flight export payload
// (AC-2.7 — "Mid-scan navigation does not corrupt an in-progress
// download").
//
// Tenant identity is sourced from `requireTenantIdentity(ctx)` in
// `core/tenant-identity.ts` (ADR-0020) — the surface resolves the
// `TenantIdentity` and embeds it on the SurfaceContext, never reading
// `application.context.*` directly inside the export construction.

import type { TenantIdentity } from '@/core/tenant-identity';

export type ExportSurface = 'widget' | 'panel';

export type ExportScopeKind = 'all-collections' | 'collection';

export interface ExportScope {
  readonly kind: ExportScopeKind;
  readonly collectionId?: string;
  readonly collectionName?: string;
}

export interface ExportPartialInfo {
  readonly pagesScanned: number;
  readonly pagesTotal: number;
  readonly cancelReason: 'user_canceled' | 'timeout' | 'error';
}

export interface ExportTotals {
  readonly sites: number;
  readonly pages: number;
  readonly renderings: number;
  readonly datasources: number;
}

export interface ExportSkippedPage {
  readonly pageId: string;
  readonly reason: 'forbidden' | 'timeout' | 'not_found' | 'network_error' | 'other';
}

export interface ExportPanelPage {
  readonly pageId: string;
  readonly pageName: string;
  readonly sitePath: string;
  readonly siteId: string;
  readonly siteName: string;
  readonly language: string;
  readonly collectionId?: string;
}

export interface SurfaceContext {
  readonly surface: ExportSurface;
  readonly tenant: TenantIdentity;
  readonly scope: ExportScope;
  readonly languagesScanned: ReadonlyArray<string>;
  readonly scanTimestamp: string;
  readonly isPartial: boolean;
  readonly partialInfo?: ExportPartialInfo;
  readonly totals: ExportTotals;
  readonly skippedPages: ReadonlyArray<ExportSkippedPage>;
  readonly panelPage?: ExportPanelPage;
}

/**
 * Click-time deep clone of the surface context. Per ADR-0016 the click
 * handler invokes this BEFORE passing into `buildExport`. Mutating the
 * clone's nested arrays / objects must never affect the original — the
 * construction function may iterate over the arrays freely without risk
 * of aliasing.
 */
export function cloneSurfaceContext(ctx: SurfaceContext): SurfaceContext {
  return {
    surface: ctx.surface,
    tenant: { tenantId: ctx.tenant.tenantId, tenantName: ctx.tenant.tenantName },
    scope: {
      kind: ctx.scope.kind,
      ...(ctx.scope.collectionId !== undefined ? { collectionId: ctx.scope.collectionId } : {}),
      ...(ctx.scope.collectionName !== undefined
        ? { collectionName: ctx.scope.collectionName }
        : {}),
    },
    languagesScanned: ctx.languagesScanned.slice(),
    scanTimestamp: ctx.scanTimestamp,
    isPartial: ctx.isPartial,
    ...(ctx.partialInfo !== undefined
      ? {
          partialInfo: {
            pagesScanned: ctx.partialInfo.pagesScanned,
            pagesTotal: ctx.partialInfo.pagesTotal,
            cancelReason: ctx.partialInfo.cancelReason,
          },
        }
      : {}),
    totals: {
      sites: ctx.totals.sites,
      pages: ctx.totals.pages,
      renderings: ctx.totals.renderings,
      datasources: ctx.totals.datasources,
    },
    skippedPages: ctx.skippedPages.map((p) => ({ pageId: p.pageId, reason: p.reason })),
    ...(ctx.panelPage !== undefined
      ? {
          panelPage: {
            pageId: ctx.panelPage.pageId,
            pageName: ctx.panelPage.pageName,
            sitePath: ctx.panelPage.sitePath,
            siteId: ctx.panelPage.siteId,
            siteName: ctx.panelPage.siteName,
            language: ctx.panelPage.language,
            ...(ctx.panelPage.collectionId !== undefined
              ? { collectionId: ctx.panelPage.collectionId }
              : {}),
          },
        }
      : {}),
  };
}
