// Put the server-rendered pages into dist (index.html and <page>/index.html) so the first
// paint needs no JavaScript.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const serverEntry = new URL('../dist-ssr/entry-server.js', import.meta.url);
const { render, pages } = await import(serverEntry.href);
const PAGES = pages();
const htmlPath = new URL('../dist/index.html', import.meta.url);
const html = readFileSync(htmlPath, 'utf8');
if (!html.includes('<!--app-->')) throw new Error('dist/index.html has no <!--app--> placeholder');

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
for (const [path, page] of Object.entries(PAGES)) {
  const out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escape(page.description)}$2`)
    .replace('<!--app-->', render(path));
  const dir = new URL(`../dist${path}`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('index.html', dir), out);
}
writeFileSync(htmlPath, html.replace('<!--app-->', render('/')));
rmSync(new URL('../dist-ssr', import.meta.url), { recursive: true, force: true });
console.log(`Pre-rendered dist/index.html and ${Object.keys(PAGES).length} pages`);
