// T014 — RED unit tests for `core/atlas/export/filename-builder.ts`
// (lifts to GREEN at T013).
//
// Per § 10 T014 + PRD-001 § 9.4 + ADR-0020: 10 cases covering each slug
// rule, both fallback paths (tenant fallback, page-name fallback), the
// 200-char cap, the ISO-compact timestamp form, the format-extension
// switch, and the IS-17 collision suffix.
//
// SDK fixture provenance: N/A — `TenantIdentity` is a project-internal
// type (re-exported from `core/tenant-identity.ts`), not a raw SDK shape.

import { describe, it, expect } from 'vitest';
import { buildFilename } from '@/core/atlas/export/filename-builder';
import type { TenantIdentity } from '@/core/tenant-identity';

const tenantWithName: TenantIdentity = {
  tenantId: 'org-acme-tenant-9f8e7d6',
  tenantName: 'Acme',
};

const tenantNoName: TenantIdentity = {
  tenantId: 'org-mystery-tenant-abcd123',
  tenantName: null,
};

const SCAN_TS = '2026-05-03T10:14:41Z';
const SCAN_TS_COMPACT = '20260503T101441Z';

describe('buildFilename', () => {
  it('widget all-collections, tenant name present', () => {
    const name = buildFilename({
      tenant: tenantWithName,
      surface: 'widget',
      scopeKind: 'all-collections',
      scanTimestamp: SCAN_TS,
      format: 'json',
    });
    expect(name).toBe(`atlas-acme-widget-all-collections-${SCAN_TS_COMPACT}.json`);
  });

  it('widget collection scope (IS-17 collision suffix from collectionId)', () => {
    const name = buildFilename({
      tenant: tenantWithName,
      surface: 'widget',
      scopeKind: 'collection',
      scopeCollectionName: 'Marketing',
      scopeCollectionId: 'col-id-3a8f2bc',
      scanTimestamp: SCAN_TS,
      format: 'json',
    });
    expect(name).toBe(`atlas-acme-widget-marketing-3a8f2bc-${SCAN_TS_COMPACT}.json`);
  });

  it('tenant fallback when SDK lacks name (ADR-0020)', () => {
    const name = buildFilename({
      tenant: tenantNoName,
      surface: 'widget',
      scopeKind: 'all-collections',
      scanTimestamp: SCAN_TS,
      format: 'json',
    });
    // last-7 of tenantId 'org-mystery-tenant-abcd123' is 'abcd123'
    expect(name).toBe(`atlas-tenant-abcd123-widget-all-collections-${SCAN_TS_COMPACT}.json`);
  });

  it('panel page name present', () => {
    const name = buildFilename({
      tenant: tenantWithName,
      surface: 'panel',
      scopeKind: 'all-collections',
      scanTimestamp: SCAN_TS,
      pageName: 'Home Page',
      pageId: 'page-id-9f8e7d6',
      format: 'html',
    });
    expect(name).toBe(`atlas-acme-panel-home-page-${SCAN_TS_COMPACT}.html`);
  });

  it('panel page name missing → page-${last7} fallback', () => {
    const name = buildFilename({
      tenant: tenantWithName,
      surface: 'panel',
      scopeKind: 'all-collections',
      scanTimestamp: SCAN_TS,
      pageId: 'page-id-9f8e7d6',
      format: 'html',
    });
    expect(name).toBe(`atlas-acme-panel-page-9f8e7d6-${SCAN_TS_COMPACT}.html`);
  });

  it('80-char page name truncates to 60 chars + -${pageId.slice(-7)}', () => {
    // 80-char page name (a × 80)
    const longName = 'a'.repeat(80);
    const pageId = 'page-id-1234567';
    const name = buildFilename({
      tenant: tenantWithName,
      surface: 'panel',
      scopeKind: 'all-collections',
      scanTimestamp: SCAN_TS,
      pageName: longName,
      pageId,
      format: 'html',
    });
    // Expected: page slug = 60 'a' + '-1234567'
    const expectedPageSlug = 'a'.repeat(60) + '-1234567';
    expect(name).toBe(`atlas-acme-panel-${expectedPageSlug}-${SCAN_TS_COMPACT}.html`);
  });

  it('total filename length is always ≤ 200 chars even with very-long inputs', () => {
    const veryLongName = 'x'.repeat(300);
    const veryLongCollection = 'y'.repeat(300);
    const name = buildFilename({
      tenant: tenantWithName,
      surface: 'panel',
      scopeKind: 'collection',
      scopeCollectionName: veryLongCollection,
      scopeCollectionId: 'col-9f8e7d6',
      scanTimestamp: SCAN_TS,
      pageName: veryLongName,
      pageId: 'page-id-1234567',
      format: 'html',
    });
    expect(name.length).toBeLessThanOrEqual(200);
  });

  it('timestamp segment is compact YYYYMMDDTHHMMSSZ (no `:` or `-` inside the timestamp)', () => {
    const name = buildFilename({
      tenant: tenantWithName,
      surface: 'widget',
      scopeKind: 'all-collections',
      scanTimestamp: '2026-12-31T23:59:00Z',
      format: 'csv',
    });
    expect(name).toContain('20261231T235900Z');
    expect(name).not.toContain('2026-12-31T23:59');
  });

  it('format extension switches between .json / .csv / .html', () => {
    const base = {
      tenant: tenantWithName,
      surface: 'widget' as const,
      scopeKind: 'all-collections' as const,
      scanTimestamp: SCAN_TS,
    };
    expect(buildFilename({ ...base, format: 'json' })).toMatch(/\.json$/);
    expect(buildFilename({ ...base, format: 'csv' })).toMatch(/\.csv$/);
    expect(buildFilename({ ...base, format: 'html' })).toMatch(/\.html$/);
  });

  it('IS-17 collision suffix: two collections with identical names produce different filenames', () => {
    const a = buildFilename({
      tenant: tenantWithName,
      surface: 'widget',
      scopeKind: 'collection',
      scopeCollectionName: 'Site Group',
      scopeCollectionId: 'col-aaaaaa1',
      scanTimestamp: SCAN_TS,
      format: 'json',
    });
    const b = buildFilename({
      tenant: tenantWithName,
      surface: 'widget',
      scopeKind: 'collection',
      scopeCollectionName: 'Site Group',
      scopeCollectionId: 'col-bbbbbb2',
      scanTimestamp: SCAN_TS,
      format: 'json',
    });
    expect(a).not.toBe(b);
    expect(a).toContain('aaaaaa1');
    expect(b).toContain('bbbbbb2');
  });
});
