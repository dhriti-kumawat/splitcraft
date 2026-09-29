import { defineConfig } from 'vite';

// The CDN <script> tag build (window.splitcraft), from src/cdn.ts: the npm entry minus
// npm-only parts, to stay inside the size budget (decision #21).
export default defineConfig({
  build: {
    lib: {
      entry: 'src/cdn.ts',
      name: 'splitcraft',
      formats: ['iife'],
      fileName: () => 'splitcraft.iife.js',
    },
    emptyOutDir: false,
    target: 'es2019',
    sourcemap: true,
  },
});
