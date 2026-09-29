import { defineConfig } from 'vite';

// The QA panel ships as its own file, loaded only when ?splitly_force is in the URL,
// so it never counts against the main SDK's 5 KB budget.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/qa/entry.ts',
      name: 'splitlyQa',
      formats: ['iife'],
      fileName: () => 'splitly-qa.iife.js',
    },
    emptyOutDir: false,
    target: 'es2019',
    sourcemap: true,
  },
});
