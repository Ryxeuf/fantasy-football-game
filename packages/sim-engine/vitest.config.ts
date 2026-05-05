import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Path-mapped workspace packages : sim-engine consumes them at runtime
  // (resolvers call `calculateBlockDiceCount`, `getPassRange`, etc.) so we
  // mirror the tsconfig.base.json `paths` for vitest's module resolver.
  resolve: {
    alias: {
      '@bb/game-engine': resolve(__dirname, '../game-engine/src/index.ts'),
      '@bb/shared-types': resolve(__dirname, '../shared-types/src/index.ts'),
    },
  },
  test: {
    passWithNoTests: false,
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.ts',
        'src/index.ts',
      ],
      thresholds: {
        lines: 0,
        statements: 0,
        functions: 25,
        branches: 25,
      },
    },
  },
});
