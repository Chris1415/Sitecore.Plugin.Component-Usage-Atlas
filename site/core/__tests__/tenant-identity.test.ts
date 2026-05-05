// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79, 128-146
//
// T006 — RED unit tests for `core/tenant-identity.ts` (lifts to GREEN at
// T005). Per § 10 T006 + ADR-0020: the resolver returns
// `{ tenantId, tenantName | null }` and throws `AtlasNoContextError`
// (re-exported from `core/context-resolver`) for the four invalid-input
// cases. Fixture matches the `ApplicationContext` /
// `ApplicationResourceContext` shape verbatim per the .d.ts citation.

import { describe, it, expect } from 'vitest';
import {
  AtlasNoContextError,
  requireTenantIdentity,
} from '@/core/tenant-identity';
import { AtlasNoContextError as ResolverAtlasNoContextError } from '@/core/context-resolver';
import type { ApplicationContext } from '@sitecore-marketplace-sdk/client';

const makeCtx = (overrides: {
  tenantId?: string;
  tenantName?: string | undefined;
  resourceAccess?: ReadonlyArray<unknown>;
} = {}): ApplicationContext =>
  ({
    id: 'app-id',
    resourceAccess:
      overrides.resourceAccess !== undefined
        ? overrides.resourceAccess
        : [
            {
              resourceId: 'r1',
              tenantId: overrides.tenantId ?? 'abc1234567',
              tenantName: overrides.tenantName,
              context: { live: 'L', preview: 'P' },
            },
          ],
  }) as unknown as ApplicationContext;

describe('requireTenantIdentity', () => {
  it('returns { tenantId, tenantName } when both fields are present', () => {
    const ctx = makeCtx({ tenantId: 'abc1234567', tenantName: 'Acme' });
    const result = requireTenantIdentity(ctx);
    expect(result).toEqual({ tenantId: 'abc1234567', tenantName: 'Acme' });
  });

  it('returns tenantName: null when tenantName is undefined', () => {
    const ctx = makeCtx({ tenantId: 'abc1234567', tenantName: undefined });
    const result = requireTenantIdentity(ctx);
    expect(result).toEqual({ tenantId: 'abc1234567', tenantName: null });
  });

  it('returns tenantName: null when tenantName is the empty string (NOT a fallback string)', () => {
    const ctx = makeCtx({ tenantId: 'abc1234567', tenantName: '' });
    const result = requireTenantIdentity(ctx);
    // null — the filename builder owns synthesis of the
    // `tenant-<last-7-of-tenantId>` fallback (per ADR-0020). The
    // resolver intentionally does NOT pre-fill it so JSON tooling can
    // detect the fallback case via `tenant.tenant_name === null`.
    expect(result.tenantName).toBeNull();
    expect(typeof result.tenantName).not.toBe('string');
  });

  it('throws AtlasNoContextError when ctx === null', () => {
    expect(() => requireTenantIdentity(null)).toThrowError(AtlasNoContextError);
  });

  it('throws AtlasNoContextError when resourceAccess is missing or empty', () => {
    expect(() =>
      requireTenantIdentity(makeCtx({ resourceAccess: [] })),
    ).toThrowError(AtlasNoContextError);
    expect(() =>
      requireTenantIdentity({ id: 'app' } as unknown as ApplicationContext),
    ).toThrowError(AtlasNoContextError);
  });

  it('throws AtlasNoContextError when tenantId is missing or empty', () => {
    expect(() =>
      requireTenantIdentity(makeCtx({ tenantId: '' })),
    ).toThrowError(AtlasNoContextError);
    expect(() =>
      requireTenantIdentity(
        makeCtx({
          resourceAccess: [
            {
              resourceId: 'r1',
              context: { live: 'L', preview: 'P' },
            },
          ],
        }),
      ),
    ).toThrowError(AtlasNoContextError);
  });

  it('AtlasNoContextError is the same class re-exported from core/context-resolver', () => {
    // Identity check — the resolver and tenant-identity must throw
    // *the same class*, so callers can `catch (e) { if (e instanceof
    // AtlasNoContextError) … }` against either import.
    expect(AtlasNoContextError).toBe(ResolverAtlasNoContextError);
  });
});
