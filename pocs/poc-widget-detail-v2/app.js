// Master-detail selection. Click a row → mark .selected. Detail pane copy
// is static here (the real implementation will recompute from the chosen
// rendering's RenderingUsage entry).

const rows = document.querySelectorAll('.master .row');
const titleEl = document.querySelector('.detail__head h2');
const subEl = document.querySelector('.detail__head p');

const sample = {
  MediaText:    { sub: '9 pages · 14 placements · 13 datasources' },
  Container:    { sub: '11 pages · 11 placements · 0 datasources' },
  HeroBanner:   { sub: '10 pages · 10 placements · 7 datasources' },
  Stats:        { sub: '8 pages · 9 placements · 3 datasources' },
  'News List':  { sub: '8 pages · 8 placements · 2 datasources' },
  Image:        { sub: '4 pages · 4 placements · 4 datasources' },
  'News Card':  { sub: '3 pages · 3 placements · 3 datasources' },
  HighlightTeaser: { sub: '3 pages · 3 placements · 3 datasources' },
  'Brand List': { sub: '2 pages · 2 placements · 1 datasource' },
  EventCard:    { sub: '1 page · 1 placement · 1 datasource' },
};

rows.forEach((row) => {
  row.tabIndex = 0;
  row.addEventListener('click', () => select(row));
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(row); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(+1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); moveSel(-1); return; }
  });
});

function select(row) {
  rows.forEach((r) => r.classList.remove('selected'));
  row.classList.add('selected');
  const name = row.querySelector('.rendering').textContent.trim();
  if (titleEl) titleEl.textContent = name;
  if (subEl) {
    const meta = sample[name];
    subEl.textContent = meta ? meta.sub : '';
  }
  row.focus();
}

function moveSel(delta) {
  const arr = Array.from(rows);
  const i = arr.findIndex((r) => r.classList.contains('selected'));
  const next = arr[Math.max(0, Math.min(arr.length - 1, i + delta))];
  if (next) select(next);
}
