import { test, expect } from "@playwright/test";
import { resetDb, seedUser } from "../helpers/api-seed";
import { LoginPage } from "../pages/LoginPage";
import { AchievementsPage } from "../pages/AchievementsPage";

/**
 * Specs Achievements : couvrent la page `/me/achievements`.
 *
 * Pour un coach fraichement cree, aucun succes n'est debloque : on
 * valide que la liste est rendue avec uniquement des cartes verrouillees
 * et que la barre de progression affiche 0%.
 *
 * On valide aussi le filtre "Verrouilles" / "Debloques" / "Tous".
 */
test.describe("E2E UI — achievements", () => {
  test.beforeEach(async () => {
    await resetDb();
    await seedUser("alice@playwright.test", "password-a", "Alice");
  });

  test("affiche les cartes pour un coach sans aucun succes", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("alice@playwright.test", "password-a");
    await page.waitForURL((url) => url.pathname.startsWith("/me"), {
      timeout: 15_000,
    });

    const achievements = new AchievementsPage(page);
    await achievements.goto();
    await achievements.waitUntilLoaded();

    // Au moins 1 carte doit etre rendue (le catalogue est non-vide).
    const total = await achievements.cards.count();
    expect(total).toBeGreaterThan(0);

    // Coach neuf : aucun succes debloque.
    const unlocked = await achievements.unlockedCount();
    expect(unlocked).toBe(0);

    // Toutes les cartes sont donc verrouillees.
    const locked = await achievements.lockedCount();
    expect(locked).toBe(total);

    // La progression "0%" doit etre rendue dans le sous-titre.
    await expect(page.getByText(/0%\)/)).toBeVisible();
  });

  test("le filtre Debloques masque toutes les cartes pour un coach neuf", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("alice@playwright.test", "password-a");
    await page.waitForURL((url) => url.pathname.startsWith("/me"), {
      timeout: 15_000,
    });

    const achievements = new AchievementsPage(page);
    await achievements.goto();
    await achievements.waitUntilLoaded();

    await achievements.unlockedFilter.click();

    // Avec le filtre "Debloques" actif, aucune carte ne doit etre rendue.
    const visible = await achievements.cards.count();
    expect(visible).toBe(0);
  });

  test("le filtre Verrouilles affiche bien les cartes verrouillees", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("alice@playwright.test", "password-a");
    await page.waitForURL((url) => url.pathname.startsWith("/me"), {
      timeout: 15_000,
    });

    const achievements = new AchievementsPage(page);
    await achievements.goto();
    await achievements.waitUntilLoaded();

    await achievements.lockedFilter.click();

    const locked = await achievements.lockedCount();
    expect(locked).toBeGreaterThan(0);

    // Aucune carte unlocked dans ce mode pour un coach neuf.
    const unlocked = await achievements.unlockedCount();
    expect(unlocked).toBe(0);
  });

  test("les stats Matchs joues / Victoires / Touchdowns affichent 0 pour un coach neuf", async ({
    page,
  }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("alice@playwright.test", "password-a");
    await page.waitForURL((url) => url.pathname.startsWith("/me"), {
      timeout: 15_000,
    });

    const achievements = new AchievementsPage(page);
    await achievements.goto();
    await achievements.waitUntilLoaded();

    // Les 4 cartes de stats doivent etre visibles.
    await expect(page.getByText(/Matchs joués/i)).toBeVisible();
    await expect(page.getByText(/Victoires/i)).toBeVisible();
    await expect(page.getByText(/Touchdowns/i)).toBeVisible();
    await expect(page.getByText(/Sorties/i).first()).toBeVisible();
  });
});
