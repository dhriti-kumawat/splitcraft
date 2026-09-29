import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// `@splitcraft/sdk/react`: an ES module that imports React and the main entry instead of
// bundling them, so there is one React and one SDK state.
const main = resolve(__dirname, 'src/index.ts');

export default defineConfig({
  build: {
    lib: {
      entry: 'src/react.ts',
      formats: ['es'],
      fileName: () => 'react.js',
    },
    rollupOptions: {
      external: ['react', main],
      output: { paths: { [main]: './splitcraft.js' } },
    },
    emptyOutDir: false,
    target: 'es2019',
    sourcemap: true,
  },
});
