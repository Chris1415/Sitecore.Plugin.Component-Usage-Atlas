// T004 — ADR-0019 single-source-of-truth for the Atlas export schema
// version. Bumping this constant requires an ADR superseding ADR-0019.
//
// Bump rules (cite ADR-0019 § Decision before changing):
//   - Adding an OPTIONAL top-level field            → no bump.
//   - Removing or renaming any field                → MAJOR bump.
//   - Changing the semantics of an existing field   → MAJOR bump.
//   - Reordering deterministic-ordered arrays       → MAJOR bump.
//
// Adapters (json/csv/html) and the header-builder import this constant;
// no literal `1` may appear anywhere else as the schema version. T043
// chains a grep audit into `npm run ci` to enforce single declaration.
export const ATLAS_EXPORT_SCHEMA_VERSION = 1 as const;
