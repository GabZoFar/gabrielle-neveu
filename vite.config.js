import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { generateBlog, renderBlog, getPosts, postRows, feed } from './scripts/blog.js';
import { getHistory } from './scripts/history.js';
import { getActivity } from './worker/activity.js';

const CONTENT_DIR = resolve(import.meta.dirname, 'content');

// Blog pages are rendered from content/posts. Dev serves them from memory
// (drafts included); the build writes them to blog/ as extra entry points.
function blog() {
  let drafts = false;
  return {
    name: 'blog',
    config(_, { command }) {
      drafts = command === 'serve';
      if (drafts) return;
      return {
        build: {
          rollupOptions: {
            input: {
              main: resolve(import.meta.dirname, 'index.html'),
              work: resolve(import.meta.dirname, 'work/index.html'),
              ...generateBlog(),
            },
          },
        },
      };
    },
    // Fills the "Writing" list and the history timeline on the landing page.
    transformIndexHtml(html) {
      const history = JSON.stringify(getHistory()).replace(/</g, '\\u003c');
      return html
        .replace('<!-- posts -->', postRows(getPosts({ drafts }).slice(0, 5)))
        .replace('<!-- history -->', history);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'feed.xml', source: feed(getPosts()) });
    },
    configureServer(server) {
      // Mirrors worker/index.js so the activity section works in dev.
      server.middlewares.use('/api/activity', async (_, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(await getActivity(process.env)));
      });
      // Archived versions live in public/vN/; serve their index like production does.
      server.middlewares.use((req, res, next) => {
        const match = req.url.split('?')[0].match(/^\/(v\d+)\/?$/);
        const file = match && resolve(import.meta.dirname, 'public', match[1], 'index.html');
        if (!file || !existsSync(file)) return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(readFileSync(file));
      });
      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split('?')[0].replace(/\/?$/, '/');
        const html = path.startsWith('/blog/') && renderBlog({ drafts: true })[path];
        if (!html) return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml(path, html));
      });
      server.watcher.add(CONTENT_DIR);
      server.watcher.on('all', (_, file) => {
        if (file.startsWith(CONTENT_DIR)) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  plugins: [blog()],
});
