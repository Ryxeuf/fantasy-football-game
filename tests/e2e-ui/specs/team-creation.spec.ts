import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { resetDb, seedUser } from "../helpers/api-seed";
import { LoginPage } from "../pages/LoginPage";
import { TeamBuilderPage } from "../pages/TeamBuilderPage";

/**
 * Specs Team Creation : couvrent le parcours critique de création
 * d'équipe via le team builder (/me/teams/new).
 *
 * Un utilisateur ne peut pas jouer sans équipe — ce flow est donc
 * un prérequis fonctionnel de toute la boucle multijoueur.
 *
 * On valide :
 *  - le formulaire refuse la soumission avec moins de 11 joueurs
 *  - la création réussie redirige vers la page détail de l'équipe
 *  - l'équipe créée apparaît dans la liste /me/teams
 */

/**
 * Le team builder rend chaque bouton "+" deux fois (une fois dans la liste
 * mobile `<ul className="md:hidden">` et une fois dans la table desktop
 * `<div className="hidden md:block">`). On filtre par `visible` pour ne
 * cibler que la version effectivement rendue dans la viewport courante
 * (Desktop Chrome 1280×720 par défaut → version desktop).
 */
function visibleAddButtons(page: Page) {
  return page
    .locator('[data-testid^="position-add-"]')
    .filter({ visible: true });
}

/**
 * Ajoute des joueurs position par position jusqu'à ce que le bouton
 * submit soit activé (>= 11 joueurs). Attend la stabilisation du DOM
 * après chaque clic pour éviter les races sur l'état disabled.
 */
async function fillRosterUntilValid(
  page: Page,
  builder: TeamBuilderPage,
): Promise<void> {
  const allAddButtons = visibleAddButtons(page);
  const count = await allAddButtons.count();

  for (let i = 0; i < count; i++) {
    const btn = allAddButtons.nth(i);
    for (let clicks = 0; clicks < 12; clicks++) {
      // Vérifier si le submit est déjà actif avant de cliquer.
      const submitEnabled = !(await builder.submitButton.isDisabled());
      if (submitEnabled) return;

      const btnDisabled = await btn.isDisabled();
      if (btnDisabled) break;

      await btn.click();
      // Attendre que le DOM se stabilise après le clic (le state React
      // met à jour les compteurs et le disabled du submit).
      await expect(btn).toBeAttached();
    }
  }
}

test.describe("E2E UI — team creation", () => {
  test.beforeEach(async () => {
    await resetDb();
    await seedUser("coach@playwright.test", "password-c", "Coach");
  });

  test("le bouton créer est désactivé tant qu'on n'a pas 11 joueurs", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("coach@playwright.test", "password-c");
    await page.waitForURL(/\/(play|team|me)/, { timeout: 15_000 });

    const builder = new TeamBuilderPage(page);
    await builder.goto();

    // Attendre que le formulaire se charge (le roster-select doit être visible).
    await expect(builder.rosterSelect).toBeVisible({ timeout: 10_000 });

    // Sans ajout de joueurs, le bouton créer doit être désactivé.
    await expect(builder.submitButton).toBeDisabled();
  });

  test("création d'une équipe Skaven valide redirige vers la fiche équipe", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("coach@playwright.test", "password-c");
    await page.waitForURL(/\/(play|team|me)/, { timeout: 15_000 });

    const builder = new TeamBuilderPage(page);
    await builder.goto();

    await expect(builder.rosterSelect).toBeVisible({ timeout: 10_000 });

    await builder.fillName("Rats of E2E");

    // On attend que les positions soient chargées avant de cliquer.
    await visibleAddButtons(page)
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await fillRosterUntilValid(page, builder);

    // Le bouton doit maintenant être activé.
    await expect(builder.submitButton).toBeEnabled({ timeout: 5_000 });

    await builder.submit();

    // Après création, le front redirige vers /me/teams/<id>.
    await page.waitForURL(/\/me\/teams\/[^/]+$/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toMatch(/^\/me\/teams\/[^/]+$/);
  });

  test("la saison 3 est sélectionnée par défaut", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("coach@playwright.test", "password-c");
    await page.waitForURL(/\/(play|team|me)/, { timeout: 15_000 });

    const builder = new TeamBuilderPage(page);
    await builder.goto();

    await expect(builder.rulesetSelect).toBeVisible({ timeout: 10_000 });
    await expect(builder.rulesetSelect).toHaveValue("season_3");
  });

  test("création avec staff : relances, cheerleaders et apothicaire", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("coach@playwright.test", "password-c");
    await page.waitForURL(/\/(play|team|me)/, { timeout: 15_000 });

    const builder = new TeamBuilderPage(page);
    await builder.goto();
    await expect(builder.rosterSelect).toBeVisible({ timeout: 10_000 });

    await builder.fillName("Staffed Rats");
    // Skaven explicitement pour figer le coût de reroll (50k) attendu.
    await builder.selectRoster("skaven");

    // Configure du staff avant d'ajouter les joueurs pour valider l'impact budget.
    await builder.setStaff({
      rerolls: 2,
      cheerleaders: 1,
      assistants: 1,
      dedicatedFans: 2,
      apothecary: true,
    });

    // Staff skaven : 2*50 + 1*10 + 1*10 + 50 + (2-1)*10 = 180k
    await expect(builder.staffCost).toHaveText(/180.*po/);

    await visibleAddButtons(page)
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await fillRosterUntilValid(page, builder);

    await expect(builder.submitButton).toBeEnabled({ timeout: 5_000 });

    await builder.submit();
    await page.waitForURL(/\/me\/teams\/[^/]+$/, { timeout: 15_000 });

    // Vérifier que la page détail affiche bien les infos staff configurées.
    await expect(page.getByText(/Relance|Reroll/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("l'équipe créée apparaît dans la liste /me/teams", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("coach@playwright.test", "password-c");
    await page.waitForURL(/\/(play|team|me)/, { timeout: 15_000 });

    const builder = new TeamBuilderPage(page);
    await builder.goto();
    await expect(builder.rosterSelect).toBeVisible({ timeout: 10_000 });

    const teamName = `E2E Team ${Date.now()}`;
    await builder.fillName(teamName);

    await visibleAddButtons(page)
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await fillRosterUntilValid(page, builder);

    await builder.submit();
    await page.waitForURL(/\/me\/teams\/[^/]+$/, { timeout: 15_000 });

    // Revenir à la liste des équipes et vérifier la présence de l'équipe.
    await page.goto("/me/teams");
    await expect(page.getByText(teamName)).toBeVisible({ timeout: 10_000 });
  });
});
