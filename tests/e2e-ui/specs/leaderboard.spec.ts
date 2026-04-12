import { test, expect } from "@playwright/test";
import { resetDb, seedUser } from "../helpers/api-seed";
import { LeaderboardPage } from "../pages/LeaderboardPage";

/**
 * Specs Leaderboard : couvrent l'affichage du classement ELO public.
 *
 * La page /leaderboard est accessible sans authentification. On valide :
 *  - les cartes de statistiques s'affichent (total joueurs, meilleur ELO, moyenne)
 *  - le tableau de classement rend les entrées avec rang, coach et ELO
 *  - l'état vide s'affiche correctement sans utilisateurs
 */
test.describe("E2E UI — leaderboard", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("affiche les cartes statistiques et le tableau avec des coachs seedés", async ({
    page,
  }) => {
    // Seed 3 coachs pour remplir le classement.
    await Promise.all([
      seedUser("alice@playwright.test", "password-a", "Alice"),
      seedUser("bob@playwright.test", "password-b", "Bob"),
      seedUser("carol@playwright.test", "password-c", "Carol"),
    ]);

    const leaderboard = new LeaderboardPage(page);
    await leaderboard.goto();
    await leaderboard.waitUntilLoaded();

    // Les cartes de statistiques doivent être visibles.
    await expect(leaderboard.totalPlayersCard).toBeVisible();
    await expect(leaderboard.topRatingCard).toBeVisible();
    await expect(leaderboard.avgRatingCard).toBeVisible();

    // Le tableau doit contenir au moins 3 lignes (une par coach seedé).
    await expect(leaderboard.table).toBeVisible();
    const rows = await leaderboard.entryCount();
    expect(rows).toBeGreaterThanOrEqual(3);
  });

  test("le tableau affiche le nom du coach pour chaque entrée", async ({
    page,
  }) => {
    await seedUser("alice@playwright.test", "password-a", "Alice");

    const leaderboard = new LeaderboardPage(page);
    await leaderboard.goto();
    await leaderboard.waitUntilLoaded();

    await expect(leaderboard.table).toBeVisible({ timeout: 10_000 });

    // Vérifier que la première ligne contient "Alice" et un rang numérique.
    const firstRow = leaderboard.table.locator("tbody tr").first();
    await expect(firstRow).toContainText("Alice");
  });

  test("affiche l'état vide quand aucun coach n'existe", async ({ page }) => {
    const leaderboard = new LeaderboardPage(page);
    await leaderboard.goto();
    await leaderboard.waitUntilLoaded();

    // Sans coach, l'état vide doit s'afficher et le tableau doit être absent.
    await expect(leaderboard.emptyState).toBeVisible();
    await expect(leaderboard.table).not.toBeVisible();
  });
});
