// Inline-expand interaction. Click a row → toggle .open and reveal the
// matching .detail panel below it (only one expanded at a time).

const rows = document.querySelectorAll('.row');
const detail = document.querySelector('.detail');

function setOpen(row) {
  rows.forEach((r) => {
    if (r !== row) {
      r.classList.remove('open');
      const c = r.querySelector('.caret-col');
      if (c) c.textContent = '\u25B8';
    }
  });
  if (row.classList.contains('open')) {
    row.classList.remove('open');
    const c = row.querySelector('.caret-col');
    if (c) c.textContent = '\u25B8';
    if (detail) detail.style.display = 'none';
    return;
  }
  row.classList.add('open');
  const c = row.querySelector('.caret-col');
  if (c) c.textContent = '\u25BE';
  if (detail) detail.style.display = '';
}

rows.forEach((row) => {
  row.addEventListener('click', () => setOpen(row));
  row.tabIndex = 0;
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(row);
    }
  });
});

// Close button inside the detail panel
const closeBtn = document.querySelector('.detail__actions .ghost[aria-label="Collapse"]');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    const open = document.querySelector('.row.open');
    if (open) setOpen(open);
  });
}
