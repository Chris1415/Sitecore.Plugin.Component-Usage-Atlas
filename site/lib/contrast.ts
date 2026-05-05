/**
 * WCAG 2.1 relative luminance + contrast ratio helper.
 *
 * Needed by the runtime contrast assertion rule in
 * `task-breakdown § 9.3` — UI tests for theme-token-painted elements MUST
 * assert resolved foreground/background contrast via `getComputedStyle()`,
 * NOT just `toHaveClass(...)`.
 *
 * Implementation:
 * - Parses an sRGB color string (`#rgb`, `#rrggbb`, `rgb(r, g, b)`,
 *   `rgba(r, g, b, a)`) into linearized channels.
 * - Computes relative luminance per WCAG 2.1
 *   (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).
 * - Returns the contrast ratio `(L1 + 0.05) / (L2 + 0.05)` with the
 *   lighter color in the numerator.
 *
 * Returns `NaN` when either color cannot be parsed — tests assert
 * `expect(contrast(...)).toBeGreaterThanOrEqual(4.5)` so a NaN result
 * fails as if the contrast check itself failed.
 */

function parseRgb(input: string): [number, number, number] | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();

  // #rgb / #rrggbb
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return [r, g, b];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return [r, g, b];
    }
    return null;
  }

  // rgb(r, g, b) / rgba(r, g, b, a)
  const match = trimmed.match(/^rgba?\(([^)]+)\)$/);
  if (match) {
    const parts = match[1].split(',').map((s) => s.trim());
    if (parts.length < 3) return null;
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if ([r, g, b].some((v) => !Number.isFinite(v))) return null;
    return [r, g, b];
  }

  return null;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number {
  const rgb = parseRgb(color);
  if (!rgb) return Number.NaN;
  const [r, g, b] = rgb.map(srgbToLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(fg: string, bg: string): number {
  const lFg = relativeLuminance(fg);
  const lBg = relativeLuminance(bg);
  if (Number.isNaN(lFg) || Number.isNaN(lBg)) return Number.NaN;
  const lighter = Math.max(lFg, lBg);
  const darker = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}
