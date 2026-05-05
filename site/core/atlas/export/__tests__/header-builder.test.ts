// T012 — RED unit tests for `core/atlas/export/header-builder.ts`
// (lifts to GREEN at T011).
//
// Per § 10 T012: 7 cases. The header carries the canonical metadata
// block (PRD-001 § 10.1 top-level fields) in DECLARED ORDER (IS-14 /
// AC-4.1). Tests assert via `Object.keys(JSON.parse(JSON.stringify(...)))`
// — `toMatchObject` is NOT sufficient.
//
// `tenant.tenant_name` is `null` when SDK lacked the name (NOT the
// `tenant-<last-7>` fallback string — that synthesis lives in the
// filename builder per ADR-0020).
//
// SDK fixture provenance: N/A — header-builder consumes a project-internal
// `SurfaceContext`, not a raw SDK shape.

import { describe, it, expect } from 'vitest';
import { buildHeader } from '@/core/atlas/export/header-builder';
import { ATLAS_EXPORT_SCHEMA_VERSION } from '@/core/atlas/export/schema-version';
import type { SurfaceContext } from '@/core/atlas/export/surface-context';

const widgetCtx = (overrides: Partial<SurfaceContext> = {}): SurfaceContext => ({
  surface: 'widget',
  tenant: { tenantId: 'abc1234567', tenantName: 'Acme' },
  scope: { kind: 'all-collections' },
  languagesScanned: ['en'],
  scanTimestamp: '2026-05-03T10:14:41Z',
  isPartial: false,
  totals: { sites: 2, pages: 10, renderings: 5, datasources: 3 },
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

const EXPORTED_AT = '2026-05-03T11:00:00Z';

// Declared order per PRD-001 § 10.1. The `format` field is appended by
// the JSON adapter (T019), NOT by the header builder — so it's omitted
// from the header's key order. `partial_info` and `format` are slotted
// in at adapter layer / by the conditional flag.
//
// Header-builder declared order (header-only, no `body` / `format`):
//   atlas_export_schema_version
//   surface
//   exported_at
//   scan_timestamp
//   is_partial
//   partial_info?       (only when is_partial === true)
//   tenant
//   scope
//   languages_scanned
//   totals
//   skipped_pages
const HEADER_KEYS_NO_PARTIAL = [
  'atlas_export_schema_version',
  'surface',
  'exported_at',
  'scan_timestamp',
  'is_partial',
  'tenant',
  'scope',
  'languages_scanned',
  'totals',
  'skipped_pages',
];

const HEADER_KEYS_WITH_PARTIAL = [
  'atlas_export_schema_version',
  'surface',
  'exported_at',
  'scan_timestamp',
  'is_partial',
  'partial_info',
  'tenant',
  'scope',
  'languages_scanned',
  'totals',
  'skipped_pages',
];

describe('buildHeader', () => {
  it('widget header carries surface: "widget" and no panel-specific fields', () => {
    const header = buildHeader(widgetCtx(), EXPORTED_AT);
    expect(header.surface).toBe('widget');
    // header itself never carries page metadata — that's the body's job
    expect((header as unknown as { page?: unknown }).page).toBeUndefined();
  });

  it('panel header carries surface: "panel" and is body-agnostic', () => {
    const header = buildHeader(panelCtx(), EXPORTED_AT);
    expect(header.surface).toBe('panel');
    // header is surface-agnostic: caller (JSON adapter) appends body
    expect((header as unknown as { body?: unknown }).body).toBeUndefined();
  });

  it('partial scan emits is_partial: true and a populated partial_info', () => {
    const ctx = widgetCtx({
      isPartial: true,
      partialInfo: {
        pagesScanned: 4,
        pagesTotal: 10,
        cancelReason: 'user_canceled',
      },
    });
    const header = buildHeader(ctx, EXPORTED_AT);
    expect(header.is_partial).toBe(true);
    expect(header.partial_info).toEqual({
      pages_scanned: 4,
      pages_total: 10,
      cancel_reason: 'user_canceled',
    });
  });

  it('unchanged ctx + unchanged exportedAt produce byte-identical JSON output (DoD-3 / AC-4.4 prereq)', () => {
    const ctx = widgetCtx();
    const a = JSON.stringify(buildHeader(ctx, EXPORTED_AT));
    const b = JSON.stringify(buildHeader(ctx, EXPORTED_AT));
    expect(a).toBe(b);
  });

  it('tenant.tenant_name === null when ctx.tenant.tenantName === null (NOT fallback string)', () => {
    const ctx = widgetCtx({ tenant: { tenantId: 'abcdefg1234567', tenantName: null } });
    const header = buildHeader(ctx, EXPORTED_AT);
    expect(header.tenant.tenant_name).toBeNull();
    // explicit anti-fallback assertion: the synthesized `tenant-<last7>`
    // string MUST NOT appear at the header layer
    expect(header.tenant.tenant_name).not.toBe('tenant-1234567');
  });

  it('field order in stringified JSON matches § 10.1 declared order (no partial)', () => {
    const header = buildHeader(widgetCtx(), EXPORTED_AT);
    const keys = Object.keys(JSON.parse(JSON.stringify(header)));
    expect(keys).toEqual(HEADER_KEYS_NO_PARTIAL);
  });

  it('field order in stringified JSON matches § 10.1 declared order (with partial_info)', () => {
    const ctx = widgetCtx({
      isPartial: true,
      partialInfo: {
        pagesScanned: 4,
        pagesTotal: 10,
        cancelReason: 'timeout',
      },
    });
    const header = buildHeader(ctx, EXPORTED_AT);
    const keys = Object.keys(JSON.parse(JSON.stringify(header)));
    expect(keys).toEqual(HEADER_KEYS_WITH_PARTIAL);
  });

  it('atlas_export_schema_version reads 1 and is sourced from the imported constant (IS-13)', () => {
    const header = buildHeader(widgetCtx(), EXPORTED_AT);
    expect(header.atlas_export_schema_version).toBe(ATLAS_EXPORT_SCHEMA_VERSION);
    expect(header.atlas_export_schema_version).toBe(1);
  });
});
