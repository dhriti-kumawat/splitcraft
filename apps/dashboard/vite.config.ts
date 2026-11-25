import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The app, plus the public demo (example data, no account). preview.html stays dev-only.
  build: {
    rollupOptions: {
      input: { main: 'index.html', demo: 'demo.html' },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
