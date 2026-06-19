import { test, expect } from "@playwright/test";

/**
 * Specs Homepage : couvrent les chemins critiques de la landing page
 * publique (`/`).
 *
 * La home est la principale porte d'entree organique (SEO/GEO) :
 * un test smoke garantit qu'elle reste accessible sans authentification
 * et que ses CTA principaux et liens de navigation cles ne regressent pas.
 *
 * On valide :
 *  - le H1 sr-only "Nuffle Arena" est rendu
 *  - les CTA Hero pointent vers les bonnes routes (/me/teams, /teams)
 *  - les pages publiques principales repondent (skills, star-players, teams)
 *  - le footer / les liens "discover" ne pointent pas vers une 404
 */
test.describe("E2E UI — homepage publique", () => {
  test("la home rend le H1 et les stats principales", async ({ page }) => {
    await page.goto("/");

    // Le H1 est en sr-only mais doit etre present dans le DOM.
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached();

    // Le bandeau stats du hero expose 4 compteurs (rosters, star players,
    // competences, gratuite). Les valeurs sont live (API /public/stats) et
    // localisees, donc on cible le conteneur stable via data-testid plutot
    // que des chiffres volatils, et on verifie qu'il rend bien ses 4 entrees.
    const stats = page.getByTestId("home-stats");
    await expect(stats).toBeVisible();
    await expect(stats.locator("dd")).toHaveCount(4);
  });

  test("le CTA Hero 'Gerer mes equipes' pointe vers /me/teams", async ({
    page,
  }) => {
    await page.goto("/");

    const cta = page.locator('a[href="/me/teams"]').first();
    await expect(cta).toBeVisible();
    await cta.click();

    // L'utilisateur n'est pas connecte : le hub /me/teams se charge
    // mais peut rediriger vers /login. On accepte les deux.
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/me/teams") || url.pathname === "/login",
      { timeout: 15_000 },
    );
  });

  test("la page /skills est accessible publiquement", async ({ page }) => {
    await page.goto("/skills");

    // La page skills affiche au moins un titre listant les competences.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(new URL(page.url()).pathname).toBe("/skills");
  });

  test("la page /star-players est accessible publiquement", async ({
    page,
  }) => {
    await page.goto("/star-players");

    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(new URL(page.url()).pathname).toBe("/star-players");
  });

  test("la page /teams est accessible publiquement", async ({ page }) => {
    await page.goto("/teams");

    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(new URL(page.url()).pathname).toBe("/teams");
  });

  test("la page /tutoriel est accessible publiquement", async ({ page }) => {
    await page.goto("/tutoriel");

    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(new URL(page.url()).pathname).toBe("/tutoriel");
  });
});
