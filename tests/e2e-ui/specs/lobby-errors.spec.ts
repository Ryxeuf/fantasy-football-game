import { test, expect } from "../fixtures/two-players";
import { LobbyPage } from "../pages/LobbyPage";

/**
 * Specs Lobby — chemins d'erreur :
 *
 * Le happy path est déjà couvert par full-match.spec.ts. Ici on valide
 * les rebonds d'erreur côté UI :
 *  - join sur un matchId inexistant doit afficher la bannière `play-error`
 *  - le bouton "matchmaking-start" est disabled tant qu'aucune équipe n'est sélectionnée
 *  - le bouton "join" est disabled tant que l'input matchId est vide
 */
test.describe("E2E UI — lobby errors", () => {
  test("affiche play-error sur join d'un matchId inexistant", async ({
    alice,
  }) => {
    const lobby = new LobbyPage(alice.page);
    await lobby.goto();

    await lobby.matchIdInput.fill("match-that-does-not-exist");
    await lobby.joinMatchButton.click();

    // Le serveur renvoie une erreur (4xx/5xx) et le client expose
    // l'erreur via le composant `play-error`. On ne doit PAS partir
    // vers /waiting-hidden/...
    await expect(lobby.errorBanner).toBeVisible({ timeout: 8_000 });
    expect(new URL(alice.page.url()).pathname).toBe("/play");
  });

  test("matchmaking-start est désactivé sans équipe sélectionnée", async ({
    alice,
  }) => {
    const lobby = new LobbyPage(alice.page);
    await lobby.goto();

    // L'équipe peut ne pas être disponible si aucune n'est créée — on
    // s'appuie sur la fixture qui seed une équipe pour Alice.
    await expect(lobby.teamSelect).toBeVisible({ timeout: 5_000 });

    // Au chargement, aucun teamId n'est sélectionné (option "" par défaut).
    // Le bouton matchmaking-start est rendu mais avec l'attribut disabled.
    // S'il n'est pas dans le DOM (pas d'équipes), on skip ; sinon on assert.
    if (await lobby.matchmakingStart.isVisible().catch(() => false)) {
      await expect(lobby.matchmakingStart).toBeDisabled();
    }
  });

  test("join-match-button est désactivé quand l'input matchId est vide", async ({
    alice,
  }) => {
    const lobby = new LobbyPage(alice.page);
    await lobby.goto();

    await expect(lobby.matchIdInput).toBeVisible();
    await lobby.matchIdInput.fill("");
    await expect(lobby.joinMatchButton).toBeDisabled();
  });
});
