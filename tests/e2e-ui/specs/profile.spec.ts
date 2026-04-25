import { test, expect } from "@playwright/test";
import { resetDb, seedUser } from "../helpers/api-seed";
import { LoginPage } from "../pages/LoginPage";
import { ProfilePage } from "../pages/ProfilePage";

/**
 * Specs Profile : couvrent la consultation et l'edition du profil
 * (`/me/profile`). C'est le hub des informations personnelles, des
 * stats agregees (ELO, equipes, matchs joues) et des actions sensibles
 * (changement de mot de passe, suppression de compte).
 *
 * On valide :
 *  - la page se charge avec les infos seedees apres login
 *  - le bouton Modifier ouvre le formulaire d'edition (champs prerennplis)
 *  - Annuler restaure le profil sans changement persiste
 *  - les sections Statistiques et Securite sont visibles
 */
test.describe("E2E UI — profile", () => {
  test.beforeEach(async () => {
    await resetDb();
    await seedUser("alice@playwright.test", "password-a", "Alice");
  });

  test("affiche le profil avec coachName, email et stats", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("alice@playwright.test", "password-a");
    await page.waitForURL((url) => url.pathname.startsWith("/me"), {
      timeout: 15_000,
    });

    const profile = new ProfilePage(page);
    await profile.goto();
    await profile.waitUntilLoaded();

    // Le coach name (ou nom par defaut) doit etre visible.
    await expect(page.getByText(/alice/i).first()).toBeVisible({
      timeout: 5_000,
    });
    // L'email seede doit apparaitre.
    await expect(
      page.getByText("alice@playwright.test").first(),
    ).toBeVisible();

    // Les sections critiques doivent etre rendues.
    await expect(profile.statsSection).toBeVisible();
    await expect(profile.securitySection).toBeVisible();
    await expect(profile.editButton).toBeVisible();
  });

  test("le bouton Modifier ouvre le formulaire d'edition", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("alice@playwright.test", "password-a");
    await page.waitForURL((url) => url.pathname.startsWith("/me"), {
      timeout: 15_000,
    });

    const profile = new ProfilePage(page);
    await profile.goto();
    await profile.waitUntilLoaded();

    await profile.editButton.click();

    // En mode edition, l'email + coachName apparaissent en input editable
    // et les boutons Enregistrer/Annuler sont presents.
    await expect(profile.saveButton).toBeVisible({ timeout: 5_000 });
    await expect(profile.cancelButton).toBeVisible();
    await expect(profile.emailInput).toHaveValue("alice@playwright.test");
  });

  test("Annuler ferme l'edition sans casser la page", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("alice@playwright.test", "password-a");
    await page.waitForURL((url) => url.pathname.startsWith("/me"), {
      timeout: 15_000,
    });

    const profile = new ProfilePage(page);
    await profile.goto();
    await profile.waitUntilLoaded();

    await profile.editButton.click();
    await expect(profile.cancelButton).toBeVisible({ timeout: 5_000 });
    await profile.cancelButton.click();

    // De retour en mode lecture, le bouton Modifier doit etre visible
    // a nouveau et l'email seede toujours rendu.
    await expect(profile.editButton).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText("alice@playwright.test").first(),
    ).toBeVisible();
  });

  test("le bouton Changer le mot de passe ouvre le bloc dedie", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("alice@playwright.test", "password-a");
    await page.waitForURL((url) => url.pathname.startsWith("/me"), {
      timeout: 15_000,
    });

    const profile = new ProfilePage(page);
    await profile.goto();
    await profile.waitUntilLoaded();

    await profile.changePasswordButton.click();

    // Apres clic, les champs dediees au changement de mot de passe
    // apparaissent (label "Mot de passe actuel").
    await expect(
      page.getByText(/Mot de passe actuel/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("redirige vers /login quand on accede a /me/profile sans token", async ({
    page,
  }) => {
    // Pas de login : on cible directement /me/profile.
    await page.goto("/me/profile");

    // Le client front appelle window.location.href = "/login" sur 401.
    await page.waitForURL((url) => url.pathname === "/login", {
      timeout: 15_000,
    });
    expect(new URL(page.url()).pathname).toBe("/login");
  });
});
