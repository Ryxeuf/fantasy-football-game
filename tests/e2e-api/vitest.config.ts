import { defineConfig } from "vitest/config";

/**
 * Configuration Vitest pour la suite E2E API multijoueur.
 *
 * Les tests utilisent:
 *  - le vrai serveur Express + Socket.IO (apps/server) en SQLite in-memory
 *  - des clients REST (fetch) et Socket.IO (socket.io-client) parlant au vrai serveur
 *
 * threads=false garantit qu'un seul test écrit à la DB in-memory à la fois,
 * ce qui est indispensable tant que chaque spec fait /__test/reset en beforeEach.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["specs/**/*.spec.ts"],
    setupFiles: ["./setup.ts"],
    // Force TOUT à passer dans un unique fork: garantit qu'un seul serveur
    // Express/Socket.IO tourne pendant la suite (sinon on observe des
    // EADDRINUSE avec plusieurs workers concurrents).
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    sequence: { concurrent: false },
    fileParallelism: false,
  },
});
