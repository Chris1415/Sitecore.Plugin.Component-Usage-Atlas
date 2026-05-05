// T042 — Schema-stability re-export integration test (DoD-3 / AC-4.4 / IS-13).
//
// Asserts byte-identical output across two `buildExport` invocations
// over deep-cloned identical inputs:
//   1. Same `exportedAt` → bytes are identical across all three formats.
//   2. Different `exportedAt` (1 ms apart) → only the timestamp delta line
//      differs, and (for JSON) the parsed object minus `exported_at` is
//      deep-equal.
//
// This is the canonical DoD-3 contract: re-exporting an unchanged atlas
// produces byte-identical output except for the `exported_at` timestamp.
//
// Provenance: N/A — `Atlas` and `SurfaceContext` are project-internal
// types; no SDK shapes are exercised.

import { describe, it, expect } from 'vitest';

import { buildExport } from '@/core/atlas/export/build-export';
import type { Atlas, RenderingUsage, DatasourceUsage, PageRef } from '@/lib/sdk/types';
import type { SurfaceContext } from '@/core/atlas/export/surface-context';

// ---------- fixture helpers ----------

const PAGE_A: PageRef = {
  pageId: 'p-aaa',
  pageName: 'Alpha page',
  sitePath: '/sites/acme',
  siteId: 'site-1',
  siteName: 'Acme',
};

const PAGE_B: PageRef = {
  pageId: 'p-bbb',
  pageName: 'Beta page',
  sitePath: '/sites/acme',
  siteId: 'site-1',
  siteName: 'Acme',
};

function makeAtlas(): Atlas {
  const renderingIndex = new Map<string, RenderingUsage>();
  renderingIndex.set('r-001', {
    renderingId: 'r-001',
    displayName: 'Hero',
    isUnknown: false,
    totalUsages: 2,
    pages: [PAGE_A, PAGE_B],
    datasources: ['d-100'],
  });
  renderingIndex.set('r-002', {
    renderingId: 'r-002',
    displayName: 'Promo card',
    isUnknown: false,
    totalUsages: 1,
    pages: [PAGE_A],
    datasources: [],
  });

  const datasourceIndex = new Map<string, DatasourceUsage>();
  datasourceIndex.set('d-100', {
    datasourceId: 'd-100',
    displayName: 'Hero data',
    isMissing: false,
    pages: [PAGE_A, PAGE_B],
    renderings: ['r-001'],
  });

  return {
    scope: { kind: 'all-collections' },
    scannedAt: 1_700_000_000_000,
    isPartial: false,
    renderingIndex,
    datasourceIndex,
    skipped: [],
    totals: { sites: 1, pages: 2, renderings: 2, datasources: 1, skipped: 0 },
  };
}

function makeWidgetCtx(): SurfaceContext {
  return {
    surface: 'widget',
    tenant: { tenantId: 'tnt-abcdefg', tenantName: 'Acme' },
    scope: { kind: 'all-collections' },
    languagesScanned: ['en'],
    scanTimestamp: '2026-05-03T10:14:41Z',
    isPartial: false,
    totals: { sites: 1, pages: 2, renderings: 2, datasources: 1 },
    skippedPages: [],
  };
}

const TIMESTAMP_BASE = '2026-05-03T11:00:00.000Z';
const TIMESTAMP_PLUS_1MS = '2026-05-03T11:00:00.001Z';

const FORMATS = ['json', 'csv', 'html'] as const;

// Canonical "stripped" forms used in the timestamp-delta assertions. The
// adapters interpolate `exported_at` exactly once into each surface; the
// strip patterns below remove the entire line in CSV and HTML and the
// single field in JSON.
function stripExportedAt(text: string, format: 'json' | 'csv' | 'html'): string {
  if (format === 'json') {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    delete parsed.exported_at;
    return JSON.stringify(parsed);
  }
  if (format === 'csv') {
    // Drop the `# Exported at: …` line.
    return text.replace(/^# Exported at: [^\r\n]*\r?\n/m, '');
  }
  // HTML — drop the `<dt>Exported at</dt><dd>…</dd>` fragment.
  return text.replace(/<dt>Exported at<\/dt><dd>[^<]*<\/dd>/, '');
}

describe('schema-stability — buildExport DoD-3 / AC-4.4', () => {
  for (const format of FORMATS) {
    describe(`format: ${format}`, () => {
      it('byte-identical: identical inputs + identical exported_at → identical bytes', async () => {
        const atlas = makeAtlas();
        const ctxClone1 = JSON.parse(JSON.stringify(makeWidgetCtx())) as SurfaceContext;
        const ctxClone2 = JSON.parse(JSON.stringify(makeWidgetCtx())) as SurfaceContext;

        // Re-hydrate Maps from the JSON-cloned atlas — Maps don't survive
        // structuredClone via JSON.stringify. We rebuild the atlas from the
        // factory each time instead, which is the realistic call pattern
        // (each click reads a fresh snapshot).
        const a = buildExport({
          atlas,
          surface: 'widget',
          format,
          surfaceContext: ctxClone1,
          exportedAt: TIMESTAMP_BASE,
        });
        const b = buildExport({
          atlas: makeAtlas(),
          surface: 'widget',
          format,
          surfaceContext: ctxClone2,
          exportedAt: TIMESTAMP_BASE,
        });

        const textA = await a.blob.text();
        const textB = await b.blob.text();
        expect(textA).toBe(textB);
        expect(a.filename).toBe(b.filename);
      });

      it('deterministic ordering: shuffled rendering input order → identical bytes', async () => {
        // The construction function sorts internally by rendering_id ASC,
        // so the iteration order over `renderingIndex.values()` should
        // not affect output bytes.
        const atlasA = makeAtlas();

        const baseB = makeAtlas();
        // Rebuild the rendering index in reverse insertion order.
        const reversed = new Map<string, RenderingUsage>();
        const entries = Array.from(baseB.renderingIndex.entries()).reverse();
        for (const [k, v] of entries) reversed.set(k, v);
        const atlasB: Atlas = { ...baseB, renderingIndex: reversed };

        const a = buildExport({
          atlas: atlasA,
          surface: 'widget',
          format,
          surfaceContext: makeWidgetCtx(),
          exportedAt: TIMESTAMP_BASE,
        });
        const b = buildExport({
          atlas: atlasB,
          surface: 'widget',
          format,
          surfaceContext: makeWidgetCtx(),
          exportedAt: TIMESTAMP_BASE,
        });

        const textA = await a.blob.text();
        const textB = await b.blob.text();
        expect(textA).toBe(textB);
      });

      it('exported_at delta: 1 ms apart → only the exported_at field/line differs', async () => {
        const a = buildExport({
          atlas: makeAtlas(),
          surface: 'widget',
          format,
          surfaceContext: makeWidgetCtx(),
          exportedAt: TIMESTAMP_BASE,
        });
        const b = buildExport({
          atlas: makeAtlas(),
          surface: 'widget',
          format,
          surfaceContext: makeWidgetCtx(),
          exportedAt: TIMESTAMP_PLUS_1MS,
        });

        const textA = await a.blob.text();
        const textB = await b.blob.text();

        // Pre-condition: the two bodies are NOT identical (the timestamp
        // changed) — this protects against a regression where the adapter
        // forgets to interpolate `exported_at`.
        expect(textA).not.toBe(textB);

        // After stripping the `exported_at` field/line, the two bodies
        // are byte-identical.
        const strippedA = stripExportedAt(textA, format);
        const strippedB = stripExportedAt(textB, format);
        expect(strippedA).toBe(strippedB);
      });
    });
  }

  it('JSON deep-equal minus exported_at: parsed objects match exactly', async () => {
    const a = buildExport({
      atlas: makeAtlas(),
      surface: 'widget',
      format: 'json',
      surfaceContext: makeWidgetCtx(),
      exportedAt: TIMESTAMP_BASE,
    });
    const b = buildExport({
      atlas: makeAtlas(),
      surface: 'widget',
      format: 'json',
      surfaceContext: makeWidgetCtx(),
      exportedAt: TIMESTAMP_PLUS_1MS,
    });

    const parsedA = JSON.parse(await a.blob.text()) as Record<string, unknown>;
    const parsedB = JSON.parse(await b.blob.text()) as Record<string, unknown>;
    delete parsedA.exported_at;
    delete parsedB.exported_at;
    expect(parsedA).toEqual(parsedB);
  });

  it('JSON top-level key order is identical across two runs', async () => {
    const a = buildExport({
      atlas: makeAtlas(),
      surface: 'widget',
      format: 'json',
      surfaceContext: makeWidgetCtx(),
      exportedAt: TIMESTAMP_BASE,
    });
    const b = buildExport({
      atlas: makeAtlas(),
      surface: 'widget',
      format: 'json',
      surfaceContext: makeWidgetCtx(),
      exportedAt: TIMESTAMP_PLUS_1MS,
    });

    const keysA = Object.keys(JSON.parse(await a.blob.text()));
    const keysB = Object.keys(JSON.parse(await b.blob.text()));
    expect(keysA).toEqual(keysB);
  });
});
