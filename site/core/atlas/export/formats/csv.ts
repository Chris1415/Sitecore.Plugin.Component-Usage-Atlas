// T021 — CSV adapter for the Atlas export.
//
// Emits the lite (one-row-per-rendering) CSV per PRD-001 § 10.2:
//   - 9- or 10-line `#`-prefixed comment header block (10 when skipped
//     pages present; 9 otherwise) — declared key order matches the §
//     10.2 spec block.
//   - Column header row (5 cols widget; 6 cols panel).
//   - Data rows in deterministic order (rendering_id ASC).
//   - Optional `# skipped_pages: <count>` footer.
//
// Determinism contracts (IS-14 / AC-4.1 / § 10.4 / DoD-3):
//   - widget rows sorted by rendering_id ASC.
//   - panel rows sorted by rendering_id ASC.
//
// Safety contracts:
//   - RFC 4180 quoting: any string field containing `,`, `"`, `\r`,
//     `\n` is wrapped in `"..."` with internal `"` doubled.
//   - R4 / OQ-9 formula-injection guard: any string field whose first
//     char is `=`, `+`, `-`, `@` gets a leading `'` prepended. Numeric
//     fields are NOT guarded (regression case (p) — `0` ≠ `'0`).
//   - Tenant fallback per ADR-0020: when `ctx.tenant.tenantName === null`,
//     the `# Tenant:` line renders `tenant-${tenantId.slice(-7)}`. JSON
//     keeps the literal `null`; CSV/HTML synthesize the fallback string.
//   - UTF-8 NO BOM (FR-2.2). The output is a plain JS string; the
//     consumer wraps it in a Blob with `text/csv;charset=utf-8`. We
//     never prepend `\uFEFF`.
//
// Schema version constant (ADR-0019) is read via `header.atlas_export_schema_version`,
// which the header builder sources from `../schema-version`. No literal
// `1` appears here.
//
// Module size cap: ≤ 300 LOC (NFR-5.1).

import type { Atlas, RenderingUsage, DatasourceUsage } from '@/lib/sdk/types';
import type { SurfaceContext } from '../surface-context';
import type { AtlasExportHeader } from '../header-builder';

export interface CsvAdapterResult {
  readonly body: string;
  readonly mime: 'text/csv;charset=utf-8';
}

const WIDGET_COLUMNS = [
  'rendering_id',
  'display_name',
  'total_usages',
  'distinct_pages',
  'last_seen_update',
] as const;

const PANEL_COLUMNS = [
  'rendering_id',
  'rendering_display_name',
  'datasource_id',
  'datasource_display_name',
  'cross_tenant_rendering_pages',
  'cross_tenant_datasource_pages',
] as const;

/**
 * Resolve the tenant display name for the CSV `# Tenant:` line.
 * ADR-0020: CSV uses the fallback string when the SDK lacked the name;
 * JSON keeps `null` so tooling can detect the fallback case.
 */
function tenantDisplayName(header: AtlasExportHeader): string {
  const { tenant_id, tenant_name } = header.tenant;
  if (tenant_name === null) {
    return `tenant-${tenant_id.slice(-7)}`;
  }
  return tenant_name;
}

/**
 * Render the human-readable scope label for the `# Scope:` line.
 * `all-collections` → `all collections`;
 * `collection` with name → `collection: <name>`;
 * `collection` without name → `collection: <id>`.
 */
function scopeLabel(header: AtlasExportHeader): string {
  const s = header.scope;
  if (s.kind === 'all-collections') return 'all collections';
  if (s.collection_name !== undefined) return `collection: ${s.collection_name}`;
  if (s.collection_id !== undefined) return `collection: ${s.collection_id}`;
  return 'collection';
}

/**
 * RFC 4180 quoting + R4 formula-injection guard for string fields.
 * Numeric fields call `formatNumberField` instead — they bypass the
 * injection guard entirely (regression case (p) / (q) in T022).
 */
function formatStringField(value: string): string {
  // R4 guard FIRST — apply before quoting so the quoted form contains
  // the leading apostrophe inside the quotes, matching Excel's rule.
  let v = value;
  if (v.length > 0) {
    const first = v.charCodeAt(0);
    // 0x3D = '=', 0x2B = '+', 0x2D = '-', 0x40 = '@'
    if (first === 0x3d || first === 0x2b || first === 0x2d || first === 0x40) {
      v = `'${v}`;
    }
  }
  // RFC 4180 quoting: wrap in quotes if the field contains any of
  // `,`, `"`, `\r`, `\n`. Inside quotes, double each `"`.
  if (/[,"\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/**
 * Numeric fields serialize via toString() and bypass the R4 guard.
 * Negative numbers are NOT prefixed with `'` — they are typed numbers,
 * not strings. JSON-spec NaN / Infinity are serialized as empty (the
 * shape is `number` so this should never happen).
 */
function formatNumberField(value: number): string {
  if (Number.isFinite(value)) return value.toString();
  return '';
}

/**
 * Empty-string field — emitted as-is (no quoting, no guard).
 */
function emptyField(): string {
  return '';
}

/**
 * Build the `#`-prefixed comment header block per § 10.2.
 * Widget = 9 base lines; panel = 9 base lines + 1 `# Page:` line.
 * Skipped-pages footer is emitted separately at the end of the body.
 */
function buildCommentBlock(ctx: SurfaceContext, header: AtlasExportHeader): string[] {
  const lines: string[] = [
    '# Atlas snapshot',
    `# Tenant: ${tenantDisplayName(header)} (${header.tenant.tenant_id})`,
    `# Surface: ${header.surface}`,
    `# Scope: ${scopeLabel(header)}`,
    `# Languages scanned: ${header.languages_scanned.join(',')}`,
  ];

  // Panel-only `# Page:` line — per § 10.2 it slots between Languages
  // scanned and Scan timestamp.
  if (header.surface === 'panel' && ctx.panelPage !== undefined) {
    lines.push(`# Page: ${ctx.panelPage.pageName} (${ctx.panelPage.pageId})`);
  }

  lines.push(
    `# Scan timestamp: ${header.scan_timestamp}`,
    `# Exported at: ${header.exported_at}`,
    `# Schema version: ${header.atlas_export_schema_version}`,
    `# Partial: ${header.is_partial}`,
  );
  return lines;
}

/**
 * Build widget data rows. One row per rendering, sorted by rendering_id ASC.
 * `last_seen_update` is empty (the model doesn't track this — adapter
 * keeps the column reserved for forward compatibility per § 10.2).
 */
function buildWidgetRows(atlas: Atlas): string[] {
  const renderings: RenderingUsage[] = Array.from(atlas.renderingIndex.values()).slice();
  renderings.sort((a, b) => a.renderingId.localeCompare(b.renderingId));

  return renderings.map((r) => {
    // distinct_pages = unique page IDs in `r.pages`
    const distinctPages = new Set(r.pages.map((p) => p.pageId)).size;
    const fields: string[] = [
      formatStringField(r.renderingId),
      formatStringField(r.displayName),
      formatNumberField(r.totalUsages),
      formatNumberField(distinctPages),
      emptyField(), // last_seen_update — reserved
    ];
    return fields.join(',');
  });
}

/**
 * Build panel data rows. One row per rendering, sorted by rendering_id ASC.
 * Cross-tenant counters EXCLUDE the panel page (parity with JSON adapter
 * `buildPanelBody` filter). Datasource columns are empty when no
 * datasource is bound to the rendering.
 */
function buildPanelRows(atlas: Atlas, ctx: SurfaceContext): string[] {
  const panelPageId = ctx.panelPage?.pageId;
  const renderings: RenderingUsage[] = Array.from(atlas.renderingIndex.values()).slice();
  renderings.sort((a, b) => a.renderingId.localeCompare(b.renderingId));

  return renderings.map((r) => {
    const crossRendering = panelPageId
      ? r.pages.filter((p) => p.pageId !== panelPageId).length
      : r.pages.length;

    // First bound datasource — parity with JSON `buildPanelBoundDatasource`
    const dsId = r.datasources[0];
    const ds: DatasourceUsage | undefined = dsId ? atlas.datasourceIndex.get(dsId) : undefined;

    const dsIdField = dsId ? formatStringField(dsId) : emptyField();
    const dsNameField = ds ? formatStringField(ds.displayName) : emptyField();
    const crossDsField =
      ds && panelPageId
        ? formatNumberField(ds.pages.filter((p) => p.pageId !== panelPageId).length)
        : ds
          ? formatNumberField(ds.pages.length)
          : emptyField();

    const fields: string[] = [
      formatStringField(r.renderingId),
      formatStringField(r.displayName),
      dsIdField,
      dsNameField,
      formatNumberField(crossRendering),
      crossDsField,
    ];
    return fields.join(',');
  });
}

/**
 * CSV adapter — emits the full lite-form export per § 10.2.
 *
 * Output structure:
 *   <comment block — 9 or 10 # lines>
 *   <column header row>
 *   <data rows — sorted by rendering_id ASC>
 *   <optional `# skipped_pages: N` footer>
 *
 * NEVER prepends a UTF-8 BOM. Returned MIME is `text/csv;charset=utf-8`.
 */
export function csvAdapter(
  atlas: Atlas,
  ctx: SurfaceContext,
  header: AtlasExportHeader,
): CsvAdapterResult {
  const commentLines = buildCommentBlock(ctx, header);
  const columnRow = (header.surface === 'panel' ? PANEL_COLUMNS : WIDGET_COLUMNS).join(',');
  const dataRows =
    header.surface === 'panel' ? buildPanelRows(atlas, ctx) : buildWidgetRows(atlas);

  const lines: string[] = [...commentLines, columnRow, ...dataRows];

  if (header.skipped_pages.length > 0) {
    lines.push(`# skipped_pages: ${header.skipped_pages.length}`);
  }

  return {
    body: lines.join('\n'),
    mime: 'text/csv;charset=utf-8',
  };
}
