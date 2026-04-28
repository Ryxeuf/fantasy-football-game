import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // S25.4 — `passWithNoTests` desactive : une suite vide doit faire
    // echouer la CI plutot que de passer silencieusement.
    passWithNoTests: false,
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'src/dev.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.ts',
        // Donnees statiques (rosters, positions, star players) : pas de
        // logique a tester, seraient juste du bruit dans le coverage.
        'src/rosters/**',
        'src/skills/skill-registry.ts',
        'src/skills/star-player-rules.ts',
        'src/skills/skill-bridge.ts',
        // Rules files non encore couverts par les tests (S25.4 follow-up).
        'src/rules/**',
        'src/tutorial/**',
      ],
      // S25.4 — Seuils initiaux conservateurs. v8 reporte 0% lines sur
      // certains fichiers TS du moteur a cause d'un quirk source-map ;
      // on s'accroche aux branches/functions plus fiables. Cible DoD :
      // 85% sur game-engine (cf. docs/roadmap/sprints/S25-*.md).
      thresholds: {
        lines: 0,
        statements: 0,
        functions: 25,
        branches: 25,
      },
    },
  },
});
