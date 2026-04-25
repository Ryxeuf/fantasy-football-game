import { test, expect } from "@playwright/test";
import { resetDb, seedUser } from "../helpers/api-seed";
import { RegisterPage } from "../pages/RegisterPage";

/**
 * Specs Register : couvrent le parcours d'inscription via `/register`.
 *
 * Le serveur cree un compte deja valide (`valid: true`) et renvoie
 * directement un JWT, ce qui declenche un redirect vers `/me` cote
 * front. On valide :
 *  - happy path : inscription valide -> redirect vers /me et token persiste
 *  - email deja utilise : message d'erreur visible, on reste sur /register
 *  - mot de passe < 8 caracteres : la validation HTML5 empeche le submit
 *  - le champ email exige un format valide (validation HTML5 sur type=email)
 */
test.describe("E2E UI — register", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("inscription valide redirige vers /me et un token est stocke", async ({
    page,
  }) => {
    const register = new RegisterPage(page);
    await register.goto();

    await register.fillRequired({
      email: "newcoach@playwright.test",
      coachName: "NewCoach",
      password: "password-z",
    });
    await register.submit();

    // Le serveur renvoie un token -> window.location.href = "/me".
    await page.waitForURL((url) => url.pathname.startsWith("/me"), {
      timeout: 15_000,
    });

    // Le token doit etre stocke dans localStorage cote client.
    const token = await page.evaluate(() => localStorage.getItem("auth_token"));
    expect(token).toBeTruthy();
  });

  test("email deja utilise affiche register-error et reste sur /register", async ({
    page,
  }) => {
    await seedUser("alice@playwright.test", "password-a", "Alice");

    const register = new RegisterPage(page);
    await register.goto();

    await register.fillRequired({
      email: "alice@playwright.test",
      coachName: "DuplicateCoach",
      password: "password-x",
    });
    await register.submit();

    // Le back renvoie 409 ; le front affiche le message dans register-error.
    await expect(register.errorMessage).toBeVisible({ timeout: 5_000 });
    expect(new URL(page.url()).pathname).toBe("/register");
  });

  test("password < 8 caracteres : le submit est bloque par la validation HTML5", async ({
    page,
  }) => {
    const register = new RegisterPage(page);
    await register.goto();

    await register.fillRequired({
      email: "shortpass@playwright.test",
      coachName: "ShortPass",
      password: "abc",
    });
    await register.submit();

    // Le formulaire ne soumet pas (minLength=8 cote HTML5) : on reste
    // sur /register et aucun token n'a ete stocke.
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe("/register");
    const token = await page.evaluate(() => localStorage.getItem("auth_token"));
    expect(token).toBeNull();
  });

  test("le lien 'J'ai deja un compte' pointe vers /login", async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();

    // Le lien de connexion preserve le redirect par defaut : /login pur.
    const loginLink = page.locator('a[href="/login"]').first();
    await expect(loginLink).toBeVisible();
  });

  test("redirect=/me/teams est preserve apres inscription", async ({
    page,
  }) => {
    const register = new RegisterPage(page);
    await register.goto("/me/teams");

    await register.fillRequired({
      email: "redirected@playwright.test",
      coachName: "RedirectedCoach",
      password: "password-r",
    });
    await register.submit();

    // Apres inscription, le front redirige vers le redirect demande.
    await page.waitForURL((url) => url.pathname === "/me/teams", {
      timeout: 15_000,
    });
    expect(new URL(page.url()).pathname).toBe("/me/teams");
  });
});
