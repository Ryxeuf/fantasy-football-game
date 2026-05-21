import { test, expect } from "@playwright/test";

/**
 * Specs E2E smoke — NFL Fantasy (Phase 4).
 *
 * Garde-fou minimal pour les ecrans user-facing `/nfl-fantasy/*` :
 * verifie que chaque page rend ses elements critiques (header,
 * formulaire, badges) sans assumer que la DB contient des leagues
 * seedees specifiques.
 *
 * Le but : un PR qui casse l'un de ces ecrans declenche immediatement
 * un fail CI E2E. Pas de couverture exhaustive — c'est du detection
 * de regression. Les flows authentifies complets (creer une league,
 * draft, lineup, settle) sont testes en backend via le service E2E
 * `nfl-fantasy-admin-explorer-e2e.ts`.
 */
test.describe("E2E UI — NFL Fantasy smoke", () => {
  test("le hub /nfl-fantasy charge soit le dashboard soit l'auth-required", async ({
    page,
  }) => {
    await page.goto("/nfl-fantasy");

    // Soit l'utilisateur est connecte → on voit les CTAs create/join
    // soit non connecte → on voit le block "Authentification requise"
    // soit la liste empty state. Tous valident que la page n'a pas
    // crashe en 500.
    const hasDashboard = await page
      .getByTestId("nfl-fantasy-create-cta")
      .isVisible()
      .catch(() => false);
    const hasAuthRequired = await page
      .getByRole("heading", { name: /Authentification requise/i })
      .isVisible()
      .catch(() => false);

    expect(hasDashboard || hasAuthRequired).toBe(true);
    expect(new URL(page.url()).pathname).toBe("/nfl-fantasy");
  });

  test("la page /nfl-fantasy/new rend le formulaire de creation", async ({
    page,
  }) => {
    await page.goto("/nfl-fantasy/new");

    await expect(
      page.getByRole("heading", { name: /Créer une league NFL Fantasy/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("nfl-fantasy-new-form")).toBeVisible();

    // Les inputs critiques (nom league + nom equipe) sont presents.
    await expect(page.locator("input#name")).toBeVisible();
    await expect(page.locator("input#teamName")).toBeVisible();
    await expect(page.locator("select#seasonId")).toBeVisible();
    await expect(page.locator("select#draftMode")).toBeVisible();
  });

  test("la page /nfl-fantasy/join rend le formulaire d'invite", async ({
    page,
  }) => {
    await page.goto("/nfl-fantasy/join");

    await expect(
      page.getByRole("heading", { name: /Rejoindre une league/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("nfl-fantasy-join-form")).toBeVisible();
  });

  test("le retour depuis /new ramene a /nfl-fantasy", async ({ page }) => {
    await page.goto("/nfl-fantasy/new");
    await expect(
      page.getByRole("heading", { name: /Créer une league NFL Fantasy/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Le layout NFL Fantasy expose un lien nav "Mes leagues" en plus du
    // bouton retour "← Mes leagues" sur la page /new — on cible le lien
    // de retour explicitement.
    await page.getByRole("link", { name: "← Mes leagues" }).click();
    await page.waitForURL("**/nfl-fantasy");
    expect(new URL(page.url()).pathname).toBe("/nfl-fantasy");
  });

  test("une league inexistante affiche un message d'erreur sans 500", async ({
    page,
  }) => {
    await page.goto("/nfl-fantasy/leagues/league-doesnt-exist-xxxxxxx");

    // La page peut afficher un message d'erreur 404 OU rediriger vers
    // /nfl-fantasy OU afficher un auth-required (si l'API renvoie 401
    // avant 404). Dans tous les cas la page ne crash pas.
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    expect(bodyText).not.toContain("Application error");
  });
});
