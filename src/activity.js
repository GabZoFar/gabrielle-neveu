// "Active days" grids for the last year, fed by /api/activity.

const GITHUB_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;

const SOURCES = [
  { key: 'github', name: 'GitHub', icon: GITHUB_ICON, href: 'https://github.com/GabZoFar', unit: 'coding' },
  { key: 'palmares', name: 'Palmares', href: 'https://palmares.madame-studio.com', unit: 'training' },
];

function grid(days) {
  // Pad the start so each column is a Sunday→Saturday week.
  const first = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const cells = [...Array(first).fill(null), ...days];
  return cells
    .map((d) =>
      d ? `<i class="cell l${d.level}" title="${d.date}${d.level ? '' : ' · rest'}"></i>` : '<i class="cell pad"></i>',
    )
    .join('');
}

export async function initActivity(section) {
  let data;
  try {
    const res = await fetch('/api/activity');
    if (!res.ok) return;
    data = await res.json();
  } catch {
    return;
  }

  const rows = SOURCES.filter((s) => data[s.key]?.length).map((s) => {
    const days = data[s.key].slice(-364);
    const active = days.filter((d) => d.level > 0).length;
    return `<div class="activity-row ${s.key}">
      <p><a href="${s.href}" target="_blank" rel="noopener noreferrer">${s.icon ?? ''}${s.name}</a>
        <span class="muted">${active} days ${s.unit} this past year</span></p>
      <div class="activity-grid" role="img" aria-label="${s.name}: ${active} active days in the last year">${grid(days)}</div>
    </div>`;
  });
  if (!rows.length) return;

  section.querySelector('.activity-rows').innerHTML = rows.join('');
  section.hidden = false;
}
