// Freezes a past version of the site into public/<name>/ so it stays online.
// Usage: node scripts/snapshot.js <name> <git-ref>   e.g. node scripts/snapshot.js v1 main
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [name, ref] = process.argv.slice(2);
if (!name || !ref) {
  console.error('Usage: node scripts/snapshot.js <name> <git-ref>');
  process.exit(1);
}

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'public', name);
const MAX_IMAGE_BYTES = 500_000;
const run = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

const tmp = mkdtempSync(join(tmpdir(), `site-${name}-`));
try {
  run('git', ['worktree', 'add', '--detach', tmp, ref]);
  run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], tmp);
  rmSync(OUT, { recursive: true, force: true });
  run('pnpm', ['exec', 'vite', 'build', '--base', `/${name}/`, '--outDir', OUT, '--emptyOutDir'], tmp);
} finally {
  run('git', ['worktree', 'remove', '--force', tmp]);
}

// Later versions carry earlier snapshots in public/; don't nest them.
for (const dir of readdirSync(OUT)) {
  if (/^v\d+$/.test(dir)) rmSync(join(OUT, dir), { recursive: true, force: true });
}

// Old versions don't need print-size photos.
for (const file of readdirSync(OUT, { recursive: true })) {
  const path = join(OUT, file);
  if (/\.(png|jpe?g)$/i.test(file) && statSync(path).size > MAX_IMAGE_BYTES) {
    run('sips', ['-Z', '480', path], ROOT);
  }
}

// A small pill on every page pointing back to the live site.
const banner = `<a href="/" style="position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;padding:9px 16px;border-radius:999px;background:#111;color:#fff;font:500 13px/1.2 -apple-system,BlinkMacSystemFont,sans-serif;text-decoration:none;box-shadow:0 6px 24px rgba(0,0,0,.18)">Archived ${name} · back to today →</a>`;
for (const file of readdirSync(OUT, { recursive: true })) {
  if (!file.endsWith('.html')) continue;
  const path = join(OUT, file);
  writeFileSync(path, readFileSync(path, 'utf8').replace('</body>', `  ${banner}\n  </body>`));
}

if (!existsSync(join(OUT, 'index.html'))) throw new Error('Snapshot has no index.html');
console.log(`Snapshot ${name} (${ref}) written to public/${name}/`);
