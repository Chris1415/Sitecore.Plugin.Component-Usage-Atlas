// T020 — RED unit tests for `core/atlas/export/formats/json.ts`
// (lifts to GREEN at T019).
//
// Per § 10 T020: 13 cases covering schema § 10.1 shape, IS-14
// deterministic ordering (renderings by ID asc, pages by ID asc,
// datasources by ID asc, skipped_pages by ID asc), partial-flag,
// empty-state (IS-18), zero-rendering panel page (AC-2.5), schema
// constant import (IS-13), byte-identity prereq (DoD-3 / AC-4.4),
// top-level field order, and IS-17 collision visibility at the JSON
// layer.
//
// SDK fixture provenance: N/A — `Atlas` is a project-internal type;
// no SDK shapes touched.

import { describe, it, expect } from 'vitest';
import { jsonAdapter } from '@/core/atlas/export/formats/json';
import { buildHeader } from '@/core/atlas/export/header-builder';
import { ATLAS_EXPORT_SCHEMA_VERSION } from '@/core/atlas/export/schema-version';
import type { SurfaceContext } from '@/core/atlas/export/surface-context';
import type {
  Atlas,
  RenderingUsage,
  DatasourceUsage,
  PageRef,
} from '@/lib/sdk/types';

const EXPORTED_AT = '2026-05-03T11:00:00Z';

const widgetCtx = (overrides: Partial<SurfaceContext> = {}): SurfaceContext => ({
  surface: 'widget',
  tenant: { tenantId: 'abc1234567', tenantName: 'Acme' },
  scope: { kind: 'all-collections' },
  languagesScanned: ['en'],
  scanTimestamp: '2026-05-03T10:14:41Z',
  isPartial: false,
  totals: { sites: 2, pages: 4, renderings: 3, datasources: 2 },
  skippedPages: [],
  ...overrides,
});

const panelCtx = (overrides: Partial<SurfaceContext> = {}): SurfaceContext => ({
  surface: 'panel',
  tenant: { tenantId: 'abc1234567', tenantName: 'Acme' },
  scope: { kind: 'collection', collectionId: 'col-123', collectionName: 'Marketing' },
  languagesScanned: ['en'],
  scanTimestamp: '2026-05-03T10:14:41Z',
  isPartial: false,
  totals: { sites: 1, pages: 4, renderings: 2, datasources: 1 },
  skippedPages: [],
  panelPage: {
    pageId: 'p-home',
    pageName: 'Home',
    sitePath: '/sitecore/content/Acme/Home',
    siteId: 's-1',
    siteName: 'acme-site',
    language: 'en',
  },
  ...overrides,
});

const pageRef = (
  id: string,
  overrides: Partial<PageRef> & { collectionId?: string } = {},
): PageRef & { collectionId?: string } => ({
  pageId: id,
  pageName: `page-${id}`,
  sitePath: `/sitecore/content/Acme/${id}`,
  siteId: 's-1',
  siteName: 'acme-site',
  ...overrides,
});

const renderingUsage = (id: string, pages: PageRef[]): RenderingUsage => ({
  renderingId: id,
  displayName: `Rendering ${id}`,
  isUnknown: false,
  pages,
  datasources: [],
  totalUsages: pages.length,
});

const datasourceUsage = (id: string, pages: PageRef[]): DatasourceUsage => ({
  datasourceId: id,
  displayName: `Datasource ${id}`,
  isMissing: false,
  pages,
  renderings: [],
});

const buildAtlas = (
  renderings: RenderingUsage[],
  datasources: DatasourceUsage[] = [],
  overrides: Partial<Atlas> = {},
): Atlas => ({
  scope: { kind: 'all-collections' },
  scannedAt: 1_700_000_000_000,
  isPartial: false,
  renderingIndex: new Map(renderings.map((r) => [r.renderingId, r])),
  datasourceIndex: new Map(datasources.map((d) => [d.datasourceId, d])),
  skipped: [],
  totals: {
    sites: 1,
    pages: renderings.flatMap((r) => r.pages).length,
    renderings: renderings.length,
    datasources: datasources.length,
    skipped: 0,
  },
  ...overrides,
});

const runJson = (
  atlas: Atlas,
  ctx: SurfaceContext,
): { parsed: Record<string, unknown>; raw: string } => {
  const header = buildHeader(ctx, EXPORTED_AT);
  const out = jsonAdapter(atlas, ctx, header);
  return { parsed: JSON.parse(out.body) as Record<string, unknown>, raw: out.body };
};

describe('jsonAdapter — widget body', () => {
  it('renderings sorted by rendering_id ASC (IS-14)', () => {
    const atlas = buildAtlas([
      renderingUsage('r-zzz', [pageRef('p-1')]),
      renderingUsage('r-aaa', [pageRef('p-2')]),
      renderingUsage('r-mmm', [pageRef('p-3')]),
    ]);
    const { parsed } = runJson(atlas, widgetCtx());
    const ids = (
      (parsed.body as { renderings: Array<{ rendering_id: string }> }).renderings
    ).map((r) => r.rendering_id);
    expect(ids).toEqual(['r-aaa', 'r-mmm', 'r-zzz']);
  });

  it("each rendering's pages sorted by page_id ASC (IS-14)", () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-zzz'), pageRef('p-aaa'), pageRef('p-mmm')]),
    ]);
    const { parsed } = runJson(atlas, widgetCtx());
    const pages = (
      (parsed.body as { renderings: Array<{ pages: Array<{ page_id: string }> }> }).renderings
    )[0].pages;
    expect(pages.map((p) => p.page_id)).toEqual(['p-aaa', 'p-mmm', 'p-zzz']);
  });

  it('datasources at rendering level sorted by datasource_id ASC (IS-14)', () => {
    const rendering: RenderingUsage = {
      renderingId: 'r-1',
      displayName: 'R1',
      isUnknown: false,
      pages: [pageRef('p-1')],
      datasources: ['ds-zzz', 'ds-aaa', 'ds-mmm'],
      totalUsages: 1,
    };
    const ds = [
      datasourceUsage('ds-zzz', [pageRef('p-1')]),
      datasourceUsage('ds-aaa', [pageRef('p-1')]),
      datasourceUsage('ds-mmm', [pageRef('p-1')]),
    ];
    const atlas = buildAtlas([rendering], ds);
    const { parsed } = runJson(atlas, widgetCtx());
    const dsList = (
      (parsed.body as { renderings: Array<{ datasources: Array<{ datasource_id: string }> }> })
        .renderings
    )[0].datasources;
    expect(dsList.map((d) => d.datasource_id)).toEqual(['ds-aaa', 'ds-mmm', 'ds-zzz']);
  });
});

describe('jsonAdapter — panel body', () => {
  it('panel body has page + renderings[] with cross_tenant_pages[] sorted', () => {
    const rendering: RenderingUsage = {
      renderingId: 'r-1',
      displayName: 'R1',
      isUnknown: false,
      pages: [
        pageRef('p-zzz'),
        pageRef('p-aaa'),
        pageRef('p-home'), // matches panelPage.pageId — caller-side filter excludes
      ],
      datasources: [],
      totalUsages: 3,
    };
    const atlas = buildAtlas([rendering]);
    const { parsed } = runJson(atlas, panelCtx());
    const body = parsed.body as {
      page: { page_id: string };
      renderings: Array<{ rendering_id: string; cross_tenant_pages: Array<{ page_id: string }> }>;
    };
    expect(body.page.page_id).toBe('p-home');
    // Cross-tenant pages = all pages on this rendering EXCEPT the current panel page,
    // sorted by page_id ASC.
    expect(body.renderings[0].cross_tenant_pages.map((p) => p.page_id)).toEqual([
      'p-aaa',
      'p-zzz',
    ]);
  });
});

describe('jsonAdapter — partial / null / skipped / empty state', () => {
  it('is_partial: true produces a populated partial_info (AC-1.6)', () => {
    const ctx = widgetCtx({
      isPartial: true,
      partialInfo: {
        pagesScanned: 4,
        pagesTotal: 10,
        cancelReason: 'user_canceled',
      },
    });
    const { parsed } = runJson(buildAtlas([]), ctx);
    expect(parsed.is_partial).toBe(true);
    expect(parsed.partial_info).toEqual({
      pages_scanned: 4,
      pages_total: 10,
      cancel_reason: 'user_canceled',
    });
  });

  it('tenant.tenant_name is null when SDK lacked the name (AC-1.4 at JSON layer)', () => {
    const ctx = widgetCtx({ tenant: { tenantId: 'abcdefg1234567', tenantName: null } });
    const { parsed } = runJson(buildAtlas([]), ctx);
    expect((parsed.tenant as { tenant_name: string | null }).tenant_name).toBeNull();
    expect((parsed.tenant as { tenant_name: string | null }).tenant_name).not.toBe(
      'tenant-1234567',
    );
  });

  it('skipped_pages sorted by page_id ASC', () => {
    const ctx = widgetCtx({
      skippedPages: [
        { pageId: 'p-zzz', reason: 'forbidden' },
        { pageId: 'p-aaa', reason: 'timeout' },
        { pageId: 'p-mmm', reason: 'network_error' },
      ],
    });
    const { parsed } = runJson(buildAtlas([]), ctx);
    const ids = (parsed.skipped_pages as Array<{ page_id: string }>).map((s) => s.page_id);
    expect(ids).toEqual(['p-aaa', 'p-mmm', 'p-zzz']);
  });

  it('empty atlas (zero renderings) produces body.renderings: [] with populated header (IS-18)', () => {
    const { parsed } = runJson(buildAtlas([]), widgetCtx());
    expect((parsed.body as { renderings: unknown[] }).renderings).toEqual([]);
    expect(parsed.atlas_export_schema_version).toBe(ATLAS_EXPORT_SCHEMA_VERSION);
    expect(parsed.surface).toBe('widget');
  });

  it('zero-rendering panel page produces body.renderings: [] with panel page metadata still present (AC-2.5)', () => {
    const { parsed } = runJson(buildAtlas([]), panelCtx());
    const body = parsed.body as {
      page: { page_id: string; page_name: string };
      renderings: unknown[];
    };
    expect(body.renderings).toEqual([]);
    expect(body.page.page_id).toBe('p-home');
    expect(body.page.page_name).toBe('Home');
  });
});

describe('jsonAdapter — schema + ordering', () => {
  it('atlas_export_schema_version: 1 sourced from imported constant (IS-13)', () => {
    const { parsed } = runJson(buildAtlas([]), widgetCtx());
    expect(parsed.atlas_export_schema_version).toBe(ATLAS_EXPORT_SCHEMA_VERSION);
    expect(parsed.atlas_export_schema_version).toBe(1);
  });

  it('byte-identical re-export with same inputs (DoD-3 / AC-4.4 prereq)', () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')]),
      renderingUsage('r-2', [pageRef('p-2')]),
    ]);
    const ctx = widgetCtx();
    const a = runJson(atlas, ctx).raw;
    const b = runJson(atlas, ctx).raw;
    expect(a).toBe(b);
  });

  it('format: "json" field appears at the documented position; top-level key order matches § 10.1', () => {
    const { parsed } = runJson(buildAtlas([]), widgetCtx());
    const keys = Object.keys(parsed);
    // Per § 10.1: schema_version, surface, format, exported_at, scan_timestamp, is_partial,
    // (partial_info?), tenant, scope, languages_scanned, totals, skipped_pages, body
    expect(keys).toEqual([
      'atlas_export_schema_version',
      'surface',
      'format',
      'exported_at',
      'scan_timestamp',
      'is_partial',
      'tenant',
      'scope',
      'languages_scanned',
      'totals',
      'skipped_pages',
      'body',
    ]);
    expect(parsed.format).toBe('json');
  });

  it('IS-17 visible at JSON layer: two collections same display name distinguishable by collection_id', () => {
    // The JSON adapter doesn't render a `body.collections[]` for the
    // widget body (renderings carry the per-page metadata which includes
    // `collection_id`). IS-17 is observable here because the per-page
    // PageRefs carry distinct `collection_id` values even when display
    // names collide.
    const r: RenderingUsage = {
      renderingId: 'r-1',
      displayName: 'R1',
      isUnknown: false,
      pages: [
        pageRef('p-1', { collectionId: 'col-aaaaaa1' }),
        pageRef('p-2', { collectionId: 'col-bbbbbb2' }),
      ],
      datasources: [],
      totalUsages: 2,
    };
    const atlas = buildAtlas([r]);
    const { parsed } = runJson(atlas, widgetCtx());
    const pages = (
      (parsed.body as { renderings: Array<{ pages: Array<{ collection_id?: string }> }> })
        .renderings
    )[0].pages;
    const collIds = pages.map((p) => p.collection_id);
    expect(collIds).toContain('col-aaaaaa1');
    expect(collIds).toContain('col-bbbbbb2');
    expect(new Set(collIds).size).toBe(2);
  });
});
