import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Page Object pour `/waiting-hidden/<matchId>` (salle d'attente avant le match).
 *
 * Les indicateurs d'acceptation exposent `data-accepted="true|false"` pour
 * des assertions lisibles sans parsing de texte.
 */
export class WaitingRoomPage {
  readonly page: Page;
  readonly acceptButton: Locator;
  readonly localAcceptance: Locator;
  readonly visitorAcceptance: Locator;

  constructor(page: Page) {
    this.page = page;
    this.acceptButton = page.getByTestId("waiting-accept-button");
    this.localAcceptance = page.getByTestId("acceptance-local");
    this.visitorAcceptance = page.getByTestId("acceptance-visitor");
  }

  async waitUntilVisible(): Promise<void> {
    await this.page.getByTestId("waiting-room").waitFor({ state: "visible" });
  }

  async accept(): Promise<void> {
    await this.acceptButton.click();
  }

  async expectLocalAccepted(): Promise<void> {
    await expect(this.localAcceptance).toHaveAttribute("data-accepted", "true");
  }

  async expectBothAccepted(): Promise<void> {
    await expect(this.localAcceptance).toHaveAttribute("data-accepted", "true");
    await expect(this.visitorAcceptance).toHaveAttribute(
      "data-accepted",
      "true",
    );
  }
}
