"use client";

// T050 — Panel route. Thin wrapper that resolves the SDK client + the
// sitecoreContextId from the Marketplace provider, then renders
// `<PanelSurface />`. Same shape as the widget route — the route is a
// 1:1 plumbing layer; surface owns lifecycle.
//
// M3 fix from code-review-20260428T110500Z: catch `AtlasNoContextError`
// and render a no-context fallback. See `app/widget/page.tsx` for the
// rationale — there is no app-level error boundary above this route.

import { useMarketplaceClient, useAppContext } from "@/components/providers/marketplace";
import { AtlasNoContextError, requireContextId } from "@/core/context-resolver";
import { PanelSurface } from "@/components/atlas/panel-surface";

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

export default function PanelPage() {
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
    <PanelSurface
      client={client}
      contextId={contextId}
      appContext={appContext}
    />
  );
}
