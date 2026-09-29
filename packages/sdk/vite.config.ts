import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      // ES module for npm consumers. The CDN <script> build is vite.cdn.config.ts.
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'splitcraft.js',
    },
    target: 'es2019',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
