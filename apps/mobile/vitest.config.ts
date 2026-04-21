import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    root: resolve(__dirname),
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
