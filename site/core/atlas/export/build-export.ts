/**
 * Pure construction entry point: reads inputs ONLY from arguments — no store
 * snapshot, no app context, no React context. Same args produce a
 * byte-identical Blob body.
 *
 * Its only side effect is constructing the Blob; URL.createObjectURL belongs to
 * the trigger, not here. See docs/build-decisions.md#export-purity.
 */

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
