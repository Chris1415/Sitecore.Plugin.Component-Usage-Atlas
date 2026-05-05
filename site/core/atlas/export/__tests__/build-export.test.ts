// T018 — RED unit tests for `core/atlas/export/build-export.ts`
// (lifts to GREEN at T017).
//
// Per § 10 T018: 6 cases. The orchestration entry point dispatches to
// format adapters, never touches the atlas-store singleton (ADR-0016
// purity), never calls `URL.createObjectURL` (that's the trigger's
// job), and produces byte-identical output for identical inputs (DoD-3
// / AC-4.4 prereq at the orchestration layer).
//
// Format adapters are mocked with `vi.mock`. The real adapters are
// PLACEHOLDERS in this batch (T019 lands the real JSON adapter; CSV +
// HTML adapters land in T021 / T023 — until then `buildExport` returns
// minimal valid output for those formats, so the orchestration layer is
// fully testable end-to-end).
//
// SDK fixture provenance: N/A — `Atlas` and `SurfaceContext` are
// project-internal types; no SDK shapes touched.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as atlasStoreModule from '@/core/atlas-store';
import { buildExport } from '@/core/atlas/export/build-export';
import type { Atlas } from '@/lib/sdk/types';
import type { SurfaceContext } from '@/core/atlas/export/surface-context';

const tinyAtlas = (): Atlas => ({
  scope: { kind: 'all-collections' },
  scannedAt: 1_700_000_000_000,
  isPartial: false,
  renderingIndex: new Map(),
  datasourceIndex: new Map(),
  skipped: [],
  totals: { sites: 0, pages: 0, renderings: 0, datasources: 0, skipped: 0 },
});

const widgetCtx = (): SurfaceContext => ({
  surface: 'widget',
  tenant: { tenantId: 'abc1234567', tenantName: 'Acme' },
  scope: { kind: 'all-collections' },
  languagesScanned: ['en'],
  scanTimestamp: '2026-05-03T10:14:41Z',
  isPartial: false,
  totals: { sites: 0, pages: 0, renderings: 0, datasources: 0 },
  skippedPages: [],
});

const EXPORTED_AT = '2026-05-03T11:00:00Z';

describe('buildExport', () => {
  let getSnapshotSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getSnapshotSpy = vi.spyOn(atlasStoreModule, 'getAtlasSnapshot');
    createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation(() => 'blob:test');
  });

  afterEach(() => {
    getSnapshotSpy.mockRestore();
    createObjectURLSpy.mockRestore();
  });

  it('JSON format produces a Blob with application/json MIME and a .json filename', async () => {
    const result = buildExport({
      atlas: tinyAtlas(),
      surface: 'widget',
      format: 'json',
      surfaceContext: widgetCtx(),
      exportedAt: EXPORTED_AT,
    });
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.type).toBe('application/json');
    expect(result.filename).toMatch(/\.json$/);
    // Body parses as JSON and contains the schema-version field
    const text = await result.blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.atlas_export_schema_version).toBe(1);
  });

  it('CSV format produces a Blob with text/csv;charset=utf-8 MIME and a .csv filename', () => {
    const result = buildExport({
      atlas: tinyAtlas(),
      surface: 'widget',
      format: 'csv',
      surfaceContext: widgetCtx(),
      exportedAt: EXPORTED_AT,
    });
    expect(result.blob.type).toBe('text/csv;charset=utf-8');
    expect(result.filename).toMatch(/\.csv$/);
  });

  it('HTML format produces a Blob with text/html;charset=utf-8 MIME and a .html filename', () => {
    const result = buildExport({
      atlas: tinyAtlas(),
      surface: 'widget',
      format: 'html',
      surfaceContext: widgetCtx(),
      exportedAt: EXPORTED_AT,
    });
    expect(result.blob.type).toBe('text/html;charset=utf-8');
    expect(result.filename).toMatch(/\.html$/);
  });

  it('does NOT call getAtlasSnapshot during construction (ADR-0016 purity)', () => {
    buildExport({
      atlas: tinyAtlas(),
      surface: 'widget',
      format: 'json',
      surfaceContext: widgetCtx(),
      exportedAt: EXPORTED_AT,
    });
    expect(getSnapshotSpy).not.toHaveBeenCalled();
  });

  it('does NOT call URL.createObjectURL during construction (trigger\'s job)', () => {
    buildExport({
      atlas: tinyAtlas(),
      surface: 'widget',
      format: 'json',
      surfaceContext: widgetCtx(),
      exportedAt: EXPORTED_AT,
    });
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('byte-identical: identical inputs produce Blob bodies with identical text (DoD-3 / AC-4.4 prereq)', async () => {
    const atlas = tinyAtlas();
    const ctx = widgetCtx();
    const a = buildExport({
      atlas,
      surface: 'widget',
      format: 'json',
      surfaceContext: ctx,
      exportedAt: EXPORTED_AT,
    });
    const b = buildExport({
      atlas,
      surface: 'widget',
      format: 'json',
      surfaceContext: ctx,
      exportedAt: EXPORTED_AT,
    });
    const textA = await a.blob.text();
    const textB = await b.blob.text();
    expect(textA).toBe(textB);
    expect(a.filename).toBe(b.filename);
  });
});
