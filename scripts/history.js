// Projects started, site versions, posts and site edits, grouped by day.
// Edits come from git. Hosts that build from a shallow clone fall back to
// content/edits.json, which every full-history build refreshes.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPosts } from './blog.js';

const ROOT = resolve(import.meta.dirname, '..');
const EDITS_CACHE = resolve(ROOT, 'content/edits.json');
const VERSIONS = resolve(ROOT, 'content/versions.json');
const PROJECTS = resolve(ROOT, 'content/projects.json');

function gitEdits() {
  try {
    const log = execFileSync('git', ['log', '--format=%ad%x09%s', '--date=short', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: ROOT, encoding: 'utf8' });
    if (shallow.trim() === 'true') return null;
    return log
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [date, ...msg] = line.split('\t');
        return { date, title: msg.join('\t') };
      });
  } catch {
    return null;
  }
}

function getEdits() {
  const fresh = gitEdits();
  if (fresh) {
    const json = `${JSON.stringify(fresh, null, 2)}\n`;
    if (!existsSync(EDITS_CACHE) || readFileSync(EDITS_CACHE, 'utf8') !== json) writeFileSync(EDITS_CACHE, json);
    return fresh;
  }
  return existsSync(EDITS_CACHE) ? JSON.parse(readFileSync(EDITS_CACHE, 'utf8')) : [];
}

// [{ date, projects: [], versions: [], posts: [], edits: [] }] sorted by date.
export function getHistory({ drafts = false } = {}) {
  const days = new Map();
  const day = (date) => {
    if (!days.has(date)) days.set(date, { date, projects: [], versions: [], posts: [], edits: [] });
    return days.get(date);
  };
  for (const p of JSON.parse(readFileSync(PROJECTS, 'utf8'))) day(p.date).projects.push(p);
  for (const v of JSON.parse(readFileSync(VERSIONS, 'utf8'))) day(v.date).versions.push(v);
  for (const p of getPosts({ drafts })) day(p.date).posts.push({ title: p.title, url: `/blog/${p.slug}/` });
  // git log is newest first; keep each day's edits in the order they happened.
  for (const e of getEdits().toReversed()) day(e.date).edits.push(e.title);
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
