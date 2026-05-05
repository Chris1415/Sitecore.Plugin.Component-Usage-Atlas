// T024 — RED unit tests for `core/atlas/export/formats/html.ts`
// (lifts to GREEN at T023).
//
// Per task breakdown § T024: 19 cases covering structure, R6 XSS guard
// (5-entity escape including attribute-context), print stylesheet, partial-
// scan badge, empty-state (IS-18 / DoD-8), skipped pages, tenant fallback
// (ADR-0020), schema-version footer (IS-13), and no-remote-assets / no-JS
// guards (NFR-4.3 / AC-3.2).
//
// SDK fixture provenance: N/A — `Atlas` is a project-internal type;
// no SDK shapes touched.

import { describe, it, expect } from 'vitest';
import { htmlAdapter } from '@/core/atlas/export/formats/html';
import { buildHeader } from '@/core/atlas/export/header-builder';
import type { SurfaceContext } from '@/core/atlas/export/surface-context';
import type {
  Atlas,
  RenderingUsage,
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

const pageRef = (id: string, overrides: Partial<PageRef> = {}): PageRef => ({
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
  overrides: Partial<Atlas> = {},
): Atlas => ({
  scope: { kind: 'all-collections' },
  scannedAt: 1_700_000_000_000,
  isPartial: false,
  renderingIndex: new Map(renderings.map((r) => [r.renderingId, r])),
  datasourceIndex: new Map(),
  skipped: [],
  totals: {
    sites: 1,
    pages: renderings.flatMap((r) => r.pages).length,
    renderings: renderings.length,
    datasources: 0,
    skipped: 0,
  },
  ...overrides,
});

const runHtml = (atlas: Atlas, ctx: SurfaceContext): string => {
  const header = buildHeader(ctx, EXPORTED_AT);
  return htmlAdapter(atlas, ctx, header).body;
};

describe('htmlAdapter — structure', () => {
  // (a) output begins with `<!doctype html>` and ends with `</html>`
  it('begins with <!doctype html> and ends with </html>', () => {
    const body = runHtml(buildAtlas([]), widgetCtx());
    expect(body.startsWith('<!doctype html>')).toBe(true);
    expect(body.trimEnd().endsWith('</html>')).toBe(true);
  });

  // (b) <title> includes tenant + surface
  it('<title> includes tenant name and surface', () => {
    const body = runHtml(buildAtlas([]), widgetCtx());
    expect(body).toMatch(/<title>[^<]*Acme[^<]*widget[^<]*<\/title>/);
  });

  // (c) <dl class="summary"> carries all required <dt>/<dd> pairs
  it('<dl class="summary"> contains all required <dt> labels', () => {
    const body = runHtml(buildAtlas([]), widgetCtx());
    expect(body).toContain('<dl class="summary">');
    expect(body).toContain('<dt>Tenant</dt>');
    expect(body).toContain('<dt>Surface</dt>');
    expect(body).toContain('<dt>Scope</dt>');
    expect(body).toContain('<dt>Languages scanned</dt>');
    expect(body).toContain('<dt>Scan timestamp</dt>');
    expect(body).toContain('<dt>Exported at</dt>');
    expect(body).toContain('<dt>Sites</dt>');
    expect(body).toContain('<dt>Pages</dt>');
    expect(body).toContain('<dt>Renderings</dt>');
    expect(body).toContain('<dt>Datasources</dt>');
  });
});

describe('htmlAdapter — R6 XSS guard (5-entity escape)', () => {
  // (d) display name `<script>alert(1)</script>` renders as escaped
  it('escapes < and > in display names', () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: '<script>alert(1)</script>' }),
    ]);
    const body = runHtml(atlas, widgetCtx());
    expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).not.toContain('<script>alert(1)</script>');
  });

  // (e) `&` in display name escapes to `&amp;`
  it('escapes & to &amp;', () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: 'A & B' }),
    ]);
    const body = runHtml(atlas, widgetCtx());
    expect(body).toContain('A &amp; B');
  });

  // (f) `'` in display name escapes to `&#39;`
  it("escapes ' to &#39;", () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: "John's" }),
    ]);
    const body = runHtml(atlas, widgetCtx());
    expect(body).toContain('John&#39;s');
  });

  // (g) `"` in display name escapes to `&quot;`
  it('escapes " to &quot;', () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: 'Say "Hi"' }),
    ]);
    const body = runHtml(atlas, widgetCtx());
    expect(body).toContain('Say &quot;Hi&quot;');
  });

  // (h) `>` standalone escape
  it('escapes > to &gt;', () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: 'A > B' }),
    ]);
    const body = runHtml(atlas, widgetCtx());
    expect(body).toContain('A &gt; B');
  });

  // (s) every interpolated path/id/display-name attribute value is also escaped
  it('attribute-context interpolations are also escaped (XSS via attribute injection)', () => {
    // A rendering ID containing a quote and tag-break would be a CR-blocker
    // if we interpolated raw into an attribute. Make sure the escape lands
    // even if the rendering_id ever surfaces in an attribute context.
    const malicious = '"><script>alert(1)</script>';
    const atlas = buildAtlas([
      renderingUsage(malicious, [pageRef('p-1')], { displayName: 'X' }),
    ]);
    const body = runHtml(atlas, widgetCtx());
    // The dangerous opener `"><script>` must not appear unescaped in
    // ANY context — neither text nor attribute. Verify by searching for
    // the verbatim payload + verifying escape is present.
    expect(body).not.toContain('"><script>');
    // The escaped form must show up — quote -> &quot;, < -> &lt;, > -> &gt;.
    expect(body).toContain('&quot;&gt;&lt;script&gt;');
  });
});

describe('htmlAdapter — print stylesheet + styles', () => {
  // (i) <style> block contains @media print
  it('<style> contains @media print', () => {
    const body = runHtml(buildAtlas([]), widgetCtx());
    expect(body).toContain('@media print');
  });

  // (j) <style> carries `thead { display: table-header-group }` rule
  it('print stylesheet has thead { display: table-header-group }', () => {
    const body = runHtml(buildAtlas([]), widgetCtx());
    expect(body).toMatch(/thead\s*\{[^}]*display:\s*table-header-group/);
  });

  // (k) <style> carries `print-color-adjust: exact` on `.badge-partial`
  it('print stylesheet enforces print-color-adjust: exact on .badge-partial', () => {
    const body = runHtml(buildAtlas([]), widgetCtx());
    expect(body).toMatch(/\.badge-partial\b[^}]*print-color-adjust:\s*exact/);
  });
});

describe('htmlAdapter — partial / empty / skipped / tenant-fallback', () => {
  // (l) partial-scan flag renders <span class="badge-partial">...</span>
  it('partial scan renders the badge-partial span (AC-1.6)', () => {
    const ctx = widgetCtx({
      isPartial: true,
      partialInfo: {
        pagesScanned: 4,
        pagesTotal: 10,
        cancelReason: 'user_canceled',
      },
    });
    const body = runHtml(buildAtlas([]), ctx);
    expect(body).toContain('<span class="badge-partial">');
    expect(body).toContain('Partial scan');
  });

  // (m) empty atlas renders the empty-state paragraph (IS-18 / DoD-8)
  it('empty atlas renders <p class="empty-state if-empty">(No renderings found.)</p>', () => {
    const body = runHtml(buildAtlas([]), widgetCtx());
    expect(body).toContain('<p class="empty-state if-empty">(No renderings found.)</p>');
  });

  // (n) skipped pages render <p class="if-skipped">N pages skipped: ...</p>
  it('skipped pages render the if-skipped paragraph', () => {
    const ctx = widgetCtx({
      skippedPages: [
        { pageId: 'p-1', reason: 'forbidden' },
        { pageId: 'p-2', reason: 'timeout' },
        { pageId: 'p-3', reason: 'network_error' },
      ],
    });
    const body = runHtml(buildAtlas([]), ctx);
    expect(body).toContain('<p class="if-skipped">');
    expect(body).toContain('3 pages skipped');
  });

  // (o) tenant name fallback `tenant-${tenantId.slice(-7)}` in <dd> when SDK lacks name
  it('tenant fallback string appears in summary <dd> when tenantName is null (ADR-0020)', () => {
    const body = runHtml(
      buildAtlas([]),
      widgetCtx({ tenant: { tenantId: 'abcdefg1234567', tenantName: null } }),
    );
    expect(body).toContain('tenant-1234567');
  });

  // (p) <footer> says `Schema version 1 — generated by Component Usage Atlas.`
  it('footer carries schema version + attribution', () => {
    const body = runHtml(buildAtlas([]), widgetCtx());
    expect(body).toContain(
      '<small>Schema version 1 — generated by Component Usage Atlas.</small>',
    );
  });
});

describe('htmlAdapter — no JS / no remote assets', () => {
  // (q) no <script> element appears anywhere in output (NFR-4.3)
  it('no <script> tag appears anywhere', () => {
    const atlas = buildAtlas([
      renderingUsage('r-1', [pageRef('p-1')], { displayName: '<script>alert(1)</script>' }),
    ]);
    const body = runHtml(atlas, widgetCtx());
    expect(body).not.toMatch(/<script[\s>]/i);
  });

  // (r) no `http://` or `https://` URL appears in any <link>, <script>, or @import
  it('no remote http/https references in <link>, <script>, or @import (AC-3.2)', () => {
    const body = runHtml(buildAtlas([]), widgetCtx());
    expect(body).not.toMatch(/<link[^>]*https?:\/\//i);
    expect(body).not.toMatch(/<script[^>]*https?:\/\//i);
    expect(body).not.toMatch(/@import[^;]*https?:\/\//i);
  });
});
