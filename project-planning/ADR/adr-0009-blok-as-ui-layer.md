# ADR-0009: Blok (Sitecore design system) as the UI layer; semantic tokens via registry

## Status

Accepted

## Context

The Marketplace app needs a UI library. Sitecore's mandated UI layer for Marketplace apps is **Blok** — a shadcn-style component registry under `https://blok.sitecore.com/r/...` themed for Sitecore Cloud Portal aesthetics. Blok provides:

- `@blok/*` registry components (Button, Card, Sidebar, Topbar, Drawer, etc.).
- Semantic theme tokens via `theme.json` (`--blok-color-primary`, `--blok-surface-canvas`, `--blok-radius-md`, etc.) — automatic light/dark and RTL.
- Typography stack tied to the Cloud Portal's visual identity.

Per `.agent/commands/project/dev-flow/04-architect.md` § 2 and § 3 Sitecore design-system enforcement, Blok is the default for Marketplace apps unless the user explicitly opts out. The user has not opted out.

Two adoption paths for Blok theming exist (per `blok/theming.md`):
- **A) Registry stylesheet** — `npx shadcn@latest add https://blok.sitecore.com/r/theme.json` pulls the `:root` token block and writes it into the project's CSS, then track upstream changes by re-pulling.
- **B) Hand-copied tokens** — copy hex values from `theming.md` into a local `:root { --blok-* }` block, with a comment naming the source file and snapshot date. Used when registry access is unavailable; it freezes the theme until a manual refresh.

Path A is the preferred convention; path B is the documented fallback.

## Decision

**Use Blok as the UI layer for both surfaces. Pull theme tokens via the registry (path A).** Use real `@blok/*` registry components — never fabricate `--blok-*` token names or hand-pick approximating hex values.

Concretely:

- **Theming:** install via `npx shadcn@latest add https://blok.sitecore.com/r/theme.json`. The resulting CSS imports cascade automatically; do not edit the generated `:root { --blok-* }` block by hand.
- **Components:** add via `npx shadcn@latest add https://blok.sitecore.com/r/<component>.json`. The known set required for v1 (subject to architect/lead-developer refinement during scaffolding):
  - `@blok/button`, `@blok/input`, `@blok/table`, `@blok/drawer` (or `@blok/sheet`), `@blok/badge`, `@blok/tooltip`, `@blok/dropdown-menu` (for the scope picker), `@blok/skeleton`, `@blok/progress`, `@blok/dialog`.
- **Typography:** use the Blok typography stack as shipped by `theme.json`. Do not pull Google Fonts or other custom families.
- **Light/dark:** rely on Blok's semantic tokens — both modes work without a custom palette.
- **Custom UI:** the loading visualization (per ADR-0011) is the only place a custom-built component exists; even there, all colors and spacing pull from Blok semantic tokens (`--blok-color-primary`, `--blok-surface-canvas`, `--blok-spacing-*`).

## Consequences

**Easier:**
- Cloud Portal visual identity is automatic — the app looks native to Pages and the dashboard from day one.
- Light/dark and RTL handled by tokens; no custom palette work.
- Future Blok updates flow in via re-running the shadcn add command; no theme-file maintenance.
- Aligns with Marketplace dogfood precedent (PageShot, QuickCopy follow the same pattern).

**Harder:**
- Custom visual treatments (e.g., the loading visualization in ADR-0011) must compose Blok primitives — they cannot drop to Tailwind utilities or hand-rolled colors. Mitigation: spec the loading visual as a thin SVG / canvas layer over Blok-token-driven CSS.
- If a needed primitive does not exist in Blok, it must be composed from lower-level Blok primitives — never replaced with shadcn-vanilla, Material, or Tailwind-only equivalents. Such gaps must be called out in the UI design phase.
- Locked into the Blok registry's evolution. If Blok ships a breaking change to a token name, every consumer site updates. Mitigation: pin the snapshot date / version on every install; record the resolved version in `.agent/skills/sitecore/marketplace-sdk/CATALOG.md`.

**Forbidden in this ADR:**
- Inventing `--blok-*` token names or hand-picking hex values that approximate Blok tokens.
- Pulling Google Fonts or other custom font families "to make it ours."
- Using shadcn-vanilla, Material UI, or Chakra components alongside Blok — the design system stays singular.
- Bypassing the registry for theming (path B) without an explicit opt-in recorded in this ADR; if the registry is ever unreachable, copy from `theming.md` with the dated source comment per `blok/theming.md`'s fallback rule.

## Date

2026-04-27
