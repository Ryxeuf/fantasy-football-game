import type { Page, Locator } from "@playwright/test";

/**
 * Page Object pour `/leaderboard` (classement ELO).
 *
 * Page publique (pas d'auth requise) qui affiche les coachs classés
 * par ELO décroissant avec des cartes de statistiques.
 */
export class LeaderboardPage {
  readonly page: Page;
  readonly root: Locator;
  readonly totalPlayersCard: Locator;
  readonly topRatingCard: Locator;
  readonly avgRatingCard: Locator;
  readonly table: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId("leaderboard-page");
    this.totalPlayersCard = page.getByTestId("leaderboard-total-players");
    this.topRatingCard = page.getByTestId("leaderboard-top-rating");
    this.avgRatingCard = page.getByTestId("leaderboard-avg-rating");
    this.table = page.getByTestId("leaderboard-table");
    this.emptyState = page.getByTestId("leaderboard-empty");
  }

  async goto(): Promise<void> {
    await this.page.goto("/leaderboard");
  }

  async waitUntilLoaded(): Promise<void> {
    await this.root.waitFor({ state: "visible", timeout: 15_000 });
  }

  /** Retourne le nombre de lignes dans le tbody du classement. */
  async entryCount(): Promise<number> {
    return this.table.locator("tbody tr").count();
  }
}
