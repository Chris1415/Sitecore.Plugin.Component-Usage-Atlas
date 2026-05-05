// T005 — `requireTenantIdentity` resolves the tenant identity from the
// Marketplace `application.context` payload (ADR-0020).
//
// Per ADR-0020: PRD shorthand `application.context.tenantName` does NOT
// match the SDK runtime shape. The canonical access path is
// `application.context.resourceAccess[0]`, mirroring the existing
// `requireContextId` resolver in `./context-resolver.ts`.
//
// Returns `{ tenantId, tenantName: string | null }`. When `tenantName`
// is missing or empty, returns `null` — the **filename builder**
// synthesizes the `tenant-<last-7-of-tenantId>` fallback string at the
// surface where it's needed, NOT here. Keeping the resolver name-only
// preserves a clean signal for downstream tooling that wants to detect
// the fallback case (JSON `tenant.tenant_name === null`).
//
// Throws `AtlasNoContextError` (re-exported from `./context-resolver`)
// when ctx is null, when `resourceAccess` is not a non-empty array, or
// when `tenantId` is missing or empty. Surfaces handle this by entering
// the existing W5 / P5 "no tenant context" disabled state — they do
// NOT retry, do NOT offer a fallback download, and do NOT show the
// export menu.

// source: node_modules/@sitecore-marketplace-sdk/client/dist/sdk-types.d.ts:236-240
// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79

import type { ApplicationContext } from '@sitecore-marketplace-sdk/client';

import { AtlasNoContextError } from './context-resolver';

// Re-export so callers can import the error type from the same module
// they import the resolver from. The class identity is the same as the
// one exported from `./context-resolver` (ADR-0020 § Error model).
export { AtlasNoContextError };

export interface TenantIdentity {
  readonly tenantId: string;
  readonly tenantName: string | null;
}

export function requireTenantIdentity(
  ctx: ApplicationContext | null,
): TenantIdentity {
  if (ctx === null) {
    throw new AtlasNoContextError();
  }

  const access = ctx.resourceAccess;
  if (!Array.isArray(access) || access.length === 0) {
    throw new AtlasNoContextError();
  }

  const first = access[0];
  const tenantId = first?.tenantId;
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new AtlasNoContextError();
  }

  const rawName = first?.tenantName;
  const tenantName =
    typeof rawName === 'string' && rawName.length > 0 ? rawName : null;

  return { tenantId, tenantName };
}
