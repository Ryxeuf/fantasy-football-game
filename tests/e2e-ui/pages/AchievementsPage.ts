import type { Page, Locator } from "@playwright/test";

/**
 * Page Object pour `/me/achievements`.
 *
 * Les cartes individuelles sont identifiees via `data-testid="achievement-card"`
 * + `data-unlocked="true|false"`. Les filtres "Tous / Debloques / Verrouilles"
 * sont des `<button>` simples sans testid : on cible par le label.
 */
export class AchievementsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly cards: Locator;
  readonly unlockedFilter: Locator;
  readonly lockedFilter: Locator;
  readonly allFilter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /Mes succès/i });
    this.cards = page.getByTestId("achievement-card");
    this.unlockedFilter = page.getByRole("button", { name: /^Débloqués$/i });
    this.lockedFilter = page.getByRole("button", { name: /^Verrouillés$/i });
    this.allFilter = page.getByRole("button", { name: /^Tous$/i });
  }

  async goto(): Promise<void> {
    await this.page.goto("/me/achievements");
  }

  async waitUntilLoaded(): Promise<void> {
    await this.heading.waitFor({ state: "visible", timeout: 15_000 });
  }

  async unlockedCount(): Promise<number> {
    return this.page
      .locator('[data-testid="achievement-card"][data-unlocked="true"]')
      .count();
  }

  async lockedCount(): Promise<number> {
    return this.page
      .locator('[data-testid="achievement-card"][data-unlocked="false"]')
      .count();
  }
}
