# Widget detail-view alternatives — comparison

Both POCs replace the right-side `<UsageDrawer />` on the **dashboard widget surface only**. The panel surface keeps its current drawer (correct fit there).

Open each in a browser:
- `pocs/poc-widget-detail-v1/index.html` — inline row expansion
- `pocs/poc-widget-detail-v2/index.html` — master-detail split (always visible)

## v1 — inline row expansion

Click a row → it highlights, caret flips, and a detail panel slides in *directly underneath that row* showing pages × datasources side-by-side. Click the same row (or the **Close ▴** button) to collapse. Only one row is open at a time.

- **Best when:** you scan top-to-bottom and occasionally drill in. Comparing two renderings = expand each in turn (one at a time, but no modal moment).
- **Code change scope:** medium. Replace the `<UsageDrawer />` mount inside `<WidgetSurface />` with a controlled-expansion behaviour on `<WidgetTable />` rows. The drawer component itself can stay for the panel surface. Existing `selectedRenderingId` state already encodes the open row — just stop rendering the sheet.
- **Wins:** keeps the table as the primary surface; no canvas waste; works at any width; close = re-click.
- **Tradeoffs:** detail height pushes following rows down (mitigated by capping the panel at ~40vh with internal scroll); can't see two detail panels at once.

## v2 — master-detail split

Always-on right pane shows whichever row is selected. Default selection = the first/highest-usage row. Arrow keys move selection up/down — the right pane updates in lockstep.

- **Best when:** you want a "spreadsheet + reader" feel; comparing many renderings rapidly via keyboard.
- **Code change scope:** larger. The widget zone-3 layout becomes a CSS grid; `<UsageDrawer />` content is lifted out into a `<RenderingDetailPane />` that mounts always, parameterized by selection.
- **Wins:** zero open/close cost; ideal at wide viewports; teaches the "select to read" mental model fast.
- **Tradeoffs:** detail competes with the table for horizontal space (50/50-ish); below ~1000px you'd need a stacked fallback (effectively reverting to inline expand at narrow widths); occupies the right canvas permanently even when you're not interested in detail.

## Recommendation

**v1 (inline expansion)** for most cases — it's the cheaper change, plays nicely at any dashboard width, and matches how editors actually use the widget (hunt for an outlier in the table, then read its impact). v2 looks beautiful at >1200px and is great for power-user QA, but the always-on pane is overkill for the typical "I just want to know where Hero Banner is used" lookup.

If you go with v1, the panel-surface drawer stays as-is — you get a single mental model (drill = expand) on each surface but the gesture differs to fit the surface dimensions.

If you'd like both behaviours conditional on viewport (auto-flip to master-detail above ~1200px, inline-expand below), I can add a simple breakpoint switch. Tell me which you want and I'll wire it into `<WidgetSurface />` + `<WidgetTable />` next.
