// Vite plugin: serve the developer docs at /docs/ in `npm run dev`, rebuilt whenever a
// docs page or docs.css changes. Production builds write them with build-docs.mjs.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDocs } from './build-docs.mjs';

const TYPES = { '.html': 'text/html', '.css': 'text/css' };

export function docsDev() {
  const outDir = new URL('../node_modules/.cache/docs/', import.meta.url);
  const out = fileURLToPath(outDir);
  const build = () => {
    try {
      buildDocs(outDir);
    } catch (err) {
      console.error('[docs]', err);
    }
  };
  return {
    name: 'splitcraft-docs-dev',
    apply: 'serve',
    configureServer(server) {
      build();
      const sources = [
        fileURLToPath(new URL('../../../docs/developer/', import.meta.url)),
        fileURLToPath(new URL('../src/docs.css', import.meta.url)),
      ];
      server.watcher.add(sources);
      server.watcher.on('all', (_event, file) => {
        if (sources.some((s) => file.startsWith(s))) build();
      });
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (path === '/docs') {
          res.statusCode = 301;
          res.setHeader('Location', '/docs/');
          res.end();
          return;
        }
        if (!path.startsWith('/docs/')) return next();
        let file = out + decodeURIComponent(path.slice('/docs/'.length));
        if (existsSync(file) && statSync(file).isDirectory()) file += '/index.html';
        if (file.endsWith('/')) file += 'index.html';
        if (!file.startsWith(out) || !existsSync(file)) return next();
        res.setHeader('Content-Type', TYPES[file.slice(file.lastIndexOf('.'))] ?? 'text/plain');
        res.end(readFileSync(file));
      });
    },
  };
}
