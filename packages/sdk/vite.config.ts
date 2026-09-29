import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'splitly',
      // ES module for npm consumers, IIFE for the CDN <script> tag.
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'splitly.js' : 'splitly.iife.js'),
    },
    target: 'es2019',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
