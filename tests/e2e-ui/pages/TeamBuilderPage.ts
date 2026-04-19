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
  readonly rerollsInput: Locator;
  readonly cheerleadersInput: Locator;
  readonly assistantsInput: Locator;
  readonly dedicatedFansInput: Locator;
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
    this.rerollsInput = page.getByTestId("staff-rerolls");
    this.cheerleadersInput = page.getByTestId("staff-cheerleaders");
    this.assistantsInput = page.getByTestId("staff-assistants");
    this.dedicatedFansInput = page.getByTestId("staff-dedicated-fans");
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

  async setStaff(staff: {
    rerolls?: number;
    cheerleaders?: number;
    assistants?: number;
    dedicatedFans?: number;
    apothecary?: boolean;
  }): Promise<void> {
    if (staff.rerolls !== undefined) {
      await this.rerollsInput.fill(String(staff.rerolls));
    }
    if (staff.cheerleaders !== undefined) {
      await this.cheerleadersInput.fill(String(staff.cheerleaders));
    }
    if (staff.assistants !== undefined) {
      await this.assistantsInput.fill(String(staff.assistants));
    }
    if (staff.dedicatedFans !== undefined) {
      await this.dedicatedFansInput.fill(String(staff.dedicatedFans));
    }
    if (staff.apothecary !== undefined) {
      const isChecked = await this.apothecaryCheckbox.isChecked();
      if (isChecked !== staff.apothecary) {
        await this.apothecaryCheckbox.click();
      }
    }
  }
}
