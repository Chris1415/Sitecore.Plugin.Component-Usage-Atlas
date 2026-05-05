// T043 — Schema-version constant assertion (DoD-7 / IS-13 / ADR-0019).
//
// Asserts the SoT constant is `1` AND that it's structurally a const
// (TypeScript narrows the type via `as const` so the assignable type is
// `1`, not `number`). The companion `scripts/check-schema-version-sot.mjs`
// audit guards declaration uniqueness across the source tree.

import { describe, it, expect } from 'vitest';

import { ATLAS_EXPORT_SCHEMA_VERSION } from '@/core/atlas/export/schema-version';

describe('ATLAS_EXPORT_SCHEMA_VERSION (ADR-0019 SoT)', () => {
  it('equals 1', () => {
    expect(ATLAS_EXPORT_SCHEMA_VERSION).toBe(1);
  });

  it('is the only schema-version constant exported from core/atlas/export', async () => {
    // Importing from the SoT path must yield the canonical constant.
    // (The script-level audit catches duplicate declarations elsewhere.)
    const mod = await import('@/core/atlas/export/schema-version');
    const keys = Object.keys(mod);
    expect(keys).toContain('ATLAS_EXPORT_SCHEMA_VERSION');
    expect(keys).toHaveLength(1);
  });
});
