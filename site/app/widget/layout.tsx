import { MarketplaceProvider } from "@/components/providers/marketplace";

export default function WidgetLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
