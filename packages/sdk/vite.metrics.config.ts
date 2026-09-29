import { defineConfig } from 'vite';

// The metrics bundle (browsing and Web Vitals goals) ships as its own file, loaded only when
// a live experiment uses those goals (decision #21).
export default defineConfig({
  build: {
    lib: {
      entry: 'src/metrics/entry.ts',
      name: 'splitcraftMetrics',
      formats: ['iife'],
      fileName: () => 'splitcraft-metrics.iife.js',
    },
    emptyOutDir: false,
    target: 'es2019',
    sourcemap: true,
  },
});
