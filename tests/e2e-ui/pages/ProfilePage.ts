import type { Page, Locator } from "@playwright/test";

/**
 * Page Object pour `/me/profile`.
 *
 * La page n'expose pas tous les champs via data-testid : on combine
 * donc des selecteurs de role/text pour les zones critiques (titre,
 * email, bouton Modifier) et on garde une API minimale pour les specs.
 */
export class ProfilePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly editButton: Locator;
  readonly cancelButton: Locator;
  readonly saveButton: Locator;
  readonly coachNameInput: Locator;
  readonly emailInput: Locator;
  readonly statsSection: Locator;
  readonly securitySection: Locator;
  readonly changePasswordButton: Locator;
  readonly deleteAccountButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /Mon Profil/i });
    this.editButton = page.getByRole("button", { name: /Modifier/i });
    this.cancelButton = page.getByRole("button", { name: /Annuler/i });
    this.saveButton = page.getByRole("button", { name: /Enregistrer/i });
    this.coachNameInput = page.locator('input[required][type="text"]').first();
    this.emailInput = page.locator('input[required][type="email"]');
    this.statsSection = page.getByRole("heading", { name: /Statistiques/i });
    this.securitySection = page.getByRole("heading", { name: /Sécurité/i });
    this.changePasswordButton = page.getByRole("button", {
      name: /Changer le mot de passe/i,
    });
    this.deleteAccountButton = page.getByRole("button", {
      name: /Supprimer mon compte/i,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto("/me/profile");
  }

  async waitUntilLoaded(): Promise<void> {
    await this.heading.waitFor({ state: "visible", timeout: 15_000 });
  }
}
