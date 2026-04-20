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
   * Ajuste un stepper staff jusqu'à la valeur cible en lisant la valeur
   * actuellement affichée dans le DOM et en cliquant sur inc/dec le bon
   * nombre de fois. Fonctionne quelle que soit la valeur initiale du
   * champ (ex. `dedicatedFans` initialisé à 1).
   */
  private async setStepperValue(
    testIdBase: string,
    target: number,
  ): Promise<void> {
    const incButton = this.page.getByTestId(`${testIdBase}-inc`);
    const decButton = this.page.getByTestId(`${testIdBase}-dec`);
    await incButton.waitFor({ state: "visible" });

    const valueLocator = this.page.getByTestId(`${testIdBase}-value`);
    const readCurrent = async (): Promise<number> => {
      const text = (await valueLocator.innerText()).trim();
      const parsed = parseInt(text, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    // Safeguard: at most (target + 20) iterations to avoid infinite loops
    // if a button unexpectedly stays disabled.
    const maxIterations = Math.abs(target) + 20;
    for (let i = 0; i < maxIterations; i++) {
      const current = await readCurrent();
      if (current === target) return;
      const button = current < target ? incButton : decButton;
      if (await button.isDisabled()) return;
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
      await this.setStepperValue("staff-rerolls", staff.rerolls);
    }
    if (staff.cheerleaders !== undefined) {
      await this.setStepperValue("staff-cheerleaders", staff.cheerleaders);
    }
    if (staff.assistants !== undefined) {
      await this.setStepperValue("staff-assistants", staff.assistants);
    }
    if (staff.dedicatedFans !== undefined) {
      await this.setStepperValue("staff-dedicated-fans", staff.dedicatedFans);
    }
    if (staff.apothecary !== undefined) {
      // L'input apothécaire est visuellement caché derrière un toggle,
      // donc on utilise setChecked qui cible directement l'input.
      await this.apothecaryCheckbox.setChecked(staff.apothecary);
    }
  }
}
