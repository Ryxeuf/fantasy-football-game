import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: false,
    // S25.4 — `passWithNoTests` desactive : on veut qu'une suite vide
    // remonte en CI plutot que de passer silencieusement.
    passWithNoTests: false,
    root: resolve(__dirname),
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.ts',
        'src/seed.ts',
        'src/seeders/**',
        'src/scripts/**',
        'src/list-users.ts',
        'src/fix-admin.ts',
        'src/static-skills-data*.ts',
        'src/skills-descriptions-en.ts',
      ],
      // S25.4 — Seuils initiaux alignes sur la baseline mesuree avant
      // l'introduction des thresholds. Cible eventuelle DoD S25 :
      // lines >= 70% (server). On lift progressivement par PR.
      thresholds: {
        lines: 20,
        statements: 20,
        functions: 70,
        branches: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@bb/game-engine': resolve(__dirname, '../../packages/game-engine/src'),
    },
  },
});
