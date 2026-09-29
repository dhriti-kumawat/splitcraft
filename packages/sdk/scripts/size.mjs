// Fail the build when a CDN bundle grows past its gzipped budget (decision #17).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const budgets = [
  { file: 'dist/splitcraft.iife.js', maxBytes: 7000 },
  { file: 'dist/splitcraft-qa.iife.js', maxBytes: 3000 },
];

let failed = false;
for (const { file, maxBytes } of budgets) {
  const size = gzipSync(readFileSync(new URL(`../${file}`, import.meta.url)), { level: 9 }).length;
  const ok = size <= maxBytes;
  failed ||= !ok;
  const pct = ((size / maxBytes) * 100).toFixed(0);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${file}: ${size} B gzipped (budget ${maxBytes} B, ${pct}%)`);
}

if (failed) {
  console.error('\nBundle over budget. Trim code or agree a new budget in docs/DECISIONS.md.');
  process.exit(1);
}
