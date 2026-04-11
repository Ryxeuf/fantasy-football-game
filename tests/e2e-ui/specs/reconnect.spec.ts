import { test, expect } from "../fixtures/two-players";
import { LobbyPage } from "../pages/LobbyPage";
import { WaitingRoomPage } from "../pages/WaitingRoomPage";
import { GameViewPage } from "../pages/GameViewPage";

/**
 * Test de reconnexion: un joueur ferme sa page en plein match et la
 * rouvre. La vue de jeu doit se ré-hydrater correctement et afficher
 * à nouveau le game-view avec un matchStatus non-pending.
 *
 * Cette spec valide principalement le chemin serveur
 * `game:request-resync` → `/match/:id/state` → WebSocket subscription.
 */
test.describe("E2E UI — reconnexion en plein match", () => {
  test("Bob ferme et rouvre la page, le match est récupéré", async ({
    alice,
    bob,
  }) => {
    const aliceLobby = new LobbyPage(alice.page);
    const bobLobby = new LobbyPage(bob.page);

    await aliceLobby.goto();
    const matchId = await aliceLobby.createMatch();

    await bobLobby.goto();
    await bobLobby.joinMatch(matchId);

    const aliceWaiting = new WaitingRoomPage(alice.page);
    const bobWaiting = new WaitingRoomPage(bob.page);
    await aliceWaiting.waitUntilVisible();
    await bobWaiting.waitUntilVisible();

    await aliceWaiting.accept();
    await bobWaiting.accept();

    await alice.page.waitForURL(/\/play-hidden\//, { timeout: 20_000 });
    await bob.page.waitForURL(/\/play-hidden\//, { timeout: 20_000 });

    const bobView = new GameViewPage(bob.page);
    await bobView.waitUntilLoaded();
    const urlBeforeReload = bob.page.url();

    // Simule une "reconnexion": on ferme la page et on en ouvre une nouvelle
    // dans le même contexte (donc avec les mêmes cookies / localStorage).
    await bob.page.close();
    const bobPage2 = await bob.context.newPage();
    await bobPage2.goto(urlBeforeReload);

    const bobView2 = new GameViewPage(bobPage2);
    await bobView2.waitUntilLoaded();
    await bobView2.expectMatchStatusNotPending();

    expect(await bobView2.matchStatus()).not.toBeNull();
  });
});
