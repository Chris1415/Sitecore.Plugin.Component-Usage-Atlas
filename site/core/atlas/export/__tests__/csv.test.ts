// T022 — RED unit tests for `core/atlas/export/formats/csv.ts`
// (lifts to GREEN at T021).
//
// Per task breakdown § T022: 17 cases covering RFC 4180 quoting, R4
// formula-injection guard, lite columns per § 10.2, partial-flag,
// empty-state (IS-18), schema constant import (IS-13), tenant fallback
// (ADR-0020), UTF-8 no-BOM (FR-2.2), and skipped-pages footer.
//
// SDK fixture provenance: N/A — `Atlas` is a project-internal type;
// no SDK shapes touched.

import { describe, it, expect } from 'vitest';
import { csvAdapter } from '@/core/atlas/export/formats/csv';
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
  overrides: Partial<PageRef> = {},
): PageRef => ({
  pageId: id,
  pageName: `page-${id}`,
  sitePath: `/sitecore/content/Acme/${id}`,
  siteId: 's-1',
  siteName: 'acme-site',
  ...overrides,
});

const renderingUsage = (
  id: string,
  pages: PageRef[],
  overrides: Partial<RenderingUsage> = {},
): RenderingUsage => ({
  renderingId: id,
  displayName: `Rendering ${id}`,
  isUnknown: false,
  pages,
  datasources: [],
  totalUsages: pages.length,
  ...overrides,
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

const runCsv = (atlas: Atlas, ctx: SurfaceContext): string => {
  const header = buildHeader(ctx, EXPORTED_AT);
  return csvAdapter(atlas, ctx, header).body;
};

const splitLines = (body: string): string[] => body.split('\n');

const headerCommentLines = (body: string): string[] =>
  splitLines(body).filter((l) => l.startsWith('#'));

describe('csvAdapter — header block', () => {
  // (a) widget header block emits 9 `#` comment lines (or 10 with skipped footer when present)
  it('widget header emits 9 # comment lines (no skipped pages)', () => {
    const body = runCsv(buildAtlas([]), widgetCtx());
    const comments = headerCommentLines(body);
    expect(comments.length).toBe(9);
  });

  it('widget header emits 10 # comment lines when 3 skipped pages present', () => {
    const body = runCsv(
      buildAtlas([]),
      widgetCtx({
        skippedPages: [
          { pageId: 'p-1', reason: 'forbidden' },
          { pageId: 'p-2', reason: 'timeout' },
          { pageId: 'p-3', reason: 'network_error' },
        ],
      }),
    );
    const comments = headerCommentLines(body);
    expect(comments.length).toBe(10);
  });

  // (l) `# Schema version: 1` line read from imported constant (IS-13)
  it('schema version line reads from ATLAS_EXPORT_SCHEMA_VERSION constant', () => {
    const body = runCsv(buildAtlas([]), widgetCtx());
    expect(body).toContain(`# Schema version: ${ATLAS_EXPORT_SCHEMA_VERSION}`);
    expect(body).toContain('# Schema version: 1');
  });

  // (k) tenant name fallback rendered in CSV `# Tenant:` line as `tenant-${tenantId.slice(-7)}`
  it('tenant name fallback string appears in # Tenant: line when tenantName is null (ADR-0020)', () => {
    const body = runCsv(
      buildAtlas([]),
      widgetCtx({ tenant: { tenantId: 'abcdefg1234567', tenantName: null } }),
    );
    expect(body).toContain('# Tenant: tenant-1234567 (abcdefg1234567)');
  });
});

describe('csvAdapter — column header rows', () => {
  // (b) widget data row column order matches § 10.2 widget table
  it('widget column header is rendering_id,display_name,total_usages,distinct_pages,last_seen_update', () => {
    const body = runCsv(buildAtlas([]), widgetCtx());
    const lines = splitLines(body).filter((l) => l.length > 0 && !l.startsWith('#'));
    expect(lines[0]).toBe('rendering_id,display_name,total_usages,distinct_pages,last_seen_update');
  });

  // (c) panel data row column order matches § 10.2 panel table
  it('panel column header is rendering_id,rendering_display_name,datasource_id,datasource_display_name,cross_tenant_rendering_pages,cross_tenant_datasource_pages', () => {
    const body = runCsv(buildAtlas([]), panelCtx());
    const lines = splitLines(body).filter((l) => l.length > 0 && !l.startsWith('#'));
    expect(lines[0]).toBe(
      'rendering_id,rendering_display_name,datasource_id,datasource_display_name,cross_tenant_rendering_pages,cross_tenant_datasource_pages',
    );
  });
});

describe('csvAdapter — RFC 4180 quoting', () => {
  // (d) display name containing `,` is quoted (RFC 4180)
  it('field with comma is wrapped in quotes', () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: 'Hero, Banner' }),
    ]);
    const body = runCsv(atlas, widgetCtx());
    expect(body).toContain('r-1,"Hero, Banner",');
  });

  // (e) display name containing `"` doubles the quote
  it('field with embedded double-quote escapes by doubling and wrapping', () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: 'Say "Hi"' }),
    ]);
    const body = runCsv(atlas, widgetCtx());
    expect(body).toContain('r-1,"Say ""Hi""",');
  });

  // (f) display name containing newline is quoted
  it('field with embedded newline is wrapped in quotes', () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: 'Line1\nLine2' }),
    ]);
    const body = runCsv(atlas, widgetCtx());
    expect(body).toContain('"Line1\nLine2"');
  });
});

describe('csvAdapter — R4 formula-injection guard', () => {
  // (g) field starting with `=SUM(...)` gets leading `'`
  it("field starting with = gets leading single quote", () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: '=SUM(A1:A2)' }),
    ]);
    const body = runCsv(atlas, widgetCtx());
    // The leading apostrophe + the equals also creates content where the
    // string MAY need quoting (=SUM(...) has no special chars, so no
    // RFC-4180 quoting), but the apostrophe must be present.
    expect(body).toContain("'=SUM(A1:A2)");
  });

  // (h) field starting with `@cmd` gets leading `'`
  it("field starting with @ gets leading single quote", () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: '@cmd' }),
    ]);
    const body = runCsv(atlas, widgetCtx());
    expect(body).toContain("'@cmd");
  });

  // (i) field starting with `+1` gets leading `'`
  it("field starting with + gets leading single quote", () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: '+1' }),
    ]);
    const body = runCsv(atlas, widgetCtx());
    expect(body).toContain("'+1");
  });

  // (j) field starting with `-1` gets leading `'`
  it("field starting with - gets leading single quote", () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: '-1' }),
    ]);
    const body = runCsv(atlas, widgetCtx());
    expect(body).toContain("'-1");
  });

  // (p) numeric field `0` (zero) does NOT get a leading `'` prefix
  it("numeric field zero does NOT get a leading single quote (regression)", () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [], { displayName: 'Z', totalUsages: 0 }),
    ]);
    const body = runCsv(atlas, widgetCtx());
    // Data row: r-1,Z,0,0,
    expect(body).toContain('r-1,Z,0,0,');
    // and crucially NOT '0
    expect(body).not.toContain("'0");
  });

  // (q) field starting with `-1` BUT classified as a number is not quoted
  it("numeric field with negative value does not get a leading single quote (string-vs-number guard)", () => {
    // Build a rendering with totalUsages as a negative-classified number.
    // The injection guard checks string-typed fields only — numeric fields
    // serialize via toString() and bypass the guard.
    const atlas = buildAtlas([
      // totalUsages is typed `number`, so the guard never trips on it.
      renderingUsage('r-1', [pageRef('p-1')], { displayName: 'OK', totalUsages: -1 }),
    ]);
    const body = runCsv(atlas, widgetCtx());
    expect(body).toContain('r-1,OK,-1,');
    expect(body).not.toContain("'-1,");
  });
});

describe('csvAdapter — UTF-8, BOM, empty state, skipped footer', () => {
  // (m) UTF-8 string output, no BOM byte
  it('output has no UTF-8 BOM byte', () => {
    const body = runCsv(buildAtlas([]), widgetCtx());
    expect(body.charCodeAt(0)).not.toBe(0xfeff);
  });

  // (n) empty atlas produces header block + empty body + correct comments (no data rows)
  it('empty atlas produces header block + column header row only (no data rows)', () => {
    const body = runCsv(buildAtlas([]), widgetCtx());
    const dataLines = splitLines(body).filter(
      (l) => l.length > 0 && !l.startsWith('#'),
    );
    // First line is column header. After that, no data rows.
    expect(dataLines.length).toBe(1);
    expect(dataLines[0]).toBe(
      'rendering_id,display_name,total_usages,distinct_pages,last_seen_update',
    );
  });

  // (o) skipped footer `# skipped_pages: 3` when 3 skipped pages
  it('# skipped_pages: 3 footer appears when 3 skipped pages present', () => {
    const body = runCsv(
      buildAtlas([]),
      widgetCtx({
        skippedPages: [
          { pageId: 'p-1', reason: 'forbidden' },
          { pageId: 'p-2', reason: 'timeout' },
          { pageId: 'p-3', reason: 'network_error' },
        ],
      }),
    );
    expect(body).toContain('# skipped_pages: 3');
  });

  it('no # skipped_pages footer when 0 skipped pages', () => {
    const body = runCsv(buildAtlas([]), widgetCtx());
    expect(body).not.toContain('# skipped_pages:');
  });
});
