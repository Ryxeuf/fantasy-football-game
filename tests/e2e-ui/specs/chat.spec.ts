import { test, expect } from "../fixtures/two-players";
import { LobbyPage } from "../pages/LobbyPage";
import { WaitingRoomPage } from "../pages/WaitingRoomPage";
import { GameViewPage } from "../pages/GameViewPage";

/**
 * Le chat in-game est un composant clé du multijoueur: le coach ne peut
 * pas communiquer autrement pendant un match. On valide ici qu'un
 * message envoyé par Alice est bien reçu par Bob dans le même match.
 *
 * Dépend du parcours happy path (full-match.spec.ts). Si full-match est
 * rouge, cette spec le sera aussi.
 */
test.describe("E2E UI — chat in-game", () => {
  test("Alice envoie un message, Bob le reçoit en temps réel", async ({
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

    const aliceView = new GameViewPage(alice.page);
    const bobView = new GameViewPage(bob.page);
    await aliceView.waitUntilLoaded();
    await bobView.waitUntilLoaded();

    const message = `GL HF ${Date.now()}`;
    await aliceView.sendChat(message);

    // Bob doit voir le message apparaître dans son panneau chat.
    await bobView.openChat();
    await expect(bobView.chatPanel).toContainText(message, {
      timeout: 10_000,
    });
  });
});
