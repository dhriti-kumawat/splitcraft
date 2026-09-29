import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// @ts-expect-error: plain JS build script, no types
import { docsDev } from './scripts/docs-dev.mjs';

export default defineConfig({
  // Set WEB_BASE when the site is served from a subpath.
  base: process.env.WEB_BASE ?? '/',
  plugins: [react(), docsDev()],
  // The dashboard uses 5173 in development.
  server: { port: 5174 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
