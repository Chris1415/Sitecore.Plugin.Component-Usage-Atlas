"use client";

// T040 — Widget route. Thin wrapper that resolves the SDK client +
// the sitecoreContextId from the Marketplace provider, then renders
// `<WidgetSurface />`. The provider's loader is shown until handshake
// completes, so by the time this component runs both hooks return
// non-null values.
//
// We intentionally do NOT call `useEffect`-style lifecycle here — the
// scan trigger lives inside `<WidgetSurface />` so the surface itself
// is the testable unit. The route is a 1:1 plumbing layer.
//
// M3 fix from code-review-20260428T110500Z: `requireContextId` throws
// `AtlasNoContextError` when the application.context payload doesn't
// carry a `live`/`preview` context ID. We catch here and render the
// no-context fallback instead of letting the throw propagate to React's
// runtime error handler — there is no app-level error boundary above
// this route. The W5/P5 architecture state is rendered as a static
// message; the surface's own state machine isn't reached because the
// SDK call would fail anyway with an empty contextId.

import { useMarketplaceClient, useAppContext } from "@/components/providers/marketplace";
import { AtlasNoContextError, requireContextId } from "@/core/context-resolver";
import { WidgetSurface } from "@/components/atlas/widget-surface";

function NoContextFallback() {
  return (
    <div
      role="alert"
      data-testid="no-context-fallback"
      className="surface-frame flex h-full flex-col items-center justify-center gap-2 bg-background p-6 text-center"
    >
      <h2 className="text-lg font-semibold">Atlas needs a tenant connection</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Reload the dashboard from the Sitecore Cloud Portal to re-establish the
        tenant context. The atlas cannot scan without it.
      </p>
    </div>
  );
}

export default function WidgetPage() {
  const client = useMarketplaceClient();
  const appContext = useAppContext();

  let contextId: string;
  try {
    contextId = requireContextId(appContext);
  } catch (err) {
    if (err instanceof AtlasNoContextError) {
      return <NoContextFallback />;
    }
    throw err;
  }

  return (
    <WidgetSurface
      client={client}
      contextId={contextId}
      appContext={appContext}
    />
  );
}
