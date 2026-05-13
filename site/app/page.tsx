import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Supersedes ADR-0014's "root returns notFound()" rule — this app now ships
// an IntroPage at `/` so visiting the deploy URL outside the iframe lands on
// a marketing-style overview of the two surfaces. The MarketplaceProvider has
// moved down into /widget/layout.tsx and /panel/layout.tsx so the intro page
// is not gated by the SDK handshake.
export default function IntroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-6 tracking-tight">
            Component Usage Atlas
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Tenant-wide live atlas of where renderings and their bound
            datasources are used across a SitecoreAI tenant. Two surfaces from
            one app registration: a Dashboard Widget for component-centric
            search, and a Page Context Panel for page-centric impact analysis.
            The atlas is built fresh in the iframe heap on demand, cached for
            the tab&apos;s lifetime, and discarded on tab close — no backend,
            no persisted index, no scheduled jobs.
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 mb-16 border border-border/50">
          <h2 className="text-2xl font-semibold mb-6 text-center">
            Project Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="font-medium text-foreground">Title</div>
              <div className="text-muted-foreground">Component Usage Atlas</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Author</div>
              <div className="text-muted-foreground">Christian Hahn</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Version</div>
              <div className="text-muted-foreground">1.1.0</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Released at (V1)</div>
              <div className="text-muted-foreground">05.05.2026</div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="font-medium text-foreground">
                Extension Points
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Dashboard Widget</Badge>
                <Badge variant="default">Pages Context Panel</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                Dashboard Widget
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col flex-grow">
              <div className="bg-muted rounded-lg overflow-hidden">
                <Image
                  src="/widget.png"
                  alt="Dashboard Widget — search-first table of renderings in the host site"
                  width={720}
                  height={400}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardDescription className="text-sm leading-relaxed flex-grow">
                Search-first table of every rendering in the host site, sorted
                by total placements. Each row shows placements, distinct
                pages, datasource count, and a rarity badge. Click a row to
                inline-expand a two-pane detail block: direct rendering usage
                on the left, datasources on the right with color-tagged
                cross-row hover affinity. A freshness ribbon names the host
                site and the totals from the last completed scan; Refresh
                atlas replays the scan with the same scope.
              </CardDescription>
              <Link href="/widget" className="mt-auto mb-2">
                <Button variant="outline" className="w-full bg-transparent">
                  Open Widget
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                Pages Context Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col flex-grow">
              <div className="bg-muted rounded-lg overflow-hidden">
                <Image
                  src="/panel.png"
                  alt="Page Context Panel — renderings on the active page with cross-tenant impact"
                  width={720}
                  height={400}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardDescription className="text-sm leading-relaxed flex-grow">
                For the active page, lists every rendering on it with a
                cross-tenant &quot;+N other pages&quot; counter and the
                datasource it binds. Identical placements collapse to one row
                with a ×N badge. Clicking a row opens a per-rendering drawer
                that answers &quot;if I publish this, what else
                breaks?&quot; without leaving the page editor — full page
                list, per-page placement count, and routing back into Pages
                via the SDK with no full reload.
              </CardDescription>
              <Link href="/panel" className="mt-auto mb-2">
                <Button variant="outline" className="w-full bg-transparent">
                  Open Panel
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
