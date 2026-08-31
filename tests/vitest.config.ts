import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    passWithNoTests: true,
    setupFiles: ["./vitest-setup.ts"],
    exclude: [
      "**/node_modules/**",
      "e2e-api/**",
      "e2e-ui/**",
      // `integration/**` a SON workspace (`tests/integration`), qui démarre
      // le serveur dont ces specs dépendent. Le workspace racine en excluait
      // cinq nommément, mais pas les autres : `public-rosters` y tournait
      // donc sans serveur et expirait au hook (10 s).
      "integration/**",
      "ui/PlayByIdHeader.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "../packages/game-engine/src/**/*.ts",
        "../packages/ui/src/**/*.ts",
        "../packages/ui/src/**/*.tsx",
      ],
      exclude: [
        "node_modules/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/*.test.ts",
        "**/*.test.tsx",
      ],
    },
  },
  resolve: {
    alias: {
      "@bb/game-engine": resolve(__dirname, "../packages/game-engine/src"),
      "@bb/ui": resolve(__dirname, "../packages/ui/src"),
    },
  },
});
