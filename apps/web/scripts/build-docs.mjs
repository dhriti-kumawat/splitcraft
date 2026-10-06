// Builds the developer docs (docs/developer/*.md) into static pages at /docs/.
// Each file: front matter (title, description) + Markdown. Order comes from the number
// prefix; "01-overview" becomes /docs/, "04-sdk" becomes /docs/sdk/.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Marked } from 'marked';

const root = new URL('../../../', import.meta.url);
const srcDir = new URL('docs/developer/', root);
const dashboard = (process.env.VITE_DASHBOARD_URL ?? 'https://splitcraft-app.vercel.app').replace(
  /\/$/,
  '',
);
const github = 'https://github.com/dhriti-kumawat/splitcraft';

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const href = (slug) => (slug ? `/docs/${slug}/` : '/docs/');

function render(page) {
  const headings = [];
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = slugify(text);
        if (depth === 2) headings.push({ id, text });
        if (depth === 1) return `<h1>${text}</h1>\n`;
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${text}</h${depth}>\n`;
      },
      link({ href: target, tokens }) {
        const text = this.parser.parseInline(tokens);
        let url = target;
        // Links between pages are written as "sdk" or "sdk#variant-code".
        if (!/^([a-z]+:|\/|#)/i.test(target)) {
          const [slug, hash] = target.split('#');
          url = href(slug === 'overview' ? '' : slug) + (hash ? `#${hash}` : '');
        }
        const external = /^https?:/.test(url);
        return `<a href="${escape(url)}"${external ? ' rel="noopener"' : ''}>${text}</a>`;
      },
    },
  });
  const html = marked.parse(page.body);
  return { html, headings };
}

function layout(pages, page, { html, headings }) {
  const nav = pages
    .map(
      (p) =>
        `<li><a href="${href(p.slug)}"${p === page ? ' aria-current="page"' : ''}>${escape(p.title)}</a></li>`,
    )
    .join('');
  const toc = headings.length
    ? `<nav class="toc" aria-label="On this page"><p class="toc-title">On this page</p><ul>${headings
        .map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`)
        .join('')}</ul></nav>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(page.title)} · Splitcraft docs</title>
<meta name="description" content="${escape(page.description ?? '')}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
<link rel="stylesheet" href="/docs/tokens.css" />
<link rel="stylesheet" href="/docs/docs.css" />
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="top">
  <a class="brand" href="/"><img src="/favicon.svg" alt="" width="26" height="26" />Splitcraft <span>Docs</span></a>
  <nav class="top-links" aria-label="Site">
    <a href="/">Home</a>
    <a href="${github}">GitHub</a>
    <a class="cta" href="${dashboard}/login">Open dashboard</a>
  </nav>
</header>
<div class="layout">
  <details class="side" open>
    <summary>Docs menu</summary>
    <nav aria-label="Docs"><ul>${nav}</ul></nav>
  </details>
  <main id="content" class="content" tabindex="-1">
    <article>${html}</article>
    <p class="edit"><a href="${github}/blob/main/docs/developer/${page.file}">Edit this page on GitHub</a></p>
  </main>
  ${toc}
</div>
<script>
  // Phones: start with the docs menu closed.
  if (matchMedia('(max-width: 760px)').matches) document.querySelector('.side').removeAttribute('open');
</script>
</body>
</html>
`;
}

/** Build every page into `outDir` (a file URL ending in /). Returns the page count. */
export function buildDocs(outDir) {
  const pages = readdirSync(srcDir)
    .filter((f) => /^\d+-.+\.md$/.test(f))
    .sort()
    .map((file) => {
      const raw = readFileSync(new URL(file, srcDir), 'utf8');
      const [, front, body] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
      if (!front) throw new Error(`${file}: missing front matter`);
      const meta = Object.fromEntries(
        front
          .split('\n')
          .map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]),
      );
      const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '');
      return {
        file,
        slug: slug === 'overview' ? '' : slug,
        title: meta.title,
        description: meta.description,
        body,
      };
    });
  mkdirSync(outDir, { recursive: true });
  pages.forEach((page) => {
    const dir = new URL(page.slug ? `${page.slug}/` : '', outDir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('index.html', dir), layout(pages, page, render(page)));
  });
  copyFileSync(new URL('design/tokens.css', root), new URL('tokens.css', outDir));
  copyFileSync(new URL('../src/docs.css', import.meta.url), new URL('docs.css', outDir));
  return pages.length;
}

// Run directly (npm run build / npm run docs): write dist/docs/.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = buildDocs(new URL('../dist/docs/', import.meta.url));
  console.log(`Built ${count} docs pages into dist/docs/`);
}
