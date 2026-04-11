import { test, expect } from "@playwright/test";
import { resetDb, seedUser } from "../helpers/api-seed";
import { LoginPage } from "../pages/LoginPage";

/**
 * Specs Login : couvrent les chemins d'erreur et le redirect après
 * succès. Volontairement détachées de la fixture two-players, qui
 * fait elle-même un login implicite et masque donc ces scénarios.
 *
 * On valide :
 *  - le champ d'erreur s'affiche sur mauvais credentials
 *  - on reste sur /login après un échec
 *  - un login valide quitte /login (le front redirige vers /me → /me/teams)
 */
test.describe("E2E UI — login", () => {
  test.beforeEach(async () => {
    await resetDb();
    await seedUser("alice@playwright.test", "password-a", "Alice");
  });

  test("affiche login-error et reste sur /login en cas de mauvais mot de passe", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("alice@playwright.test", "wrong-password");

    // L'API répond 401, le front affiche le message dans login-error.
    await expect(login.errorMessage).toBeVisible({ timeout: 5_000 });
    // L'URL ne doit pas avoir changé (toujours sur /login).
    expect(new URL(page.url()).pathname).toBe("/login");
  });

  test("affiche login-error sur email inconnu", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("nobody@playwright.test", "whatever");

    await expect(login.errorMessage).toBeVisible({ timeout: 5_000 });
    expect(new URL(page.url()).pathname).toBe("/login");
  });

  test("login valide quitte /login (redirect vers /me ou /me/teams)", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("alice@playwright.test", "password-a");

    // Le front fait un window.location.href vers /me, qui re-redirige
    // vers /me/teams. On accepte les deux pour rester tolérant aux
    // évolutions du flow post-login.
    await page.waitForURL((url) => url.pathname.startsWith("/me"), {
      timeout: 15_000,
    });
    expect(new URL(page.url()).pathname).not.toBe("/login");
  });
});
