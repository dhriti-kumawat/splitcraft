import { defineConfig } from 'vite';

// The preview bundle (window.splitcraftPreview): loaded only by the preview extension or
// bookmark, so it never counts against the main SDK's budget (decision #29).
export default defineConfig({
  build: {
    lib: {
      entry: 'src/preview/entry.ts',
      name: 'splitcraftPreview',
      formats: ['iife'],
      fileName: () => 'splitcraft-preview.iife.js',
    },
    emptyOutDir: false,
    target: 'es2019',
    sourcemap: true,
  },
});
