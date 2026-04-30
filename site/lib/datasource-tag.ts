// Deterministic color tag per datasource id, used to visually link rendering
// rows to their corresponding "DATASOURCE IMPACT" entries (S11). Same id ⇒
// same color across both lists.
//
// The palette uses Blok-friendly mid-saturation hues so the tag dot reads
// against both the card background and the affined hover background. Pure;
// no React, no DOM access — safe for SSR.

const PALETTE: ReadonlyArray<string> = [
  '#7c3aed', // violet
  '#2563eb', // blue
  '#0891b2', // cyan
  '#059669', // emerald
  '#65a30d', // lime
  '#d97706', // amber
  '#dc2626', // red
  '#db2777', // pink
  '#9333ea', // purple
  '#0d9488', // teal
];

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

export function datasourceTagColor(datasourceId: string): string {
  if (typeof datasourceId !== 'string' || datasourceId.length === 0) {
    return PALETTE[0]!;
  }
  return PALETTE[hash(datasourceId) % PALETTE.length]!;
}
