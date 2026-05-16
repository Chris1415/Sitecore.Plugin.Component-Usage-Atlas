/**
 * Public env flags read on the client.
 *
 * NEXT_PUBLIC_* vars are inlined at build time by Next.js when referenced in
 * client code, so a flag change requires restarting the dev server (or a
 * fresh build).
 *
 * `NEXT_PUBLIC_ATLAS_THEME_SWITCHER`
 *   Gates the visible theme-toggle UI. When unset or any value other than
 *   "true", the toggle does not render — but the app still follows the
 *   user's OS preference because ThemeProvider runs `enableSystem`.
 *
 *   Default: false (no visible toggle). Set to "true" in `.env.local` or in
 *   the deployed env to expose the dropdown.
 */
export function isThemeSwitcherEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ATLAS_THEME_SWITCHER === "true";
}
