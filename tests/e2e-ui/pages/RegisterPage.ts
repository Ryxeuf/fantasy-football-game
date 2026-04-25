import type { Page, Locator } from "@playwright/test";

/**
 * Page Object pour `/register`.
 *
 * Tous les champs sont taggues `register-*` (cf. apps/web/app/register/page.tsx).
 * Le formulaire couvre l'inscription complete : email, coach name, prenom,
 * nom, date de naissance, mot de passe.
 */
export class RegisterPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly coachNameInput: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly dobInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly pendingTitle: Locator;
  readonly pendingMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId("register-email");
    this.coachNameInput = page.getByTestId("register-coachname");
    this.firstNameInput = page.getByTestId("register-firstname");
    this.lastNameInput = page.getByTestId("register-lastname");
    this.dobInput = page.getByTestId("register-dob");
    this.passwordInput = page.getByTestId("register-password");
    this.submitButton = page.getByTestId("register-submit");
    this.errorMessage = page.getByTestId("register-error");
    this.pendingTitle = page.getByTestId("register-pending-title");
    this.pendingMessage = page.getByTestId("register-pending-message");
  }

  async goto(redirect?: string): Promise<void> {
    const target = redirect
      ? `/register?redirect=${encodeURIComponent(redirect)}`
      : "/register";
    await this.page.goto(target);
  }

  async fillRequired(opts: {
    email: string;
    coachName: string;
    password: string;
  }): Promise<void> {
    await this.emailInput.fill(opts.email);
    await this.coachNameInput.fill(opts.coachName);
    await this.passwordInput.fill(opts.password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
