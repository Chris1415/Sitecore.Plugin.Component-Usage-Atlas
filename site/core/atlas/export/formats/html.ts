// T023 — HTML adapter for the Atlas export.
//
// Emits a single self-contained HTML document per PRD-001 § 10.3 + UI
// design § 4.7:
//   - <!doctype html> + <html lang="en">
//   - <head> with charset, title, inlined <style> (screen + print CSS).
//   - <body> with <header> (h1 + <dl class="summary"> + optional
//     partial-scan badge), <main> (<table> with lite columns + optional
//     skipped + empty-state paragraphs), <footer> (schema version +
//     attribution).
//
// Safety contracts:
//   - R6 / OQ-9 XSS guard: every interpolated string passes through
//     `escapeHtml()` (5-entity escape: & < > " '). Applies to both
//     text-context AND attribute-context (case (s) in T024).
//   - No <script> tags (NFR-4.3). No remote assets / fonts (AC-3.2).
//     Inlined `system-ui` fallback chain only.
//   - Tenant fallback per ADR-0020: when `ctx.tenant.tenantName === null`,
//     summary <dd> renders `tenant-${tenantId.slice(-7)}`. JSON keeps
//     `null`; CSV/HTML synthesize the fallback string.
//   - Schema version constant (ADR-0019) is read via
//     `header.atlas_export_schema_version` — no literal `1` appears here.
//
// Print stylesheet exactly per UI design § 4.7.6:
//   body { font: 11pt/1.4 system-ui, sans-serif; }
//   table { font-size: 10pt; }
//   thead { display: table-header-group; }
//   tr { page-break-inside: avoid; }
//   .badge-partial { print-color-adjust: exact; }
//
// Color tokens are inlined hex values per UI design § 4.7.3 — derived
// from Blok tokens (cited inline in `app/globals.css`).
//
// Module size cap: ≤ 300 LOC (NFR-5.1). Inline CSS counts toward the
// budget — keep concise.

import type { Atlas, RenderingUsage, DatasourceUsage } from '@/lib/sdk/types';
import type { SurfaceContext } from '../surface-context';
import type { AtlasExportHeader } from '../header-builder';

export interface HtmlAdapterResult {
  readonly body: string;
  readonly mime: 'text/html;charset=utf-8';
}

/**
 * 5-entity HTML escape — covers both text-context and attribute-context
 * (R6 XSS guard, T024 case (s)). Single-quote -> `&#39;` (numeric ref
 * works in all HTML5 parsers; `&apos;` is XML-only).
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tenant display name with ADR-0020 fallback for the summary <dd>. */
function tenantDisplayName(header: AtlasExportHeader): string {
  const { tenant_id, tenant_name } = header.tenant;
  if (tenant_name === null) return `tenant-${tenant_id.slice(-7)}`;
  return tenant_name;
}

function scopeLabel(header: AtlasExportHeader): string {
  const s = header.scope;
  if (s.kind === 'all-collections') return 'all collections';
  if (s.collection_name !== undefined) return `collection: ${s.collection_name}`;
  if (s.collection_id !== undefined) return `collection: ${s.collection_id}`;
  return 'collection';
}

/**
 * Inlined screen + print stylesheet. Hex values cite line numbers in
 * `app/globals.css` to track Blok-token provenance per UI design § 4.7.3.
 */
function buildStyle(): string {
  return [
    '<style>',
    // Screen — system-ui fallback only (no remote fonts; NFR-4.3).
    'body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1a1a1a; margin: 24px; }', // globals.css:14 (--foreground)
    'h1 { font-size: 1.5rem; margin: 0 0 16px; }',
    'dl.summary { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0 0 24px; }',
    'dl.summary dt { font-weight: 600; color: #4a4a4a; }', // globals.css:21 (--muted-foreground)
    'dl.summary dd { margin: 0; }',
    '.badge-partial { display: inline-block; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 0.875rem; print-color-adjust: exact; }', // globals.css:33 (--warning)
    'table { width: 100%; border-collapse: collapse; margin: 0 0 16px; }',
    'th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e5e5; }', // globals.css:25 (--border)
    'th { background: #f5f5f5; font-weight: 600; }', // globals.css:18 (--muted)
    'p.empty-state { color: #4a4a4a; font-style: italic; }',
    'p.if-skipped { color: #92400e; font-size: 0.875rem; }',
    'footer { margin-top: 24px; color: #4a4a4a; font-size: 0.75rem; }',
    // Print — § 4.7.6 exact rules.
    '@media print {',
    '  body { font: 11pt/1.4 system-ui, sans-serif; margin: 0.5in; }',
    '  table { font-size: 10pt; }',
    '  thead { display: table-header-group; }',
    '  tr { page-break-inside: avoid; }',
    '  .badge-partial { print-color-adjust: exact; -webkit-print-color-adjust: exact; }',
    '}',
    '</style>',
  ].join('\n');
}

/**
 * Build the `<dl class="summary">` block. Field order matches § 10.3.
 */
function buildSummary(ctx: SurfaceContext, header: AtlasExportHeader): string {
  const rows: string[] = [
    `<dt>Tenant</dt><dd>${escapeHtml(tenantDisplayName(header))}</dd>`,
    `<dt>Surface</dt><dd>${escapeHtml(header.surface)}</dd>`,
    `<dt>Scope</dt><dd>${escapeHtml(scopeLabel(header))}</dd>`,
    `<dt>Languages scanned</dt><dd>${escapeHtml(header.languages_scanned.join(', '))}</dd>`,
  ];
  if (header.surface === 'panel' && ctx.panelPage !== undefined) {
    rows.push(
      `<dt>Page</dt><dd>${escapeHtml(ctx.panelPage.pageName)} (${escapeHtml(ctx.panelPage.pageId)})</dd>`,
    );
  }
  rows.push(
    `<dt>Scan timestamp</dt><dd>${escapeHtml(header.scan_timestamp)}</dd>`,
    `<dt>Exported at</dt><dd>${escapeHtml(header.exported_at)}</dd>`,
    `<dt>Sites</dt><dd>${header.totals.sites}</dd>`,
    `<dt>Pages</dt><dd>${header.totals.pages}</dd>`,
    `<dt>Renderings</dt><dd>${header.totals.renderings}</dd>`,
    `<dt>Datasources</dt><dd>${header.totals.datasources}</dd>`,
  );
  if (header.is_partial) {
    const info = header.partial_info;
    const summary = info ? `${info.pages_scanned} of ${info.pages_total} pages` : 'pages';
    rows.push(
      `<dt class="if-partial">Partial scan</dt><dd><span class="badge-partial">Partial scan — ${escapeHtml(summary)}</span></dd>`,
    );
  }
  return `<dl class="summary">${rows.join('')}</dl>`;
}

/**
 * Build the widget table — lite columns matching CSV widget shape.
 */
function buildWidgetTable(atlas: Atlas): string {
  const renderings: RenderingUsage[] = Array.from(atlas.renderingIndex.values()).slice();
  renderings.sort((a, b) => a.renderingId.localeCompare(b.renderingId));

  const rows = renderings
    .map((r) => {
      const distinctPages = new Set(r.pages.map((p) => p.pageId)).size;
      return `<tr><td>${escapeHtml(r.renderingId)}</td><td>${escapeHtml(r.displayName)}</td><td>${r.totalUsages}</td><td>${distinctPages}</td><td></td></tr>`;
    })
    .join('');

  return [
    '<table>',
    '<thead><tr><th>rendering_id</th><th>display_name</th><th>total_usages</th><th>distinct_pages</th><th>last_seen_update</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
  ].join('');
}

/**
 * Build the panel table — lite columns matching CSV panel shape.
 */
function buildPanelTable(atlas: Atlas, ctx: SurfaceContext): string {
  const panelPageId = ctx.panelPage?.pageId;
  const renderings: RenderingUsage[] = Array.from(atlas.renderingIndex.values()).slice();
  renderings.sort((a, b) => a.renderingId.localeCompare(b.renderingId));

  const rows = renderings
    .map((r) => {
      const crossRendering = panelPageId
        ? r.pages.filter((p) => p.pageId !== panelPageId).length
        : r.pages.length;
      const dsId = r.datasources[0];
      const ds: DatasourceUsage | undefined = dsId
        ? atlas.datasourceIndex.get(dsId)
        : undefined;
      const dsIdCell = dsId ? escapeHtml(dsId) : '';
      const dsNameCell = ds ? escapeHtml(ds.displayName) : '';
      const crossDsCell =
        ds && panelPageId
          ? ds.pages.filter((p) => p.pageId !== panelPageId).length
          : ds
            ? ds.pages.length
            : '';
      return `<tr><td>${escapeHtml(r.renderingId)}</td><td>${escapeHtml(r.displayName)}</td><td>${dsIdCell}</td><td>${dsNameCell}</td><td>${crossRendering}</td><td>${crossDsCell}</td></tr>`;
    })
    .join('');

  return [
    '<table>',
    '<thead><tr><th>rendering_id</th><th>rendering_display_name</th><th>datasource_id</th><th>datasource_display_name</th><th>cross_tenant_rendering_pages</th><th>cross_tenant_datasource_pages</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
  ].join('');
}

/**
 * HTML adapter — emits the canonical export per § 10.3.
 *
 * Output contract (load-bearing):
 *   - Begins with `<!doctype html>`, ends with `</html>`.
 *   - <title> includes tenant + surface (both escaped).
 *   - Every interpolated string passes `escapeHtml()`.
 *   - No <script> elements anywhere; no remote http/https references.
 *   - <style> contains both screen and `@media print` blocks.
 */
export function htmlAdapter(
  atlas: Atlas,
  ctx: SurfaceContext,
  header: AtlasExportHeader,
): HtmlAdapterResult {
  const tenantLabel = tenantDisplayName(header);
  const title = `Atlas snapshot — ${escapeHtml(tenantLabel)} — ${escapeHtml(header.surface)}`;

  const summary = buildSummary(ctx, header);
  const table =
    header.surface === 'panel' ? buildPanelTable(atlas, ctx) : buildWidgetTable(atlas);

  const skippedParagraph =
    header.skipped_pages.length > 0
      ? `<p class="if-skipped">${header.skipped_pages.length} pages skipped: ${escapeHtml(header.skipped_pages.map((s) => s.page_id).join(', '))}</p>`
      : '';

  const emptyParagraph =
    atlas.renderingIndex.size === 0
      ? `<p class="empty-state if-empty">(No renderings found.)</p>`
      : '';

  const schemaFooter = `<small>Schema version ${header.atlas_export_schema_version} — generated by Component Usage Atlas.</small>`;

  const body = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${title}</title>`,
    buildStyle(),
    '</head>',
    '<body>',
    '<header>',
    '<h1>Atlas snapshot</h1>',
    summary,
    '</header>',
    '<main>',
    table,
    skippedParagraph,
    emptyParagraph,
    '</main>',
    '<footer>',
    schemaFooter,
    '</footer>',
    '</body>',
    '</html>',
  ]
    .filter((s) => s.length > 0)
    .join('\n');

  return {
    body,
    mime: 'text/html;charset=utf-8',
  };
}
