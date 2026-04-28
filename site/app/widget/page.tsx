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

import { useMarketplaceClient, useAppContext } from "@/components/providers/marketplace";
import { requireContextId } from "@/core/context-resolver";
import { WidgetSurface } from "@/components/atlas/widget-surface";

export default function WidgetPage() {
  const client = useMarketplaceClient();
  const appContext = useAppContext();
  const contextId = requireContextId(appContext);

  return <WidgetSurface client={client} contextId={contextId} />;
}
