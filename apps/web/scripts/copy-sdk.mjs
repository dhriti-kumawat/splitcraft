// Copies the built SDK into the site so it is served at /sdk/v1.js, and the preview
// extension zip to /extension/splitcraft-preview.zip.
import { copyFileSync, mkdirSync } from 'node:fs';

const from = new URL('../../../packages/sdk/dist/', import.meta.url);
const to = new URL('../dist/sdk/', import.meta.url);
mkdirSync(to, { recursive: true });
copyFileSync(new URL('splitcraft.iife.js', from), new URL('v1.js', to));
copyFileSync(new URL('splitcraft-qa.iife.js', from), new URL('splitcraft-qa.iife.js', to));
copyFileSync(
  new URL('splitcraft-metrics.iife.js', from),
  new URL('splitcraft-metrics.iife.js', to),
);
copyFileSync(
  new URL('splitcraft-preview.iife.js', from),
  new URL('splitcraft-preview.iife.js', to),
);
const ext = new URL('../dist/extension/', import.meta.url);
mkdirSync(ext, { recursive: true });
copyFileSync(
  new URL('../../extension/dist/splitcraft-preview.zip', import.meta.url),
  new URL('splitcraft-preview.zip', ext),
);
