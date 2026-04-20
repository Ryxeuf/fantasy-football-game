import type { Page, Locator } from "@playwright/test";

/**
 * Page Object pour `/me/teams/new` (team builder).
 *
 * Permet de remplir le formulaire de création d'équipe : nom, roster,
 * ajout de joueurs par position, et soumission.
 */
export class TeamBuilderPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly rosterSelect: Locator;
  readonly rulesetSelect: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly apothecaryCheckbox: Locator;
  readonly staffCost: Locator;
  readonly remainingBudget: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.getByTestId("team-name-input");
    this.rosterSelect = page.getByTestId("roster-select");
    this.rulesetSelect = page.getByTestId("ruleset-select");
    this.submitButton = page.getByTestId("create-team-submit");
    this.errorMessage = page.getByTestId("team-builder-error");
    this.apothecaryCheckbox = page.getByTestId("staff-apothecary");
    this.staffCost = page.getByTestId("staff-cost-summary");
    this.remainingBudget = page.getByTestId("remaining-budget");
  }

  async goto(): Promise<void> {
    await this.page.goto("/me/teams/new");
  }

  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  async selectRoster(slug: string): Promise<void> {
    await this.rosterSelect.selectOption(slug);
  }

  /**
   * Clique N fois sur le bouton "+" d'une position donnée.
   * Attend que le bouton soit visible avant chaque clic.
   */
  async addPlayers(positionSlug: string, count: number): Promise<void> {
    const addButton = this.page.getByTestId(`position-add-${positionSlug}`);
    for (let i = 0; i < count; i++) {
      await addButton.click();
    }
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Clique N fois sur le bouton "+" d'un stepper staff pour atteindre la
   * valeur cible. Les steppers remplacent les anciens inputs numériques.
   */
  private async setStepperValue(
    testIdBase: string,
    target: number,
    minValue = 0,
  ): Promise<void> {
    const currentOffset = Math.max(0, target - minValue);
    const button = this.page.getByTestId(`${testIdBase}-inc`);
    await button.waitFor({ state: "visible" });
    for (let i = 0; i < currentOffset; i++) {
      if (await button.isDisabled()) break;
      await button.click();
    }
  }

  async setStaff(staff: {
    rerolls?: number;
    cheerleaders?: number;
    assistants?: number;
    dedicatedFans?: number;
    apothecary?: boolean;
  }): Promise<void> {
    if (staff.rerolls !== undefined) {
      await this.setStepperValue("staff-rerolls", staff.rerolls, 0);
    }
    if (staff.cheerleaders !== undefined) {
      await this.setStepperValue("staff-cheerleaders", staff.cheerleaders, 0);
    }
    if (staff.assistants !== undefined) {
      await this.setStepperValue("staff-assistants", staff.assistants, 0);
    }
    if (staff.dedicatedFans !== undefined) {
      // min=1 pour les fans dévoués
      await this.setStepperValue(
        "staff-dedicated-fans",
        staff.dedicatedFans,
        1,
      );
    }
    if (staff.apothecary !== undefined) {
      // L'input apothécaire est visuellement caché derrière un toggle,
      // donc on utilise setChecked qui cible directement l'input.
      await this.apothecaryCheckbox.setChecked(staff.apothecary);
    }
  }
}
