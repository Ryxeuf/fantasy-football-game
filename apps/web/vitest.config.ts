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
    // S25.4 — passWithNoTests off : une suite vide doit casser la CI.
    passWithNoTests: false,
    environment: "jsdom",
    globals: true,
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["app/**/*.ts", "app/**/*.tsx"],
      exclude: [
        "node_modules/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/*.test.ts",
        "**/*.test.tsx",
        // Pages Next.js de scaffolding sans logique testable (pages
        // marketing, layouts simples). A couvrir progressivement.
        "app/**/layout.tsx",
        "app/**/loading.tsx",
        "app/**/not-found.tsx",
        "app/**/error.tsx",
      ],
      // S25.4 — Seuils initiaux alignes sur la baseline mesuree.
      // Cible DoD S25 : lines >= 70% sur web. Lift progressif par PR.
      thresholds: {
        lines: 10,
        statements: 10,
        functions: 50,
        branches: 65,
      },
    },
  },
});
