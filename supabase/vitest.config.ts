import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Each test file boots its own in-process Postgres; give it time on cold CI runners.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
