// Turns content/posts/*.md into static pages under blog/ (gitignored).
// Front matter: title, date (YYYY-MM-DD), description, draft (true = dev only).
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { marked } from 'marked';

export const SITE_URL = 'https://gabrielle-neveu.com';
const ROOT = resolve(import.meta.dirname, '..');
const POSTS_DIR = resolve(ROOT, 'content/posts');
const OUT_DIR = resolve(ROOT, 'blog');

export const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const formatDate = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function parse(file) {
  const raw = readFileSync(file, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`Missing front matter in ${file}`);
  const meta = Object.fromEntries(
    match[1].split('\n').filter(Boolean).map((line) => {
      const i = line.indexOf(':');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
  );
  if (!meta.title || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date ?? '')) {
    throw new Error(`${file} needs a title and a YYYY-MM-DD date`);
  }
  return {
    ...meta,
    slug: basename(file, '.md'),
    draft: meta.draft === 'true',
    displayDate: formatDate(meta.date),
    html: marked.parse(match[2]),
  };
}

export function getPosts({ drafts = false } = {}) {
  if (!existsSync(POSTS_DIR)) return [];
  return readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parse(resolve(POSTS_DIR, f)))
    .filter((p) => drafts || !p.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function postRows(posts) {
  if (!posts.length) return '<p class="empty">First notes coming soon.</p>';
  return posts
    .map(
      (p) => `<a class="row" href="/blog/${p.slug}/">
            <span class="row-title">${escape(p.title)}${p.draft ? ' <small>(draft)</small>' : ''}</span>
            <span class="row-meta">${p.displayDate}</span>
          </a>`,
    )
    .join('\n          ');
}

const shell = ({ title, description, path, body }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <meta name="theme-color" content="#fbfaf2" />
    <link rel="canonical" href="${SITE_URL}${path}" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:url" content="${SITE_URL}${path}" />
    <link rel="icon" type="image/png" href="/pfp.png" />
    <link rel="alternate" type="application/rss+xml" title="Gabrielle Neveu" href="/feed.xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet" />
    <script type="module" src="/src/main.js"></script>
  </head>
  <body>
    <div class="page">
${body}
      <footer class="footer">
        <span>© ${new Date().getFullYear()} Gabrielle Neveu · Paris</span>
        <nav>
          <a href="/blog/">Writing</a>
          <a href="/work/">Work with me</a>
          <a href="/feed.xml">RSS</a>
        </nav>
      </footer>
    </div>
  </body>
</html>
`;

function postPage(p) {
  return shell({
    title: `${p.title} · Gabrielle Neveu`,
    description: p.description || p.title,
    path: `/blog/${p.slug}/`,
    body: `      <a class="back" href="/blog/">← Writing</a>
      <article>
        <header class="page-head">
          <p class="dateline"><time datetime="${p.date}">${p.displayDate}</time></p>
          <h1>${escape(p.title)}</h1>
          ${p.description ? `<p class="lede">${escape(p.description)}</p>` : ''}
        </header>
        <div class="prose">
${p.html}
        </div>
      </article>`,
  });
}

function indexPage(posts) {
  return shell({
    title: 'Writing · Gabrielle Neveu',
    description: 'Notes on building products, design, taste and running a small studio.',
    path: '/blog/',
    body: `      <a class="back" href="/">← Gabrielle Neveu</a>
      <header class="page-head">
        <h1>Writing</h1>
        <p class="lede">Notes on building products, design, taste and running a small studio.</p>
      </header>
      <div class="rows">
          ${postRows(posts)}
      </div>`,
  });
}

export function feed(posts) {
  const items = posts
    .map(
      (p) => `    <item>
      <title>${escape(p.title)}</title>
      <link>${SITE_URL}/blog/${p.slug}/</link>
      <guid>${SITE_URL}/blog/${p.slug}/</guid>
      <pubDate>${new Date(`${p.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${escape(p.description || '')}</description>
    </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Gabrielle Neveu</title>
    <link>${SITE_URL}/blog/</link>
    <description>Notes on building products, design, taste and running a small studio.</description>
${items}
  </channel>
</rss>
`;
}

// Map of URL path -> HTML for every blog page.
export function renderBlog({ drafts = false } = {}) {
  const posts = getPosts({ drafts });
  const pages = { '/blog/': indexPage(posts) };
  for (const p of posts) pages[`/blog/${p.slug}/`] = postPage(p);
  return pages;
}

// Writes the pages to blog/ for the production build. Returns Rollup inputs.
export function generateBlog() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  const inputs = {};
  for (const [path, html] of Object.entries(renderBlog())) {
    const dir = resolve(ROOT, `.${path}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'index.html'), html);
    inputs[path.slice(1, -1)] = resolve(dir, 'index.html');
  }
  return inputs;
}
