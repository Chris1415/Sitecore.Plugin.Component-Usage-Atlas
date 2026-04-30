# Panel cleanup — alternative directions

The panel surface today shows an unbroken stack of `RENDERINGS ON THIS PAGE` rows + `DATASOURCE IMPACT` rows on a 480 px wide column. On a tenant with 15-20 placements per page it overflows three viewports of scroll, every row has equal visual weight, and "0 other pages" rows compete with "10 other pages" rows for attention.

Three directions, one HTML clickdummy each, all using realistic data from the solo-website tenant.

| Variant | Strategy | When it wins | Code change |
|---------|----------|--------------|-------------|
| **v1 — Tiered groups** (`poc-cleanup-v1/`) | Collapsible `<details>` groups: Hot (≥5 other pages), Some (1–4), Unique (0), Datasource impact. Default state opens only Hot. | Editor wants the answer "what here is widely reused?" without scrolling past unique stuff. | Medium: groups need a deterministic bucket function + `<details>` wrappers; row markup unchanged; requires tier counts pre-computed. |
| **v2 — Heatmap density** (`poc-cleanup-v2/`) | Single ranked table sorted by reach. Each row is one line; reach is shown both numerically AND as a left-edge gradient (darker = more reuse). Datasources collapse into a tight pill rail at the bottom. | Compact-density preference; comparing many placements at a glance; pure ranking question. | Bigger: row component re-flowed to single-line layout; "ds rail" replaces the existing DATASOURCE IMPACT section. |
| **v3 — Tabbed lenses** (`poc-cleanup-v3/`) | Tabs separate the two semantic questions: **Components** (renderings on this page) and **Content** (datasources bound). Sub-segmented filter (all / reused / unique). Within each tab, a small reach-bar replaces the chunky 88 px counter column. | Editor asking either-or: *what's reused?* OR *what content is shared?* — never both at once. Wins on focus, loses on simultaneity. | Largest: introduces tab state + per-tab content; the freshness ribbon shrinks to make room; some interactions (count chips above each tab) are new components. |

## Open both extremes

Open `poc-cleanup-v1/index.html` and `poc-cleanup-v3/index.html` side-by-side. v1 keeps everything one click away; v3 trades width for clarity by hiding the second list behind a tab.

## Recommendation

**v1 (tiered groups)** for the smallest user-facing change with the biggest visual win — Hot/Some/Unique tiers compress 21 rows of equal-weight noise into 5-6 visible-by-default rows. Datasource impact stays in the same surface but as its own collapsible. v3 looks cleaner but you lose at-a-glance "what's bound where" (you have to click Content to see datasources). v2 is beautiful for power users but the heatmap shading is hard to read against Blok's neutral palette and we'd want to A/B it before committing.

If you pick v1, the implementation work splits into:

1. Bucket fn `tierFor(rendering): 'hot' | 'some' | 'unique'` — fed `RenderingUsage.totalUsages` + active page id.
2. New `<RenderingTierGroup />` wrapping `<details>` + the existing dedupe/affinity logic.
3. `<DatasourceImpactGroup />` becomes its own wrapped `<details>` tier (no logic change).
4. Tier state (open/closed) persists in `localStorage` so editors get their preferred default after the first session.

Tell me which direction to lift into React and I'll wire it.
