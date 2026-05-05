# ADR-0020: Tenant identity for exports resolves via `application.context.resourceAccess[0]`

## Status

Accepted

## Context

PRD-001 references `application.context.tenantName` as the source for the editor-visible tenant name in filenames, JSON headers, CSV headers, and HTML headers (PRD-001 AC-1.4, § 9.1, § 9.4, prd-minimal-001 "Tenant-name fallback").

The actual SDK shape, verified during the architect's SDK contract gate against `node_modules` at run time:

```
// source: node_modules/@sitecore-marketplace-sdk/client/dist/sdk-types.d.ts:236-240
'application.context': {
  params: void;
  response: ApplicationContext;
  subscribe: false;
};

// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:128-146
export interface ApplicationContext {
  id: string;
  url: string;
  name?: string;
  type?: string;
  // ... omitted ...
  resources?: ApplicationResourceContext[];          // @deprecated — use resourceAccess
  resourceAccess?: ApplicationResourceContext[];
  extensionPoints?: ApplicationExtensionPointContext[];
  [key: string]: any;
}

// source: node_modules/@sitecore-marketplace-sdk/core/dist/shared-types.d.ts:69-79
export interface ApplicationResourceContext {
  resourceId: string;
  tenantId: string;
  tenantName?: string;
  tenantDisplayName?: string;
  context: { live: string; preview: string };
  [key: string]: any;
}
```

**There is no top-level `tenantName` on `application.context`.** The PRD's shorthand `application.context.tenantName` is a documentation convenience — the actual access path is `application.context.resourceAccess[0].tenantName`, optional. The existing PRD-000 implementation already encodes this pattern at `core/context-resolver.ts:34-50` (`requireContextId` reads `ctx.resourceAccess[0].context.live`).

If the export module reinvents tenant resolution against the PRD's shorthand path, two things go wrong:
1. The TypeScript compiler is happy (because of `[key: string]: any`), but `tenantName` is `undefined` at runtime — every filename gets the fallback (`tenant-<last-7-of-tenantId>`), and no editor on a real install ever sees their tenant's actual name in a filename.
2. The bug is silent — the fallback string is well-formed, the export looks "fine" until an editor notices their three filenames all start with `tenant-abcd123-` and asks why.

This is exactly the failure mode rule `40-sdk-contracts.mdc` and the architect's "SDK contract verification gate" exist to catch. Verification was performed; the gap is real; this ADR pins the canonical access pattern so the developer (08) does not have to re-derive it.

The export module is also adjacent to — but should not duplicate — the existing `requireContextId(ctx)` resolver. `requireContextId` is contextId-focused and throws `AtlasNoContextError` when `resourceAccess[0].context.live` is missing. The export module needs **tenant identity** (id + optional name), which has different fallback semantics: missing name is fine, missing id is fatal.

## Decision

Add a sibling resolver alongside `requireContextId`:

```ts
// products/component-usage-atlas/site/core/tenant-identity.ts
import type { ApplicationContext } from '@sitecore-marketplace-sdk/client';
import { AtlasNoContextError } from './context-resolver';

export interface TenantIdentity {
  tenantId: string;
  tenantName: string | null;   // null when SDK does not expose it
}

/**
 * Reads tenant identity from the Marketplace `application.context` payload.
 * Source path verified in node_modules:
 *   - sdk-types.d.ts:236-240 — application.context returns ApplicationContext
 *   - shared-types.d.ts:69-79 — ApplicationResourceContext shape
 *
 * Throws AtlasNoContextError when resourceAccess[0].tenantId is missing —
 * matching the existing requireContextId failure model for "no usable
 * tenant context."
 */
export function requireTenantIdentity(ctx: ApplicationContext | null): TenantIdentity {
  if (ctx === null) throw new AtlasNoContextError();
  const access = ctx.resourceAccess;
  if (!Array.isArray(access) || access.length === 0) throw new AtlasNoContextError();

  const first = access[0];
  const tenantId = first?.tenantId;
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new AtlasNoContextError();
  }

  const rawName = first?.tenantName;
  const tenantName = (typeof rawName === 'string' && rawName.length > 0) ? rawName : null;

  return { tenantId, tenantName };
}
```

The export module's caller (the Download button click handler on each surface) invokes `requireTenantIdentity(ctx)` at click time and passes the result into `surfaceContext` per ADR-0016. The construction function never reads `application.context` directly — purity is preserved.

### Filename builder responsibility

The fallback string `tenant-<last-7-of-tenantId>` is **constructed by the filename builder** (FR-6.1), not by `requireTenantIdentity`. This split:
- Keeps the resolver semantically honest — it returns the SDK's actual data, with `null` for "name not provided," and never invents a synthetic name.
- Lets JSON header set `tenant.tenant_name = null` (per PRD-001 § 10.1) so a tooling consumer can detect the fallback case (the PRD explicitly contracts this distinction).
- Centralizes the slug rules (§ 9.4) in the builder, where the rest of the slugification lives.

```ts
// pseudocode in filename-builder
const tenantSlug = identity.tenantName != null
  ? slugify(identity.tenantName)
  : `tenant-${identity.tenantId.slice(-7)}`;
```

### CSV / HTML header responsibility

CSV's `# Tenant: <tenant_name> (<tenant_id>)` line and HTML's summary `<dt>Tenant</dt><dd>...</dd>` use the **same fallback presentation** as the filename when `tenantName` is null:

- `# Tenant: tenant-abcd1234 (abcd1234-...)` (CSV)
- `<dd>tenant-abcd1234</dd>` (HTML)

The fallback is a single canonical token applied uniformly across filename, CSV header, and HTML header — only JSON treats `null` differently (because JSON tooling needs to detect the case).

### PRD shorthand is preserved

PRD-001 and prd-minimal-001 keep their `application.context.tenantName` shorthand for human readability. This ADR is the canonical translation. The architect-side correction does not require editing the PRD prose; readers who follow the trail to ADR-0020 see the precise path. Future PRDs in this product can also use the shorthand; the resolver is the contract.

## Consequences

### Easier

- The export's tenant fallback path matches what `application.context` *actually* yields. No silent fallback-everywhere bug at smoke time.
- The resolver lives next to `requireContextId` in `core/`, so the two follow the same testing pattern (the existing `core/__tests__/context-resolver.test.ts` is the obvious template).
- The construction function stays pure (ADR-0016) — it reads `surfaceContext.tenant`, not `application.context`. Callers do the SDK lookup and the cloning.

### Harder

- One extra resolver to maintain. If `ApplicationResourceContext` ever splits `tenantName` into `tenantDisplayName` (which the type already optionally has), `requireTenantIdentity` is the single location to update — but it must be updated, not silently bypassed.
- The PRD's shorthand is now mildly misleading without this ADR. A reader who lands in PRD-001 directly and ignores ADRs would access `ctx.tenantName` and be wrong. Mitigation: prd-minimal-001 carries an ADR-0020 reference under "Key constraints & assumptions" so the developer's slim context surfaces the correction.

### Neutral

- The `null` vs fallback-string distinction in JSON is a real contract surface that this ADR makes the developer hold deliberately, not by accident. It is consistent with PRD-001 § 10.1 (`tenant.tenant_name: string | null`).

## Date

2026-05-03
