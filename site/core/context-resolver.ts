// T014 — `requireContextId` resolves the `sitecoreContextId` from the
// Marketplace `application.context` payload.
//
// Per `xmc.md § 12a` + architecture § 5.1: the editor cannot make any
// `xmc.*` call without an already-narrowed `string` contextId. Every
// caller MUST go through this resolver — never `as string`.
//
// Policy: prefer `.live` (delivery context). Fall back to `.preview`. If
// neither is present, throw `AtlasNoContextError` so the surfaces can
// render the W5 / P5 "no tenant context" copy without a retry button
// (per OQ-A6 / architecture § 10.1).

import type { ApplicationContext } from '@sitecore-marketplace-sdk/client';

/**
 * Thrown when the Marketplace application.context payload does not yield a
 * usable `sitecoreContextId`. Surfaces render the locked W5 / P5 copy and
 * do NOT offer a retry — the editor is expected to reload the dashboard.
 */
export class AtlasNoContextError extends Error {
  constructor(
    message: string = 'Atlas needs a tenant connection — no sitecoreContextId available',
  ) {
    super(message);
    this.name = 'AtlasNoContextError';
  }
}

export function requireContextId(ctx: ApplicationContext | null): string {
  if (ctx === null) {
    throw new AtlasNoContextError();
  }

  const access = ctx.resourceAccess;
  if (!Array.isArray(access) || access.length === 0) {
    throw new AtlasNoContextError();
  }

  const first = access[0];
  const live = first?.context?.live;
  if (typeof live === 'string' && live.length > 0) {
    return live;
  }

  const preview = first?.context?.preview;
  if (typeof preview === 'string' && preview.length > 0) {
    return preview;
  }

  throw new AtlasNoContextError();
}
