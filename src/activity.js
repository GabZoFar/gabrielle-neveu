// "Active days" grids for the last year, fed by /api/activity.

const SOURCES = [
  { key: 'github', name: 'GitHub', href: 'https://github.com/GabZoFar', unit: 'coding' },
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
      <p><a href="${s.href}" target="_blank" rel="noopener noreferrer">${s.name}</a>
        <span class="muted">${active} days ${s.unit} this past year</span></p>
      <div class="activity-grid" role="img" aria-label="${s.name}: ${active} active days in the last year">${grid(days)}</div>
    </div>`;
  });
  if (!rows.length) return;

  section.querySelector('.activity-rows').innerHTML = rows.join('');
  section.hidden = false;
}
