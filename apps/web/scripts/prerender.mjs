// Put the server-rendered page into dist/index.html so the first paint needs no JavaScript.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const serverEntry = new URL('../dist-ssr/entry-server.js', import.meta.url);
const { render } = await import(serverEntry.href);
const htmlPath = new URL('../dist/index.html', import.meta.url);
const html = readFileSync(htmlPath, 'utf8');
if (!html.includes('<!--app-->')) throw new Error('dist/index.html has no <!--app--> placeholder');
writeFileSync(htmlPath, html.replace('<!--app-->', render()));
rmSync(new URL('../dist-ssr', import.meta.url), { recursive: true, force: true });
console.log('Pre-rendered dist/index.html');
