import { test as base, type BrowserContext, type Page } from "@playwright/test";
import { resetDb, seedTwoCoaches } from "../helpers/api-seed";
import { LoginPage } from "../pages/LoginPage";

/**
 * Fixture Playwright qui installe 2 contextes de navigateur isolés
 * (un pour Alice, un pour Bob) et les connecte automatiquement.
 *
 * Usage:
 *
 *     import { test, expect } from "../fixtures/two-players";
 *
 *     test("Alice crée un match, Bob le rejoint", async ({ alice, bob }) => {
 *       await alice.page.goto("/play");
 *       await bob.page.goto("/play");
 *       ...
 *     });
 *
 * Les pages Alice/Bob sont déjà loggées avant chaque test.
 */
export interface PlayerContext {
  context: BrowserContext;
  page: Page;
  email: string;
  userId: string;
  teamId: string;
}

interface TwoPlayersFixtures {
  alice: PlayerContext;
  bob: PlayerContext;
}

export const test = base.extend<TwoPlayersFixtures>({
  alice: async ({ browser }, use) => {
    await resetDb();
    const coaches = await seedTwoCoaches();

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const login = new LoginPage(page);
    await login.goto();
    await login.login(coaches.alice.email, coaches.alice.password);
    // Le front redirige après login — on attend que /play soit accessible.
    await page.waitForURL(/\/(play|team)/, { timeout: 15_000 });

    await use({
      context: ctx,
      page,
      email: coaches.alice.email,
      userId: coaches.alice.userId,
      teamId: coaches.alice.teamId,
    });

    await ctx.close();
  },

  bob: async ({ browser }, use) => {
    // bob réutilise le seed fait par alice (même beforeEach).
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const login = new LoginPage(page);
    await login.goto();
    await login.login("bob@playwright.test", "password-b");
    await page.waitForURL(/\/(play|team)/, { timeout: 15_000 });

    await use({
      context: ctx,
      page,
      email: "bob@playwright.test",
      userId: "",
      teamId: "",
    });

    await ctx.close();
  },
});

export { expect } from "@playwright/test";
