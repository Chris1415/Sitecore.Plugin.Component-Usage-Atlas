// T010 — RED unit tests for `core/atlas/export/surface-context.ts`
// (lifts to GREEN at T009).
//
// Per § 10 T010: 5 cases. The clone helper must produce a structurally
// equal but reference-different copy with deep-clone integrity for
// nested arrays + objects (`languagesScanned`, `partialInfo`,
// `panelPage`, `skippedPages`, `totals`). ADR-0016 makes this clone
// load-bearing — `buildExport` consumes the clone, never the live
// surface object, so any aliasing here would let mid-scan navigation
// mutate the in-flight export payload (AC-2.7).
//
// SDK fixture provenance: N/A — `SurfaceContext` is a project-internal
// type, not derived from the Marketplace SDK shape.

import { describe, it, expect } from 'vitest';
import {
  cloneSurfaceContext,
  type SurfaceContext,
} from '@/core/atlas/export/surface-context';
import type { TenantIdentity } from '@/core/tenant-identity';

const tenant: TenantIdentity = {
  tenantId: 'abc1234567',
  tenantName: 'Acme',
};

const widgetCtx = (): SurfaceContext => ({
  surface: 'widget',
  tenant: { ...tenant },
  scope: { kind: 'all-collections' },
  languagesScanned: ['en'],
  scanTimestamp: '2026-05-03T10:14:41Z',
  isPartial: false,
  totals: { sites: 2, pages: 10, renderings: 5, datasources: 3 },
  skippedPages: [],
});

const panelCtx = (): SurfaceContext => ({
  surface: 'panel',
  tenant: { ...tenant },
  scope: { kind: 'collection', collectionId: 'col-9f8e7d6', collectionName: 'Marketing' },
  languagesScanned: ['de', 'en'],
  scanTimestamp: '2026-05-03T10:14:41Z',
  isPartial: true,
  partialInfo: {
    pagesScanned: 4,
    pagesTotal: 10,
    cancelReason: 'user_canceled',
  },
  totals: { sites: 1, pages: 4, renderings: 2, datasources: 1 },
  skippedPages: [{ pageId: 'p-1', reason: 'forbidden' }],
  panelPage: {
    pageId: 'p-home',
    pageName: 'Home',
    sitePath: '/sitecore/content/Acme/Home',
    siteId: 's-1',
    siteName: 'acme-site',
    language: 'en',
    collectionId: 'col-9f8e7d6',
  },
});

describe('cloneSurfaceContext', () => {
  it('produces a structurally equal but reference-different object', () => {
    const ctx = widgetCtx();
    const clone = cloneSurfaceContext(ctx);

    expect(clone).toEqual(ctx);
    expect(clone).not.toBe(ctx);
  });

  it('mutating nested arrays on the clone does not affect the original', () => {
    const ctx = widgetCtx();
    const originalLangCount = ctx.languagesScanned.length;
    const clone = cloneSurfaceContext(ctx);

    // mutate the clone's nested arrays
    (clone.languagesScanned as string[]).push('xx');
    (clone.skippedPages as Array<{ pageId: string; reason: string }>).push({
      pageId: 'p-mut',
      reason: 'other',
    });

    expect(ctx.languagesScanned.length).toBe(originalLangCount);
    expect(ctx.skippedPages.length).toBe(0);
    expect(clone.languagesScanned).not.toBe(ctx.languagesScanned);
    expect(clone.skippedPages).not.toBe(ctx.skippedPages);
  });

  it('widget context (no panelPage) round-trips with assertion equality', () => {
    const ctx = widgetCtx();
    const clone = cloneSurfaceContext(ctx);

    expect(clone.surface).toBe('widget');
    expect(clone.panelPage).toBeUndefined();
    expect(clone.tenant).toEqual(tenant);
    expect(clone.tenant).not.toBe(ctx.tenant);
    expect(clone.scope).toEqual({ kind: 'all-collections' });
    expect(clone.scope).not.toBe(ctx.scope);
    expect(clone.totals).toEqual(ctx.totals);
    expect(clone.totals).not.toBe(ctx.totals);
  });

  it('panel context (with panelPage) round-trips with deep equality', () => {
    const ctx = panelCtx();
    const clone = cloneSurfaceContext(ctx);

    expect(clone).toEqual(ctx);
    expect(clone.panelPage).toEqual(ctx.panelPage);
    expect(clone.panelPage).not.toBe(ctx.panelPage);
  });

  it('deeply mutating partialInfo on the clone does not affect the original (deep-clone integrity)', () => {
    const ctx = panelCtx();
    const clone = cloneSurfaceContext(ctx);

    // mutate the clone's nested partialInfo
    if (!clone.partialInfo) throw new Error('partialInfo expected on panel ctx');
    (clone.partialInfo as { cancelReason: 'user_canceled' | 'timeout' | 'error' }).cancelReason =
      'timeout';

    expect(ctx.partialInfo?.cancelReason).toBe('user_canceled');
    expect(clone.partialInfo).not.toBe(ctx.partialInfo);
  });
});
