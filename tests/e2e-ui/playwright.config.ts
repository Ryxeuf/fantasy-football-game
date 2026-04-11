import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright pour la suite E2E multijoueur UI.
 *
 * Hypothèses:
 *  - le serveur API (apps/server) tourne déjà (en local via `make dev-server`
 *    ou en CI via docker-compose) et expose /health sur API_BASE_URL.
 *  - le front Next.js (apps/web) tourne sur WEB_BASE_URL.
 *
 * Pour démarrer automatiquement ces deux serveurs en CI, renseigner les
 * webServer entries ci-dessous (commentées pour le développement local où
 * les processus sont déjà lancés). En CI on pilote le boot via le workflow
 * GitHub Actions qui installe + seed + lance server/web avant d'invoquer
 * `playwright test`.
 */
const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "http://localhost:3100";
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:18002";

export default defineConfig({
  testDir: "./specs",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // match = ressource partagée, on séquence
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["junit", { outputFile: "reports/junit.xml" }],
  ],
  use: {
    baseURL: WEB_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // permet aux specs d'accéder à l'API directement pour les helpers seed
    extraHTTPHeaders: {},
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // webServer reste commenté: en local on lance les serveurs manuellement
  // (ou via `make dev`), en CI c'est le job GitHub Actions qui s'en charge.
  // webServer: [
  //   {
  //     command: "TEST_SQLITE=1 pnpm --filter @bb/server dev:nowatch",
  //     port: 18002,
  //     reuseExistingServer: true,
  //     timeout: 120_000,
  //   },
  //   {
  //     command: "pnpm --filter @bb/web dev",
  //     port: 3100,
  //     reuseExistingServer: true,
  //     timeout: 120_000,
  //   },
  // ],
});

export { API_BASE_URL, WEB_BASE_URL };
