"use client";

// T009 — placeholder widget surface; <WidgetSurface /> implementation arrives in E4 (T040+).
// Uses the "Full hooks" template from client.md § 3a — call useMarketplaceClient() and
// useAppContext() so the route resolves only when the MarketplaceProvider has handshaken
// with the host frame. Outside the portal iframe, the provider's loader shows instead.

import { useMarketplaceClient, useAppContext } from "@/components/providers/marketplace";

export default function WidgetPage() {
  // Acquire the SDK client + application context. These hooks throw outside the provider,
  // matching ADR-0014's "smoke-test only at /widget or /panel" rule.
  const client = useMarketplaceClient();
  const appContext = useAppContext();

  // Reference values so unused-locals lint doesn't strip the hooks before they're consumed
  // by the real surface. Removed when T040 lands.
  void client;
  void appContext;

  return <div>Widget surface — pending implementation</div>;
}
