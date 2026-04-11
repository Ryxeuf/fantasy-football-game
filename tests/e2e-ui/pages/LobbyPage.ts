import type { Page, Locator } from "@playwright/test";

/**
 * Page Object pour `/play` (lobby multijoueur).
 *
 * Expose les 3 actions principales que les specs utilisent :
 *   - createMatch(): crée un match et renvoie son id (extrait de l'URL après
 *     redirection vers /waiting/<id>)
 *   - joinMatch(matchId)
 *   - startMatchmaking(teamId)
 */
export class LobbyPage {
  readonly page: Page;
  readonly teamSelect: Locator;
  readonly matchmakingStart: Locator;
  readonly matchmakingCancel: Locator;
  readonly createMatchButton: Locator;
  readonly matchIdInput: Locator;
  readonly joinMatchButton: Locator;
  readonly errorBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.teamSelect = page.getByTestId("team-select");
    this.matchmakingStart = page.getByTestId("matchmaking-start");
    this.matchmakingCancel = page.getByTestId("matchmaking-cancel");
    this.createMatchButton = page.getByTestId("create-match-button");
    this.matchIdInput = page.getByTestId("match-id-input");
    this.joinMatchButton = page.getByTestId("join-match-button");
    this.errorBanner = page.getByTestId("play-error");
  }

  async goto(): Promise<void> {
    await this.page.goto("/play");
  }

  /**
   * Clique sur "Créer une partie" et attend la redirection vers la waiting
   * room. Retourne le matchId extrait de l'URL.
   */
  async createMatch(): Promise<string> {
    await this.createMatchButton.click();
    await this.page.waitForURL(/\/waiting\/[^/]+$/, {
      timeout: 15_000,
    });
    return extractMatchIdFromUrl(this.page.url());
  }

  async joinMatch(matchId: string): Promise<void> {
    await this.matchIdInput.fill(matchId);
    await this.joinMatchButton.click();
    await this.page.waitForURL(/\/waiting\/[^/]+$/, {
      timeout: 15_000,
    });
  }
}

function extractMatchIdFromUrl(url: string): string {
  const match = url.match(/\/([^/]+)$/);
  if (!match) {
    throw new Error(`Could not extract matchId from URL: ${url}`);
  }
  return match[1];
}
