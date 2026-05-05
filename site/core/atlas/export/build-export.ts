// T017 — `buildExport` is the pure construction entry point for the
// Atlas export feature.
//
// ADR-0016 (purity contract):
//   - Reads inputs ONLY from arguments. No `getAtlasSnapshot()`, no
//     `application.context`, no React context, no `window` reads
//     beyond what `Blob` requires structurally.
//   - The caller (the click handler at the surface) clones the
//     SurfaceContext at click time via `cloneSurfaceContext` and
//     passes both that clone and the live atlas snapshot in. From
//     this point on the construction is deterministic over its
//     arguments — same args → byte-identical Blob body (DoD-3 /
//     AC-4.4).
//   - Only side effect is constructing the returned `Blob`. No
//     `URL.createObjectURL` here — that is the trigger's job
//     (T025 trigger-download).
//
// Dispatch:
//   - `format: 'json'` → `jsonAdapter` (JSON envelope; T019 lands the
//     full schema § 10.1 body — currently a minimal placeholder).
//   - `format: 'csv'`  → `csvAdapter` (T021 — placeholder).
//   - `format: 'html'` → `htmlAdapter` (T023 — placeholder).
//
// Filename comes from `buildFilename` (T013) over the surfaceContext
// + scope + format, NOT from the atlas; the atlas is body-only.

import type { Atlas } from '@/lib/sdk/types';

import { buildHeader } from './header-builder';
import { buildFilename } from './filename-builder';
import type { SurfaceContext } from './surface-context';
import { jsonAdapter } from './formats/json';
import { csvAdapter } from './formats/csv';
import { htmlAdapter } from './formats/html';

export interface BuildExportArgs {
  readonly atlas: Atlas;
  readonly surface: 'widget' | 'panel';
  readonly format: 'json' | 'csv' | 'html';
  readonly surfaceContext: SurfaceContext;
  readonly exportedAt: string;
}

export interface BuildExportResult {
  readonly blob: Blob;
  readonly filename: string;
}

export function buildExport(args: BuildExportArgs): BuildExportResult {
  const { atlas, surface, format, surfaceContext, exportedAt } = args;

  // 1. Compute the canonical metadata header (declared key order).
  const header = buildHeader(surfaceContext, exportedAt);

  // 2. Dispatch on format. Each adapter returns `{ body, mime }`.
  const result =
    format === 'json'
      ? jsonAdapter(atlas, surfaceContext, header)
      : format === 'csv'
        ? csvAdapter(atlas, surfaceContext, header)
        : htmlAdapter(atlas, surfaceContext, header);

  // 3. Wrap in a Blob with the format MIME.
  const blob = new Blob([result.body], { type: result.mime });

  // 4. Filename via the click-time SurfaceContext + scope + format.
  const filename = buildFilename({
    tenant: surfaceContext.tenant,
    surface,
    scopeKind: surfaceContext.scope.kind,
    scopeCollectionName: surfaceContext.scope.collectionName,
    scopeCollectionId: surfaceContext.scope.collectionId,
    scanTimestamp: surfaceContext.scanTimestamp,
    pageName: surfaceContext.panelPage?.pageName,
    pageId: surfaceContext.panelPage?.pageId,
    format,
  });

  return { blob, filename };
}
