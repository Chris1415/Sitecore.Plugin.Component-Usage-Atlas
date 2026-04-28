"use client";

// T050 — Panel route. Thin wrapper that resolves the SDK client + the
// sitecoreContextId from the Marketplace provider, then renders
// `<PanelSurface />`. Same shape as the widget route — the route is a
// 1:1 plumbing layer; surface owns lifecycle.

import { useMarketplaceClient, useAppContext } from "@/components/providers/marketplace";
import { requireContextId } from "@/core/context-resolver";
import { PanelSurface } from "@/components/atlas/panel-surface";

export default function PanelPage() {
  const client = useMarketplaceClient();
  const appContext = useAppContext();
  const contextId = requireContextId(appContext);

  return <PanelSurface client={client} contextId={contextId} />;
}
