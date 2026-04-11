import { test, expect } from "../fixtures/two-players";
import { LobbyPage } from "../pages/LobbyPage";
import { WaitingRoomPage } from "../pages/WaitingRoomPage";

/**
 * Spec d'acceptation dans la salle d'attente :
 *
 * Le full-match.spec.ts ne valide que la sortie de la salle d'attente
 * (les deux acceptent → /play-hidden/...). Ici on cible explicitement
 * les indicateurs `data-accepted="true|false"` exposés par les
 * composants `acceptance-local` / `acceptance-visitor` :
 *
 *   1. Quand Alice accepte mais pas Bob, l'indicateur "local" passe à
 *      true côté Alice et côté Bob (l'API renvoie une vue absolue
 *      basée sur le creatorId, pas sur le viewer).
 *   2. L'indicateur "visitor" reste à false tant que Bob n'a pas accepté.
 *
 * On reste dans la phase pending (pas de redirect /play-hidden/...).
 */
test.describe("E2E UI — waiting room acceptance indicators", () => {
  test(
    "data-accepted bascule à true après Alice accept (Bob non accepté)",
    async ({ alice, bob }) => {
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

      // État initial : aucun coach n'a accepté.
      await expect(aliceWaiting.localAcceptance).toHaveAttribute(
        "data-accepted",
        "false",
      );
      await expect(aliceWaiting.visitorAcceptance).toHaveAttribute(
        "data-accepted",
        "false",
      );

      // Alice accepte (Bob non).
      await aliceWaiting.accept();

      // Côté Alice, "local" (= créateur du match = Alice) doit passer à true.
      // Le serveur recalcule l'état après que la /summary suivante soit
      // demandée → on poll via expect.poll plutôt qu'un toHaveAttribute strict.
      await expect
        .poll(
          async () =>
            aliceWaiting.localAcceptance.getAttribute("data-accepted"),
          { timeout: 8_000, intervals: [500] },
        )
        .toBe("true");

      // Côté Bob (qui n'a pas encore accepté), la même information doit
      // remonter via /summary : Alice a accepté, donc local=true côté Bob.
      await expect
        .poll(
          async () => bobWaiting.localAcceptance.getAttribute("data-accepted"),
          { timeout: 8_000, intervals: [500] },
        )
        .toBe("true");

      // Visitor (= Bob, non créateur) doit rester à false des deux côtés.
      await expect(bobWaiting.visitorAcceptance).toHaveAttribute(
        "data-accepted",
        "false",
      );
      await expect(aliceWaiting.visitorAcceptance).toHaveAttribute(
        "data-accepted",
        "false",
      );
    },
  );
});
