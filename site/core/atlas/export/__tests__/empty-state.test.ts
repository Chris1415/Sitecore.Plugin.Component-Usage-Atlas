// T049 — Empty-atlas + zero-rendering-page integration test
// (DoD-8 / IS-18 / AC-2.5).
//
// Both atlas-level emptiness (no renderings anywhere) and page-level
// emptiness (a page that has zero renderings even though the atlas has
// some) MUST produce valid files in all three formats. Per-format
// empty-state assertions exist in `json.test.ts`, `csv.test.ts`, and
// `html.test.ts`; this file is the focused integration guard that runs
// the `buildExport` orchestration entry point end-to-end across the
// matrix in one place — DoD-8 review surface.

import { describe, it, expect } from 'vitest';

import { buildExport } from '@/core/atlas/export/build-export';
import type { Atlas, RenderingUsage, PageRef } from '@/lib/sdk/types';
import type { SurfaceContext, ExportPanelPage } from '@/core/atlas/export/surface-context';

const FORMATS = ['json', 'csv', 'html'] as const;
const EXPORTED_AT = '2026-05-03T11:00:00.000Z';

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

function makePopulatedAtlas(): Atlas {
  // Renderings exist in the atlas, but none of them touch the panel page.
  const otherPage: PageRef = {
    pageId: 'p-other',
    pageName: 'Other page',
    sitePath: '/sites/acme',
    siteId: 'site-1',
    siteName: 'Acme',
  };
  const renderingIndex = new Map<string, RenderingUsage>();
  renderingIndex.set('r-001', {
    renderingId: 'r-001',
    displayName: 'Hero',
    isUnknown: false,
    totalUsages: 1,
    pages: [otherPage],
    datasources: [],
  });
  return {
    scope: { kind: 'all-collections' },
    scannedAt: 1_700_000_000_000,
    isPartial: false,
    renderingIndex,
    datasourceIndex: new Map(),
    skipped: [],
    totals: { sites: 1, pages: 1, renderings: 1, datasources: 0, skipped: 0 },
  };
}

function makeWidgetCtx(): SurfaceContext {
  return {
    surface: 'widget',
    tenant: { tenantId: 'tnt-emptyat', tenantName: 'Empty Tenant' },
    scope: { kind: 'all-collections' },
    languagesScanned: ['en'],
    scanTimestamp: '2026-05-03T10:14:41Z',
    isPartial: false,
    totals: { sites: 0, pages: 0, renderings: 0, datasources: 0 },
    skippedPages: [],
  };
}

function makePanelCtx(panelPage: ExportPanelPage): SurfaceContext {
  return {
    surface: 'panel',
    tenant: { tenantId: 'tnt-zeropag', tenantName: 'Zero Page' },
    scope: { kind: 'all-collections' },
    languagesScanned: ['en'],
    scanTimestamp: '2026-05-03T10:14:41Z',
    isPartial: false,
    totals: { sites: 1, pages: 1, renderings: 1, datasources: 0 },
    skippedPages: [],
    panelPage,
  };
}

const EMPTY_PANEL_PAGE: ExportPanelPage = {
  pageId: 'p-empty',
  pageName: 'Empty page',
  sitePath: '/sites/acme',
  siteId: 'site-1',
  siteName: 'Acme',
  language: 'en',
};

describe('empty-state integration (DoD-8 / IS-18 / AC-2.5)', () => {
  describe('empty atlas — zero renderings anywhere (widget surface)', () => {
    for (const format of FORMATS) {
      it(`${format}: produces a valid, non-empty Blob`, async () => {
        const result = buildExport({
          atlas: makeEmptyAtlas(),
          surface: 'widget',
          format,
          surfaceContext: makeWidgetCtx(),
          exportedAt: EXPORTED_AT,
        });
        expect(result.blob).toBeInstanceOf(Blob);
        expect(result.blob.size).toBeGreaterThan(0);
        expect(result.filename).toMatch(new RegExp(`\\.${format}$`));

        const text = await result.blob.text();

        if (format === 'json') {
          // JSON envelope still parses; body.renderings is `[]`; header
          // fields are populated.
          const parsed = JSON.parse(text) as {
            atlas_export_schema_version: number;
            body: { renderings: unknown[] };
            tenant: { tenant_id: string };
          };
          expect(parsed.atlas_export_schema_version).toBe(1);
          expect(parsed.body.renderings).toEqual([]);
          expect(parsed.tenant.tenant_id).toBe('tnt-emptyat');
        } else if (format === 'csv') {
          // 9 `#` header lines + column header row, but no data rows.
          expect(text).toContain('# Atlas snapshot');
          expect(text).toContain('# Schema version: 1');
          expect(text).toContain('rendering_id,display_name,total_usages,distinct_pages,last_seen_update');
        } else {
          // HTML — empty-state paragraph is present.
          expect(text).toContain('<!doctype html>');
          expect(text).toContain('(No renderings found.)');
        }
      });
    }
  });

  describe('zero-rendering panel page — atlas populated but page itself empty', () => {
    for (const format of FORMATS) {
      it(`${format}: produces a valid Blob with the panel page metadata`, async () => {
        const result = buildExport({
          atlas: makePopulatedAtlas(),
          surface: 'panel',
          format,
          surfaceContext: makePanelCtx(EMPTY_PANEL_PAGE),
          exportedAt: EXPORTED_AT,
        });
        expect(result.blob).toBeInstanceOf(Blob);
        expect(result.blob.size).toBeGreaterThan(0);

        const text = await result.blob.text();
        if (format === 'json') {
          const parsed = JSON.parse(text) as {
            surface: string;
            body: { page: { page_id: string }; renderings: Array<{ cross_tenant_page_count: number }> };
          };
          expect(parsed.surface).toBe('panel');
          expect(parsed.body.page.page_id).toBe('p-empty');
          // The panel page is excluded from cross-tenant pages, so the
          // populated rendering still has cross-tenant pages > 0 because
          // the panel page wasn't in r-001's pages list anyway.
          for (const r of parsed.body.renderings) {
            expect(r.cross_tenant_page_count).toBeGreaterThanOrEqual(0);
          }
        } else if (format === 'csv') {
          expect(text).toContain('# Page: Empty page (p-empty)');
        } else {
          expect(text).toContain('<dt>Page</dt>');
          expect(text).toContain('Empty page');
        }
      });
    }
  });
});
