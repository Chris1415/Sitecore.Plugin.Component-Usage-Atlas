// T048 / T065 — RED+GREEN inline. UI tests for `<DensityToggle />`.
//
// Density toggle wraps Blok @blok/toggle-group with two options:
// Compact / Comfortable. Default Compact. Selection is a controlled
// prop (in-memory via parent surface state); no localStorage in M5
// (per ADR-0003). Selected option carries `data-state="on"` from the
// underlying Radix toggle-group; clicking the other option calls
// `onChange` with the new value. POC class anchor: `.toggle-group`.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DensityToggle } from '@/components/atlas/density-toggle';

describe('<DensityToggle /> — T048', () => {
  it('renders both Compact and Comfortable options with toggle-group role=radiogroup-equivalent', () => {
    render(<DensityToggle value="compact" onChange={() => undefined} />);
    expect(
      screen.getByRole('radio', { name: /compact/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /comfortable/i }),
    ).toBeInTheDocument();
  });

  it('shows the selected option as pressed (data-state=on)', () => {
    render(<DensityToggle value="compact" onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: /compact/i })).toHaveAttribute(
      'data-state',
      'on',
    );
    expect(screen.getByRole('radio', { name: /comfortable/i })).toHaveAttribute(
      'data-state',
      'off',
    );
  });

  it('clicking comfortable option fires onChange with "comfortable"', () => {
    const onChange = vi.fn();
    render(<DensityToggle value="compact" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /comfortable/i }));
    expect(onChange).toHaveBeenCalledWith('comfortable');
  });

  it('preserves POC visual anchor classname `.toggle-group` on the wrapper', () => {
    const { container } = render(
      <DensityToggle value="compact" onChange={() => undefined} />,
    );
    expect(container.querySelector('.toggle-group')).not.toBeNull();
  });
});
