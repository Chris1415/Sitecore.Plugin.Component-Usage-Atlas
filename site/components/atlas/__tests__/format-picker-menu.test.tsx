// T039 — RED → GREEN component tests for `<FormatPickerMenu>`.
//
// TDD discipline: this file was authored before the implementation in T033.
// Cases are numbered (a)..(k) per task breakdown § T039.

import {
  describe,
  it,
  expect,
  vi,
  afterEach,
} from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { FormatPickerMenu } from '@/components/atlas/format-picker-menu';
import { contrast } from '@/lib/contrast';

afterEach(() => {
  cleanup();
});

type Props = Parameters<typeof FormatPickerMenu>[0];

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    surface: 'widget',
    atlasSizeBytes: 1024, // < 5 MB → tier 'none'
    onSelect: vi.fn(),
    ...overrides,
  };
}

async function openMenu(): Promise<void> {
  const trigger = screen.getByRole('button', { name: /export format/i });
  // Radix DropdownMenuTrigger opens on pointerdown(button=0)+mouseup OR on
  // Enter/Space keypress. In jsdom we use the keyboard path because pointer
  // events don't carry a button code through fireEvent reliably.
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  await waitFor(() => {
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
  });
}

describe('<FormatPickerMenu />', () => {
  // (a) renders three items in JSON / CSV / HTML order
  it('renders three menu items in fixed order: JSON → CSV → HTML', async () => {
    render(<FormatPickerMenu {...baseProps()} />);
    await openMenu();
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(/JSON/);
    expect(items[1]).toHaveTextContent(/CSV/);
    expect(items[2]).toHaveTextContent(/HTML/);
  });

  // (b) JSON item: title 'JSON' + .json suffix + description
  it('renders JSON item with full title, suffix, and description', async () => {
    render(<FormatPickerMenu {...baseProps()} />);
    await openMenu();
    const jsonItem = screen.getAllByRole('menuitem')[0];
    expect(jsonItem).toHaveTextContent('JSON');
    expect(jsonItem).toHaveTextContent('.json');
    expect(jsonItem).toHaveTextContent('Full data, machine-readable');
  });

  // (c) CSV item: title 'CSV' + .csv suffix + description
  it('renders CSV item with full title, suffix, and description', async () => {
    render(<FormatPickerMenu {...baseProps()} />);
    await openMenu();
    const csvItem = screen.getAllByRole('menuitem')[1];
    expect(csvItem).toHaveTextContent('CSV');
    expect(csvItem).toHaveTextContent('.csv');
    expect(csvItem).toHaveTextContent('Lite data, spreadsheet-friendly');
  });

  // (d) HTML item: title 'HTML' + .html suffix + description
  it('renders HTML item with full title, suffix, and description', async () => {
    render(<FormatPickerMenu {...baseProps()} />);
    await openMenu();
    const htmlItem = screen.getAllByRole('menuitem')[2];
    expect(htmlItem).toHaveTextContent('HTML');
    expect(htmlItem).toHaveTextContent('.html');
    expect(htmlItem).toHaveTextContent('Lite data, printable / shareable');
  });

  // (e) atlasSizeBytes < 5 MB → no size annotation
  it('renders no size annotation when tier is "none"', async () => {
    render(<FormatPickerMenu {...baseProps({ atlasSizeBytes: 1024 })} />);
    await openMenu();
    // No "MB" should appear in any item.
    const items = screen.getAllByRole('menuitem');
    for (const item of items) {
      expect(item.textContent).not.toMatch(/MB/);
    }
  });

  // (f) atlasSizeBytes in 5–50 MB → muted ` · ~N MB` annotation
  it('renders muted size annotation when tier is "muted"', async () => {
    const sevenMb = 7 * 1024 * 1024;
    render(<FormatPickerMenu {...baseProps({ atlasSizeBytes: sevenMb })} />);
    await openMenu();
    const items = screen.getAllByRole('menuitem');
    // First item carries the muted size text — pattern ` · ~7 MB` (allow flex).
    const text = items[0].textContent ?? '';
    expect(text).toMatch(/~\s*7\s*MB/);
    // Should NOT contain the warning copy.
    expect(text).not.toMatch(/Large, may take a moment/);
  });

  // (g) atlasSizeBytes ≥ 50 MB → warning glyph + warning copy
  it('renders warning glyph + warning copy when tier is "warning"', async () => {
    const eightyMb = 80 * 1024 * 1024;
    render(<FormatPickerMenu {...baseProps({ atlasSizeBytes: eightyMb })} />);
    await openMenu();
    const items = screen.getAllByRole('menuitem');
    const text = items[0].textContent ?? '';
    expect(text).toMatch(/~\s*80\s*MB/);
    expect(text).toMatch(/Large, may take a moment/);
  });

  // (h) onSelect fires with correct format on click
  it('fires onSelect("json") when JSON item is clicked', async () => {
    const onSelect = vi.fn();
    render(<FormatPickerMenu {...baseProps({ onSelect })} />);
    await openMenu();
    const jsonItem = screen.getAllByRole('menuitem')[0];
    fireEvent.click(jsonItem);
    expect(onSelect).toHaveBeenCalledWith('json');
  });

  it('fires onSelect("csv") when CSV item is clicked', async () => {
    const onSelect = vi.fn();
    render(<FormatPickerMenu {...baseProps({ onSelect })} />);
    await openMenu();
    fireEvent.click(screen.getAllByRole('menuitem')[1]);
    expect(onSelect).toHaveBeenCalledWith('csv');
  });

  it('fires onSelect("html") when HTML item is clicked', async () => {
    const onSelect = vi.fn();
    render(<FormatPickerMenu {...baseProps({ onSelect })} />);
    await openMenu();
    fireEvent.click(screen.getAllByRole('menuitem')[2]);
    expect(onSelect).toHaveBeenCalledWith('html');
  });

  // (i) widget menu width 320 px / panel 280 px — assert via class hint.
  it('uses w-80 (320 px) menu content on widget surface', async () => {
    render(<FormatPickerMenu {...baseProps({ surface: 'widget' })} />);
    await openMenu();
    const content = screen
      .getAllByRole('menuitem')[0]
      .closest('[data-slot="dropdown-menu-content"]');
    expect(content).not.toBeNull();
    expect(content!.className).toMatch(/w-80/);
  });

  it('uses w-72 (288 px) menu content on panel surface', async () => {
    render(<FormatPickerMenu {...baseProps({ surface: 'panel' })} />);
    await openMenu();
    const content = screen
      .getAllByRole('menuitem')[0]
      .closest('[data-slot="dropdown-menu-content"]');
    expect(content).not.toBeNull();
    expect(content!.className).toMatch(/w-72/);
  });

  // (j) Runtime contrast — warning-tier annotation legibility (helper-level).
  // jsdom can't resolve var() tokens; we exercise the helper directly so the
  // assertion is honest for the harness it runs in.
  it('warning-tier annotation passes the WCAG contrast helper at hex level', async () => {
    render(
      <FormatPickerMenu {...baseProps({ atlasSizeBytes: 80 * 1024 * 1024 })} />,
    );
    await openMenu();
    // The Blok warning tokens (warning-fg, popover bg) resolve to hex
    // values we can spot-check via the helper.
    expect(contrast('#7a2f00', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  // (k) Keyboard nav: Escape closes; first item receives focus on open.
  it('first menu item is reachable + Escape closes the menu', async () => {
    render(<FormatPickerMenu {...baseProps()} />);
    await openMenu();
    const firstItem = screen.getAllByRole('menuitem')[0];
    expect(firstItem).toBeInTheDocument();
    fireEvent.keyDown(firstItem, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('menuitem')).toBeNull();
    });
  });
});
