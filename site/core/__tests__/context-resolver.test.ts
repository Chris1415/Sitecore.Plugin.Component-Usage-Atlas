// T105 — RED tests for `core/context-resolver.ts` (lifts to GREEN at T014).
//
// Per § 10 T014: 5 scenarios. The resolver must prefer `.live` over
// `.preview`, throw `AtlasNoContextError` when neither is present, and
// never return `string | undefined` (always narrowed to `string`).

import { describe, it, expect } from 'vitest';
import {
  AtlasNoContextError,
  requireContextId,
} from '@/core/context-resolver';
import type { ApplicationContext } from '@sitecore-marketplace-sdk/client';

const makeCtx = (live?: string, preview?: string): ApplicationContext =>
  ({
    id: 'app-id',
    resourceAccess: [
      {
        resourceId: 'r1',
        tenantId: 't1',
        context: {
          live: live ?? '',
          preview: preview ?? '',
        },
      },
    ],
  }) as unknown as ApplicationContext;

describe('requireContextId', () => {
  it('returns ctx.resourceAccess[0].context.live when present', () => {
    const ctx = makeCtx('live-id-123', 'preview-id-456');
    const result = requireContextId(ctx);
    expect(result).toBe('live-id-123');
    expect(typeof result).toBe('string');
  });

  it('falls back to .preview when .live is empty', () => {
    const ctx = makeCtx('', 'preview-id-456');
    expect(requireContextId(ctx)).toBe('preview-id-456');
  });

  it('throws AtlasNoContextError when both are absent', () => {
    const ctx = makeCtx('', '');
    expect(() => requireContextId(ctx)).toThrowError(AtlasNoContextError);
  });

  it('throws AtlasNoContextError when ctx is null', () => {
    expect(() => requireContextId(null)).toThrowError(AtlasNoContextError);
  });

  it('throws AtlasNoContextError when resourceAccess is empty', () => {
    const ctx = { id: 'app', resourceAccess: [] } as unknown as ApplicationContext;
    expect(() => requireContextId(ctx)).toThrowError(AtlasNoContextError);
  });

  it('AtlasNoContextError is an instance of Error and has name AtlasNoContextError', () => {
    const err = new AtlasNoContextError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AtlasNoContextError');
  });
});
