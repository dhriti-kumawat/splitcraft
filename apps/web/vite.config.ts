import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the site from /splitly/ (see .github/workflows/pages.yml).
  base: process.env.WEB_BASE ?? '/',
  plugins: [react()],
  // The dashboard uses 5173 in development.
  server: { port: 5174 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
