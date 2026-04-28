import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@bb/game-engine': path.resolve(__dirname, '../game-engine/src'),
    },
  },
  test: {
    // S25.4 — passWithNoTests off : une suite vide doit casser la CI.
    passWithNoTests: false,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'node_modules/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/test-setup.ts',
      ],
      // S25.4 — Seuils initiaux conservateurs alignes sur baseline.
      thresholds: {
        lines: 35,
        statements: 35,
        functions: 55,
        branches: 80,
      },
    },
  },
});
