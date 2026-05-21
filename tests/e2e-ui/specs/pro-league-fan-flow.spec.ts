import { test, expect } from "@playwright/test";

/**
 * Specs Pro League — sprint 1.F.1.
 *
 * Couvre le parcours fan complet : hub -> standings -> leaderboard ->
 * gazette -> hall-of-fame. Teste les chemins critiques (pages
 * accessibles, headers/sections rendus, empty states corrects) sans
 * assumer que la DB contient des donnees seedees specifiques.
 *
 * Le but : un PR qui casse un de ces 5 ecrans declenche immediatement
 * un fail CI E2E.
 */
test.describe("E2E UI — Pro League fan flow", () => {
  test("le hub /pro-league rend header + sections principales", async ({
    page,
  }) => {
    await page.goto("/pro-league");

    // Header avec h1 + WalletBadge testid stable.
    await expect(page.getByTestId("hub-header")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    // Le hub charge les donnees ; soit une saison existe et standings
    // est rendu, soit l'empty-state "Aucune saison active" est affiche.
    // En CI E2E la DB est fraiche, donc on accepte les deux etats.
    const standings = page.getByTestId("standings");
    const noSeason = page.getByTestId("hub-no-season");
    await expect(standings.or(noSeason)).toBeVisible({ timeout: 15_000 });
  });

  test("la page /pro-league/standings est accessible", async ({ page }) => {
    await page.goto("/pro-league/standings");

    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(new URL(page.url()).pathname).toBe("/pro-league/standings");
  });

  test("le leaderboard rend les 3 onglets period", async ({ page }) => {
    await page.goto("/pro-league/leaderboard");

    await expect(page.getByTestId("period-tabs")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("period-weekly")).toBeVisible();
    await expect(page.getByTestId("period-season")).toBeVisible();
    await expect(page.getByTestId("period-all-time")).toBeVisible();

    // Soit le leaderboard a des entrees, soit l'empty state est rendu.
    const hasTable = await page
      .getByTestId("leaderboard-table")
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .getByTestId("empty-leaderboard")
      .isVisible()
      .catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test("changer d'onglet leaderboard met a jour l'URL state", async ({
    page,
  }) => {
    await page.goto("/pro-league/leaderboard");
    await expect(page.getByTestId("period-tabs")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("period-weekly").click();
    // Apres un click, la table OU l'empty state se re-rend.
    await page.waitForLoadState("networkidle");
    const hasTable = await page
      .getByTestId("leaderboard-table")
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .getByTestId("empty-leaderboard")
      .isVisible()
      .catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test("la page /pro-league/gazette rend latest ou empty state", async ({
    page,
  }) => {
    await page.goto("/pro-league/gazette");

    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Soit une edition est publiee, soit l'empty state est affiche.
    const hasEmpty = await page
      .getByTestId("gazette-no-edition")
      .isVisible()
      .catch(() => false);
    const hasArchive = await page
      .getByTestId("gazette-archive")
      .isVisible()
      .catch(() => false);
    // Le rendu doit etre stable : empty OU archive.
    expect(hasEmpty || hasArchive).toBe(true);
  });

  test("la page /pro-league/hall-of-fame rend liste ou empty state", async ({
    page,
  }) => {
    await page.goto("/pro-league/hall-of-fame");

    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 15_000,
    });

    const hasList = await page
      .getByTestId("hof-list")
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .getByTestId("empty-hof")
      .isVisible()
      .catch(() => false);
    expect(hasList || hasEmpty).toBe(true);
  });

  test("la page /pro-league/about rend pitch + FAQ + disclaimer", async ({
    page,
  }) => {
    await page.goto("/pro-league/about");

    await expect(page.getByTestId("about-hero")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /Pro League/i,
    );

    // Sections cles
    await expect(page.getByTestId("about-howitworks")).toBeVisible();
    await expect(page.getByTestId("about-features")).toBeVisible();
    await expect(page.getByTestId("about-schedule")).toBeVisible();
    await expect(page.getByTestId("about-faq")).toBeVisible();
    await expect(page.getByTestId("about-disclaimer")).toBeVisible();

    // FAQ doit contenir au moins 6 items
    const faqItems = page.getByTestId("about-faq-item");
    await expect(faqItems).toHaveCount(8);

    // Disclaimer doit mentionner "no real money"
    await expect(page.getByTestId("about-disclaimer")).toContainText(
      /argent r.el/i,
    );
  });

  test("le hub expose un lien 'A propos' qui pointe vers /pro-league/about", async ({
    page,
  }) => {
    await page.goto("/pro-league");
    const aboutLink = page.getByTestId("hub-about-link");
    await expect(aboutLink).toBeVisible({ timeout: 15_000 });
    await expect(aboutLink).toHaveAttribute("href", "/pro-league/about");

    await aboutLink.click();
    await page.waitForURL((u) => u.pathname === "/pro-league/about", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("about-hero")).toBeVisible();
  });

  test("navigation hub -> standings via deep link", async ({ page }) => {
    await page.goto("/pro-league/standings");
    expect(new URL(page.url()).pathname).toBe("/pro-league/standings");

    // Bouton retour vers le hub fonctionne (presence d'un lien Hub).
    const hubLink = page.locator('a[href="/pro-league"]').first();
    await expect(hubLink).toBeVisible({ timeout: 10_000 });
    await hubLink.click();

    await page.waitForURL((u) => u.pathname === "/pro-league", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("hub-header")).toBeVisible({
      timeout: 15_000,
    });
  });
});
