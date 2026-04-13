import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@bb/game-engine": path.resolve(__dirname, "../../packages/game-engine/src"),
      "@bb/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["app/**/*.ts", "app/**/*.tsx"],
      exclude: ["node_modules/", "**/*.d.ts", "**/*.config.*", "**/*.test.ts", "**/*.test.tsx"],
    },
  },
});
