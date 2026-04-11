import { test, expect } from "../fixtures/two-players";
import { LobbyPage } from "../pages/LobbyPage";
import { WaitingRoomPage } from "../pages/WaitingRoomPage";
import { GameViewPage } from "../pages/GameViewPage";

/**
 * Parcours critique "happy path" multijoueur:
 *   Alice crée un match → Bob le rejoint → les deux acceptent →
 *   la vue de jeu s'affiche pour les deux joueurs.
 *
 * On ne pousse pas le scénario jusqu'au touchdown dans cette spec:
 * les règles de gameplay sont déjà validées par les tests unitaires
 * game-engine et les contrats socket par la suite e2e-api. L'objectif
 * ici est de garantir qu'aucune régression UI ne casse le chemin
 * bout-en-bout de la création de match à l'entrée dans le plateau.
 */
test.describe("E2E UI — parcours multijoueur happy path", () => {
  test("Alice crée, Bob rejoint, les deux acceptent, la vue de jeu s'ouvre", async ({
    alice,
    bob,
  }) => {
    const aliceLobby = new LobbyPage(alice.page);
    const bobLobby = new LobbyPage(bob.page);

    await aliceLobby.goto();
    const matchId = await aliceLobby.createMatch();
    expect(matchId).toBeTruthy();

    await bobLobby.goto();
    await bobLobby.joinMatch(matchId);

    const aliceWaiting = new WaitingRoomPage(alice.page);
    const bobWaiting = new WaitingRoomPage(bob.page);
    await aliceWaiting.waitUntilVisible();
    await bobWaiting.waitUntilVisible();

    await aliceWaiting.accept();
    await bobWaiting.accept();

    // Après double acceptation, le client redirige vers /play-hidden/<id>
    await alice.page.waitForURL(/\/play-hidden\//, { timeout: 20_000 });
    await bob.page.waitForURL(/\/play-hidden\//, { timeout: 20_000 });

    const aliceView = new GameViewPage(alice.page);
    const bobView = new GameViewPage(bob.page);

    await aliceView.waitUntilLoaded();
    await bobView.waitUntilLoaded();

    // La vue jeu doit afficher soit la synthèse pré-match, soit l'inducement
    // selector, soit le plateau, mais jamais rester sur "pending".
    await aliceView.expectMatchStatusNotPending();
    await bobView.expectMatchStatusNotPending();
  });
});
