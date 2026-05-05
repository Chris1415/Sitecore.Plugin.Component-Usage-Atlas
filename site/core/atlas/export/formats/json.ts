// T019 — JSON adapter for the Atlas export.
//
// Emits the full data envelope per PRD-001 § 10.1:
//   - top-level header keys (declared order)
//   - `format: 'json'` (slotted in at the documented position, between
//     `surface` and `exported_at`)
//   - `body: WidgetBody | PanelBody`
//
// Determinism contracts (IS-14 / AC-4.1 / § 10.4 / DoD-3):
//   - widget `body.renderings[]` sorted by `rendering_id` ASC
//   - widget rendering `pages[]` sorted by `page_id` ASC
//   - widget rendering `datasources[]` sorted by `datasource_id` ASC
//   - widget datasource `pages[]` sorted by `page_id` ASC
//   - panel `cross_tenant_pages[]` sorted by `page_id` ASC
//   - `skipped_pages[]` sorted by `page_id` ASC (header builder
//     receives them in input order; we sort here at the adapter layer
//     to keep the contract local)
//
// Module size cap: ≤ 300 LOC (NFR-5.1).

import type { Atlas, PageRef, RenderingUsage, DatasourceUsage } from '@/lib/sdk/types';

import type { SurfaceContext } from '../surface-context';
import type { AtlasExportHeader } from '../header-builder';

export interface JsonAdapterResult {
  readonly body: string;
  readonly mime: 'application/json';
}

interface JsonPageRef {
  readonly page_id: string;
  readonly page_name: string;
  readonly site_path: string;
  readonly site_id: string;
  readonly site_name: string;
  readonly language: string;
  readonly collection_id?: string;
}

interface JsonWidgetDatasource {
  readonly datasource_id: string;
  readonly display_name: string | null;
  readonly pages: ReadonlyArray<JsonPageRef>;
}

interface JsonWidgetRendering {
  readonly rendering_id: string;
  readonly display_name: string;
  readonly total_usages: number;
  readonly distinct_pages: number;
  readonly last_seen_update: string | null;
  readonly pages: ReadonlyArray<JsonPageRef>;
  readonly datasources: ReadonlyArray<JsonWidgetDatasource>;
}

interface JsonWidgetBody {
  readonly renderings: ReadonlyArray<JsonWidgetRendering>;
}

interface JsonPanelBoundDatasource {
  readonly datasource_id: string;
  readonly display_name: string | null;
  readonly path: string | null;
  readonly cross_tenant_page_count: number;
  readonly cross_tenant_pages: ReadonlyArray<JsonPageRef>;
}

interface JsonPanelRendering {
  readonly rendering_id: string;
  readonly display_name: string;
  readonly parameters: Record<string, string> | null;
  readonly cross_tenant_page_count: number;
  readonly cross_tenant_pages: ReadonlyArray<JsonPageRef>;
  readonly bound_datasource: JsonPanelBoundDatasource | null;
}

interface JsonPanelBody {
  readonly page: JsonPageRef;
  readonly renderings: ReadonlyArray<JsonPanelRendering>;
}

function toJsonPage(p: PageRef, language: string): JsonPageRef {
  // `language` is not on `PageRef` per the project domain types — it
  // comes from the surface (the panel knows the active language; the
  // widget passes the scan's first language as a sentinel). Per
  // § 10.1, page refs in widget bodies still carry a `language` field;
  // we resolve from surfaceContext.languagesScanned[0] as the default.
  return {
    page_id: p.pageId,
    page_name: p.pageName,
    site_path: p.sitePath,
    site_id: p.siteId,
    site_name: p.siteName,
    language,
  };
}

function sortPages(pages: ReadonlyArray<JsonPageRef>): JsonPageRef[] {
  return pages.slice().sort((a, b) => a.page_id.localeCompare(b.page_id));
}

function sortByKey<T>(items: ReadonlyArray<T>, key: (t: T) => string): T[] {
  return items.slice().sort((a, b) => key(a).localeCompare(key(b)));
}

/**
 * Build the widget surface body. Reads from `atlas.renderingIndex` +
 * `atlas.datasourceIndex` (ADR-0010) and emits one entry per rendering
 * with embedded pages and per-rendering datasources. All arrays sorted
 * deterministically per § 10.4.
 */
function buildWidgetBody(atlas: Atlas, language: string): JsonWidgetBody {
  const renderings: JsonWidgetRendering[] = [];
  for (const usage of atlas.renderingIndex.values()) {
    const pages = sortPages(
      usage.pages.map((p) => withCollectionId(toJsonPage(p, language), p)),
    );
    const datasources = sortByKey(
      usage.datasources.map((dsId) => buildWidgetDatasource(dsId, atlas, language)),
      (d) => d.datasource_id,
    );
    renderings.push({
      rendering_id: usage.renderingId,
      display_name: usage.displayName,
      total_usages: usage.totalUsages,
      distinct_pages: pages.length,
      last_seen_update: null,
      pages,
      datasources,
    });
  }
  return {
    renderings: sortByKey(renderings, (r) => r.rendering_id),
  };
}

function buildWidgetDatasource(
  dsId: string,
  atlas: Atlas,
  language: string,
): JsonWidgetDatasource {
  const ds = atlas.datasourceIndex.get(dsId);
  const pages = ds
    ? sortPages(ds.pages.map((p) => withCollectionId(toJsonPage(p, language), p)))
    : [];
  return {
    datasource_id: dsId,
    display_name: ds ? ds.displayName : null,
    pages,
  };
}

/**
 * Optionally attach `collection_id` to a JsonPageRef when the source
 * `PageRef` carried it. Object spread preserves the declared key
 * order: collection_id is the LAST field in PageRef per § 10.1.
 */
function withCollectionId(
  ref: JsonPageRef,
  src: PageRef & { collectionId?: string },
): JsonPageRef {
  if (src.collectionId !== undefined) {
    return { ...ref, collection_id: src.collectionId };
  }
  return ref;
}

/**
 * Build the panel surface body. Reads the current page from the
 * SurfaceContext (clone) and computes cross-tenant pages per
 * rendering by EXCLUDING the panel page from the rendering's full
 * page list.
 */
function buildPanelBody(
  atlas: Atlas,
  ctx: SurfaceContext,
  language: string,
): JsonPanelBody {
  const panelPage = ctx.panelPage;
  if (panelPage === undefined) {
    // Defensive — caller should have validated. Emit a synthetic
    // empty panel body so the JSON still parses; tests cover the
    // panelPage-present path.
    throw new Error('buildPanelBody: panel surface requires ctx.panelPage');
  }

  const page: JsonPageRef = {
    page_id: panelPage.pageId,
    page_name: panelPage.pageName,
    site_path: panelPage.sitePath,
    site_id: panelPage.siteId,
    site_name: panelPage.siteName,
    language: panelPage.language,
    ...(panelPage.collectionId !== undefined ? { collection_id: panelPage.collectionId } : {}),
  };

  const renderings: JsonPanelRendering[] = [];
  for (const usage of atlas.renderingIndex.values()) {
    const cross = sortPages(
      usage.pages
        .filter((p) => p.pageId !== panelPage.pageId)
        .map((p) => withCollectionId(toJsonPage(p, language), p)),
    );
    renderings.push({
      rendering_id: usage.renderingId,
      display_name: usage.displayName,
      parameters: null,
      cross_tenant_page_count: cross.length,
      cross_tenant_pages: cross,
      bound_datasource: buildPanelBoundDatasource(usage, atlas, panelPage.pageId, language),
    });
  }

  return {
    page,
    renderings: sortByKey(renderings, (r) => r.rendering_id),
  };
}

function buildPanelBoundDatasource(
  rendering: RenderingUsage,
  atlas: Atlas,
  panelPageId: string,
  language: string,
): JsonPanelBoundDatasource | null {
  const dsId = rendering.datasources[0];
  if (dsId === undefined) return null;
  const ds: DatasourceUsage | undefined = atlas.datasourceIndex.get(dsId);
  if (ds === undefined) return null;
  const cross = sortPages(
    ds.pages
      .filter((p) => p.pageId !== panelPageId)
      .map((p) => withCollectionId(toJsonPage(p, language), p)),
  );
  return {
    datasource_id: dsId,
    display_name: ds.displayName,
    path: null,
    cross_tenant_page_count: cross.length,
    cross_tenant_pages: cross,
  };
}

/**
 * JSON adapter — emits the full export envelope in PRD-001 § 10.1
 * declared key order. The header is interpolated as-is at the top
 * (preserving its declared order); `format: 'json'` slots in between
 * `surface` and `exported_at`; sorted `skipped_pages` follow at the
 * documented position; finally `body` closes the envelope.
 */
export function jsonAdapter(
  atlas: Atlas,
  ctx: SurfaceContext,
  header: AtlasExportHeader,
): JsonAdapterResult {
  const language = ctx.languagesScanned[0] ?? 'en';

  // Sort skipped_pages here at the adapter (the header builder
  // preserves the input order; deterministic sort lives at the format
  // layer per § 10.4).
  const skipped_pages = header.skipped_pages
    .slice()
    .sort((a, b) => a.page_id.localeCompare(b.page_id));

  const body: JsonWidgetBody | JsonPanelBody =
    ctx.surface === 'panel'
      ? buildPanelBody(atlas, ctx, language)
      : buildWidgetBody(atlas, language);

  // Top-level envelope in declared § 10.1 order:
  //   atlas_export_schema_version, surface, format, exported_at,
  //   scan_timestamp, is_partial, partial_info?, tenant, scope,
  //   languages_scanned, totals, skipped_pages, body
  const envelope: Record<string, unknown> = {
    atlas_export_schema_version: header.atlas_export_schema_version,
    surface: header.surface,
    format: 'json',
    exported_at: header.exported_at,
    scan_timestamp: header.scan_timestamp,
    is_partial: header.is_partial,
  };
  if (header.partial_info !== undefined) {
    envelope.partial_info = header.partial_info;
  }
  envelope.tenant = header.tenant;
  envelope.scope = header.scope;
  envelope.languages_scanned = header.languages_scanned;
  envelope.totals = header.totals;
  envelope.skipped_pages = skipped_pages;
  envelope.body = body;

  return {
    body: JSON.stringify(envelope, null, 2),
    mime: 'application/json',
  };
}
