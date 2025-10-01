import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@bb/game-engine": resolve(__dirname, "../packages/game-engine/src"),
      "@bb/ui": resolve(__dirname, "../packages/ui/src"),
    },
  },
});
