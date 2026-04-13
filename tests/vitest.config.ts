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
      "integration/admin-middleware.test.ts",
      "integration/auth.test.ts",
      "integration/local-stats-features.test.ts",
      "integration/match-endpoints.test.ts",
      "integration/match-start.test.ts",
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
      exclude: ["node_modules/", "**/*.d.ts", "**/*.config.*", "**/*.test.ts", "**/*.test.tsx"],
    },
  },
  resolve: {
    alias: {
      "@bb/game-engine": resolve(__dirname, "../packages/game-engine/src"),
      "@bb/ui": resolve(__dirname, "../packages/ui/src"),
    },
  },
});
