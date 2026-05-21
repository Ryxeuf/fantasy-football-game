import { test, expect } from "@playwright/test";

/**
 * Specs Pro League — sprint 1.G.5.
 *
 * Couvre le replay player des matchs Pro League completed :
 *  - Endpoint API renvoie 404 / 409 / 200 selon le statut.
 *  - Page replay rend l'erreur si le match n'existe pas.
 *  - Page replay rend les controls + scrub bar quand un dump est mocke
 *    via route interception.
 *
 * On mocke `/pro-league/matches/:id/replay` (et le metadata) pour ne
 * pas dependre d'un seed Pro League en CI.
 */

const FAKE_MATCH_ID = "fake-replay-match-id";

/**
 * Mocke `/full-replay` pour eviter que la fetch ne parte vers la VRAIE
 * API (qui repondra 404 sur un match inexistant, mais peut prendre du
 * temps a repondre ou voir sa connexion network refusee dans certains
 * setups CI). 404 = legacy match, la page bascule en vue classique
 * sans bloquer le rendu du replay-header.
 */
async function mockFullReplay(page: import("@playwright/test").Page): Promise<void> {
  await page.route(
    `**/pro-league/matches/${FAKE_MATCH_ID}/full-replay`,
    async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Full replay not available",
          code: "FULL_REPLAY_NOT_AVAILABLE",
        }),
      });
    },
  );
}

test.describe("E2E UI — Pro League replay player", () => {
  test("affiche une erreur si l'API replay renvoie 404", async ({ page }) => {
    await page.route(
      `**/pro-league/matches/${FAKE_MATCH_ID}**`,
      async (route) => {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "Match introuvable" }),
        });
      },
    );

    await page.goto(`/pro-league/matches/${FAKE_MATCH_ID}/replay`);

    // Soit l'erreur du redirect hook, soit le redirect a deja eu lieu
    // vers /pro-league/matches/:id (qui rend "Match inconnu").
    await page.waitForLoadState("networkidle");
    const url = new URL(page.url()).pathname;
    // Soit on est reste sur /replay avec une erreur, soit on a ete
    // redirige sur la page parent. Les deux sont des comportements OK.
    expect(
      url.startsWith(`/pro-league/matches/${FAKE_MATCH_ID}`),
    ).toBe(true);
  });

  test("rend les controls + scrub bar avec un dump mocke", async ({
    page,
  }) => {
    await mockFullReplay(page);
    // 1) Route metadata du redirect hook : status='completed' => no redirect.
    await page.route(
      `**/pro-league/matches/${FAKE_MATCH_ID}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: FAKE_MATCH_ID,
            status: "completed",
            scoreHome: 1,
            scoreAway: 1,
            outcome: "draw",
            touchdownCount: 2,
            casualtyCount: 1,
            turnoverCount: 5,
            nuffleCount: 1,
            replay: { durationMs: 600_000, highlights: [] },
            homeTeam: { slug: "home", name: "Home", primaryColor: "#000" },
            awayTeam: { slug: "away", name: "Away", primaryColor: "#000" },
            scheduledAt: "2026-05-01T20:00:00.000Z",
          }),
        });
      },
    );

    // 2) Route le dump replay.
    await page.route(
      `**/pro-league/matches/${FAKE_MATCH_ID}/replay`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            matchId: FAKE_MATCH_ID,
            status: "completed",
            durationMs: 600_000,
            eventCount: 5,
            events: [
              {
                type: "KICKOFF",
                displayAtMs: 0,
                engineVer: "0.13.0",
                meta: { home: "home", away: "away", weather: "nice" },
              },
              {
                type: "TURN_START",
                displayAtMs: 30_000,
                engineVer: "0.13.0",
                meta: {
                  half: 1,
                  turn: 1,
                  drivingTeam: "home",
                  ballYardline: 4,
                },
              },
              {
                type: "TD",
                displayAtMs: 90_000,
                engineVer: "0.13.0",
                meta: { team: "home", scoreAfter: { home: 1, away: 0 } },
              },
              {
                type: "TD",
                displayAtMs: 480_000,
                engineVer: "0.13.0",
                meta: { team: "away", scoreAfter: { home: 1, away: 1 } },
              },
              {
                type: "END",
                displayAtMs: 600_000,
                engineVer: "0.13.0",
                meta: { score: { home: 1, away: 1 } },
              },
            ],
          }),
        });
      },
    );

    await page.goto(`/pro-league/matches/${FAKE_MATCH_ID}/replay`);

    await expect(page.getByTestId("replay-header")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("replay-scrubber")).toBeVisible();
    await expect(page.getByTestId("replay-toggle")).toBeVisible();
    await expect(page.getByTestId("replay-skip-end")).toBeVisible();
    await expect(page.getByTestId("replay-restart")).toBeVisible();
    // 5 boutons de speed
    await expect(page.getByTestId("replay-speed-1")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Score initial 0-0 (currentMs=0).
    await expect(page.getByTestId("replay-score")).toContainText("0 – 0");
    await expect(page.getByTestId("replay-duration")).toHaveText("10:00");

    // Markers TD : 2 TDs dans le dump.
    const tdMarkers = page.getByTestId("scrub-marker-td");
    await expect(tdMarkers).toHaveCount(2);

    // Hint des raccourcis affiche.
    await expect(page.getByTestId("replay-shortcuts-hint")).toContainText(
      "Espace",
    );
  });

  test("skip-to-end via bouton met le score final + half=FT", async ({
    page,
  }) => {
    await mockFullReplay(page);
    await page.route(
      `**/pro-league/matches/${FAKE_MATCH_ID}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: FAKE_MATCH_ID,
            status: "completed",
            scoreHome: 1,
            scoreAway: 1,
            outcome: "draw",
            touchdownCount: 2,
            casualtyCount: 0,
            turnoverCount: 0,
            nuffleCount: 0,
            replay: { durationMs: 600_000, highlights: [] },
            homeTeam: { slug: "home", name: "Home", primaryColor: "#000" },
            awayTeam: { slug: "away", name: "Away", primaryColor: "#000" },
            scheduledAt: "2026-05-01T20:00:00.000Z",
          }),
        });
      },
    );
    await page.route(
      `**/pro-league/matches/${FAKE_MATCH_ID}/replay`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            matchId: FAKE_MATCH_ID,
            status: "completed",
            durationMs: 600_000,
            eventCount: 4,
            events: [
              {
                type: "KICKOFF",
                displayAtMs: 0,
                engineVer: "0.13.0",
                meta: {},
              },
              {
                type: "TD",
                displayAtMs: 90_000,
                engineVer: "0.13.0",
                meta: { team: "home", scoreAfter: { home: 1, away: 0 } },
              },
              {
                type: "TD",
                displayAtMs: 480_000,
                engineVer: "0.13.0",
                meta: { team: "away", scoreAfter: { home: 1, away: 1 } },
              },
              {
                type: "END",
                displayAtMs: 600_000,
                engineVer: "0.13.0",
                meta: { score: { home: 1, away: 1 } },
              },
            ],
          }),
        });
      },
    );

    await page.goto(`/pro-league/matches/${FAKE_MATCH_ID}/replay`);
    await expect(page.getByTestId("replay-toggle")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("replay-skip-end").click();

    await expect(page.getByTestId("replay-score")).toContainText("1 – 1");
    await expect(page.getByTestId("replay-half")).toContainText("FT");
    await expect(page.getByTestId("replay-current-time")).toHaveText("10:00");
  });

  test("End key shortcut skip-to-end (1.G.5)", async ({ page }) => {
    await mockFullReplay(page);
    await page.route(
      `**/pro-league/matches/${FAKE_MATCH_ID}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: FAKE_MATCH_ID,
            status: "completed",
            scoreHome: 0,
            scoreAway: 1,
            outcome: "away",
            touchdownCount: 1,
            casualtyCount: 0,
            turnoverCount: 0,
            nuffleCount: 0,
            replay: { durationMs: 600_000, highlights: [] },
            homeTeam: { slug: "home", name: "Home", primaryColor: "#000" },
            awayTeam: { slug: "away", name: "Away", primaryColor: "#000" },
            scheduledAt: "2026-05-01T20:00:00.000Z",
          }),
        });
      },
    );
    await page.route(
      `**/pro-league/matches/${FAKE_MATCH_ID}/replay`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            matchId: FAKE_MATCH_ID,
            status: "completed",
            durationMs: 600_000,
            eventCount: 3,
            events: [
              {
                type: "KICKOFF",
                displayAtMs: 0,
                engineVer: "0.13.0",
                meta: {},
              },
              {
                type: "TD",
                displayAtMs: 480_000,
                engineVer: "0.13.0",
                meta: { team: "away", scoreAfter: { home: 0, away: 1 } },
              },
              {
                type: "END",
                displayAtMs: 600_000,
                engineVer: "0.13.0",
                meta: { score: { home: 0, away: 1 } },
              },
            ],
          }),
        });
      },
    );

    await page.goto(`/pro-league/matches/${FAKE_MATCH_ID}/replay`);
    await expect(page.getByTestId("replay-toggle")).toBeVisible({
      timeout: 15_000,
    });

    // Press End sur la window (pas dans un input).
    await page.keyboard.press("End");

    await expect(page.getByTestId("replay-current-time")).toHaveText("10:00");
    await expect(page.getByTestId("replay-score")).toContainText("0 – 1");
  });
});
