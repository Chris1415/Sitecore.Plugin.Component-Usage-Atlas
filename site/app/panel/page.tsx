"use client";

// T010 — placeholder panel surface; <PanelSurface /> implementation arrives in E5 (T050+).
// Same shape as /widget per task breakdown § 4 T010.

import { useMarketplaceClient, useAppContext } from "@/components/providers/marketplace";

export default function PanelPage() {
  const client = useMarketplaceClient();
  const appContext = useAppContext();

  void client;
  void appContext;

  return <div>Panel surface — pending implementation</div>;
}
