// T074 — RED+GREEN UI tests for `<DebugPanel />`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DebugPanel } from '@/components/atlas/debug-panel';
import { __setEnabledForTest, clearBuffer, track } from '@/core/telemetry';

const ORIGINAL_LOCATION = window.location;

function setSearch(search: string) {
  const url = new URL('http://localhost/?' + search.replace(/^\?/, ''));
  Object.defineProperty(window, 'location', {
    value: { ...ORIGINAL_LOCATION, search: url.search },
    writable: true,
  });
}

beforeEach(() => {
  clearBuffer();
  __setEnabledForTest(true);
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', {
    value: ORIGINAL_LOCATION,
    writable: true,
  });
  vi.restoreAllMocks();
});

describe('<DebugPanel />', () => {
  it('returns null when ?debug=1 is absent', () => {
    setSearch('');
    const { container } = render(<DebugPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the panel when ?debug=1 is present', async () => {
    setSearch('debug=1');
    track({ timestamp_ms: 1, kind: 'scan_started', surface: 'widget' });
    render(<DebugPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('debug-panel')).toBeInTheDocument();
    });
  });

  it('Copy button calls navigator.clipboard.writeText with the buffer JSON', async () => {
    setSearch('debug=1');
    track({ timestamp_ms: 1, kind: 'scan_started', surface: 'widget' });
    track({
      timestamp_ms: 2,
      kind: 'phase_transition',
      surface: 'widget',
      from: 'sites',
      to: 'pages',
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(<DebugPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('debug-panel')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('debug-panel-copy'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    const arg = writeText.mock.calls[0]?.[0] as string;
    expect(arg).toContain('scan_started');
    expect(arg).toContain('phase_transition');
  });
});
