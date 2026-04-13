import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    root: resolve(__dirname),
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@bb/game-engine': resolve(__dirname, '../../packages/game-engine/src'),
    },
  },
});
