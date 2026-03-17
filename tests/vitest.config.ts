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
      "integration/admin-middleware.test.ts",
      "integration/auth.test.ts",
      "integration/local-stats-features.test.ts",
      "integration/match-endpoints.test.ts",
      "integration/match-start.test.ts",
      "ui/PlayByIdHeader.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@bb/game-engine": resolve(__dirname, "../packages/game-engine/src"),
      "@bb/ui": resolve(__dirname, "../packages/ui/src"),
    },
  },
});
