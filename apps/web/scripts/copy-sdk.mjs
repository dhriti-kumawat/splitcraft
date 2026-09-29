// Copies the built SDK into the site so it is served at /sdk/v1.js.
import { copyFileSync, mkdirSync } from 'node:fs';

const from = new URL('../../../packages/sdk/dist/', import.meta.url);
const to = new URL('../dist/sdk/', import.meta.url);
mkdirSync(to, { recursive: true });
copyFileSync(new URL('splitcraft.iife.js', from), new URL('v1.js', to));
copyFileSync(new URL('splitcraft-qa.iife.js', from), new URL('splitcraft-qa.iife.js', to));
