import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Page Object pour `/play-hidden/<matchId>` (écran principal du match).
 *
 * Le wrapper `[data-testid=game-view]` expose les meta du match sous forme
 * de data-attributes (matchStatus, gamePhase, preMatchPhase, myTeamSide,
 * isMyTurn) pour que les specs puissent assert-er sans plonger dans
 * l'état Pixi.
 */
export class GameViewPage {
  readonly page: Page;
  readonly root: Locator;
  readonly preMatchSummary: Locator;
  readonly inducementSelector: Locator;
  readonly inducementConfirm: Locator;
  readonly inducementSkip: Locator;
  readonly gameBoard: Locator;
  readonly chatToggle: Locator;
  readonly chatPanel: Locator;
  readonly chatInput: Locator;
  readonly chatSend: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId("game-view");
    this.preMatchSummary = page.getByTestId("prematch-summary");
    this.inducementSelector = page.getByTestId("inducement-selector");
    this.inducementConfirm = page.getByTestId("inducement-confirm");
    this.inducementSkip = page.getByTestId("inducement-skip");
    this.gameBoard = page.getByTestId("game-board");
    this.chatToggle = page.getByTestId("chat-toggle");
    this.chatPanel = page.getByTestId("chat-panel");
    this.chatInput = page.getByTestId("chat-input");
    this.chatSend = page.getByTestId("chat-send");
  }

  async waitUntilLoaded(): Promise<void> {
    await this.root.waitFor({ state: "visible", timeout: 30_000 });
  }

  async matchStatus(): Promise<string | null> {
    return this.root.getAttribute("data-match-status");
  }

  async gamePhase(): Promise<string | null> {
    return this.root.getAttribute("data-game-phase");
  }

  async preMatchPhase(): Promise<string | null> {
    return this.root.getAttribute("data-prematch-phase");
  }

  async expectMatchStatusNotPending(): Promise<void> {
    await expect
      .poll(
        async () => this.root.getAttribute("data-match-status"),
        { timeout: 15_000, intervals: [500] },
      )
      .not.toBe("pending");
  }

  async openChat(): Promise<void> {
    if (await this.chatToggle.isVisible().catch(() => false)) {
      await this.chatToggle.click();
    }
    await this.chatPanel.waitFor({ state: "visible" });
  }

  async sendChat(message: string): Promise<void> {
    await this.openChat();
    await this.chatInput.fill(message);
    await this.chatSend.click();
  }
}
