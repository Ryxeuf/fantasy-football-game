import { defineConfig } from "vitest/config";
import { resolve } from "path";

/**
 * Configuration Vitest pour la suite d'intégration.
 *
 * Les specs parlent au VRAI serveur Express (apps/server) démarré par
 * `setup.ts` en SQLite in-memory.
 *
 * `threads: false` — l'option qui SÉRIALISAIT la suite — n'existe plus
 * depuis Vitest 2 : elle était silencieusement ignorée, chaque worker
 * exécutait donc `setup.ts` et tentait de démarrer SON serveur sur le même
 * port. D'où des `EADDRINUSE`, des serveurs qui meurent en cours de route,
 * et des specs rouges de façon intermittente (500 sur `/auth/register`,
 * `ECONNREFUSED`).
 *
 * On reprend la configuration éprouvée de la suite e2e-api : un fork unique,
 * aucun parallélisme de fichiers, donc un seul serveur pour toute la suite.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    globalSetup: ["./global-setup.ts"],
    setupFiles: ["./setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    sequence: { concurrent: false },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  // Les specs importent le serveur, qui importe les paquets internes par
  // leur nom. Sans ces alias, `vi.mock(..., importOriginal)` ne peut pas
  // résoudre `@bb/game-engine` (l'ancien mock TOTAL masquait le problème,
  // puisque le module réel n'était jamais chargé).
  resolve: {
    alias: {
      "@bb/game-engine": resolve(__dirname, "../../packages/game-engine/src"),
      "@bb/sim-engine": resolve(__dirname, "../../packages/sim-engine/src"),
      "@bb/shared-types": resolve(__dirname, "../../packages/shared-types/src"),
      "@bb/ui": resolve(__dirname, "../../packages/ui/src"),
    },
  },
});
