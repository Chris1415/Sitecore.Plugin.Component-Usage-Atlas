// S11 — deterministic per-datasource color tag.

import { describe, it, expect } from 'vitest';
import { datasourceTagColor } from '@/lib/datasource-tag';

describe('datasourceTagColor', () => {
  it('returns the same color for the same datasource id', () => {
    const a = datasourceTagColor('local:/Data/Foo');
    const b = datasourceTagColor('local:/Data/Foo');
    expect(a).toBe(b);
  });

  it('returns a CSS hex color string', () => {
    expect(datasourceTagColor('local:/Data/Foo')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns different colors for distinct ids (palette spread)', () => {
    const colors = new Set(
      Array.from({ length: 20 }, (_, i) => datasourceTagColor(`ds-${i}`)),
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it('falls back to a stable color for empty input rather than throwing', () => {
    expect(datasourceTagColor('')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
