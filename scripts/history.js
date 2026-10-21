// Projects started and site versions, grouped by day.
// Posts are left out while Writing is hidden; add them back with the loop below.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const VERSIONS = resolve(ROOT, 'content/versions.json');
const PROJECTS = resolve(ROOT, 'content/projects.json');
const WORK = resolve(ROOT, 'content/work.json');

// [{ date, projects: [], versions: [], posts: [] }] sorted by date.
export function getHistory() {
  const days = new Map();
  const day = (date) => {
    if (!days.has(date)) days.set(date, { date, projects: [], versions: [], posts: [] });
    return days.get(date);
  };
  for (const p of JSON.parse(readFileSync(PROJECTS, 'utf8'))) day(p.date).projects.push(p);
  for (const v of JSON.parse(readFileSync(VERSIONS, 'utf8'))) day(v.date).versions.push(v);
  // for (const p of getPosts({ drafts })) day(p.date).posts.push({ title: p.title, url: `/blog/${p.slug}/` });
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Jobs, shown as spans: [{ id, title, role, from: 'YYYY', to: 'YYYY', url?, preview? }].
export function getWork() {
  return JSON.parse(readFileSync(WORK, 'utf8'));
}
