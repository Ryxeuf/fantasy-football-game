import { defineConfig } from 'vitest/config';

export default defineConfig({
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
        functions: 50,
        branches: 50,
      },
    },
  },
});
