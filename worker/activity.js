// Active days from GitHub and Palmares, as [{ date: 'YYYY-MM-DD', level: 0-4 }].
const GITHUB_USER = 'GabZoFar';
const PALMARES_URL = 'https://palmares.madame-studio.com/api/active-days';

export async function githubDays(user = GITHUB_USER) {
  const res = await fetch(`https://github.com/users/${user}/contributions`, {
    headers: { 'User-Agent': 'gabrielle-neveu.com' },
  });
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const html = await res.text();
  const days = [];
  for (const [cell] of html.matchAll(/<td[^>]*data-date="[^"]+"[^>]*>/g)) {
    const date = cell.match(/data-date="([^"]+)"/)[1];
    const level = Number(cell.match(/data-level="(\d)"/)?.[1] ?? 0);
    days.push({ date, level });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

// Palmares' /api/active-days returns the same [{ date, level }] shape.
export async function palmaresDays(url = PALMARES_URL) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Palmares responded ${res.status}`);
  return res.json();
}

export async function getActivity(env = {}) {
  const [github, palmares] = await Promise.allSettled([githubDays(), palmaresDays(env.PALMARES_ACTIVITY_URL || undefined)]);
  return {
    github: github.status === 'fulfilled' ? github.value : null,
    palmares: palmares.status === 'fulfilled' ? palmares.value : null,
  };
}
