import { test, expect } from "../fixtures/two-players";
import { LobbyPage } from "../pages/LobbyPage";

/**
 * Specs Matchmaking Queue : couvrent le flux de recherche automatique
 * d'adversaire via la file d'attente côté UI (/play).
 *
 * Le happy path "match privé" est couvert par full-match.spec.ts.
 * Ici on valide le matchmaking automatique :
 *  - sélection d'équipe → lancement de la recherche → UI "searching"
 *  - annulation de la recherche → retour à l'état initial
 *  - le bouton matchmaking-start est désactivé sans équipe sélectionnée
 *
 * On utilise la fixture two-players pour avoir Alice avec une équipe
 * seedée, mais on ne teste qu'Alice (pas de match found, juste le
 * parcours queue start/cancel).
 */
test.describe("E2E UI — matchmaking queue", () => {
  test("sélection d'équipe + lancement recherche affiche l'UI de recherche", async ({
    alice,
  }) => {
    const lobby = new LobbyPage(alice.page);
    await lobby.goto();

    // Le select d'équipe doit être visible et contenir au moins une option.
    await expect(lobby.teamSelect).toBeVisible({ timeout: 8_000 });

    // Sélectionner la première équipe disponible (valeur non-vide).
    const options = lobby.teamSelect.locator("option");
    const optionCount = await options.count();
    let selectedValue = "";
    for (let i = 0; i < optionCount; i++) {
      const val = await options.nth(i).getAttribute("value");
      if (val && val.trim() !== "") {
        selectedValue = val;
        break;
      }
    }
    expect(selectedValue).toBeTruthy();
    await lobby.teamSelect.selectOption(selectedValue);

    // Cliquer sur matchmaking-start.
    await lobby.matchmakingStart.click();

    // L'UI de recherche doit apparaître : le bouton "cancel" devient visible.
    await expect(lobby.matchmakingCancel).toBeVisible({ timeout: 10_000 });

    // Le bouton "matchmaking-start" ne doit plus être visible (remplacé par
    // le panneau de recherche en cours).
    await expect(lobby.matchmakingStart).not.toBeVisible();
  });

  test("annulation de la recherche revient à l'état initial", async ({
    alice,
  }) => {
    const lobby = new LobbyPage(alice.page);
    await lobby.goto();

    await expect(lobby.teamSelect).toBeVisible({ timeout: 8_000 });

    // Sélectionner la première équipe.
    const options = lobby.teamSelect.locator("option");
    const optionCount = await options.count();
    let selectedValue = "";
    for (let i = 0; i < optionCount; i++) {
      const val = await options.nth(i).getAttribute("value");
      if (val && val.trim() !== "") {
        selectedValue = val;
        break;
      }
    }
    await lobby.teamSelect.selectOption(selectedValue);

    // Lancer puis annuler.
    await lobby.matchmakingStart.click();
    await expect(lobby.matchmakingCancel).toBeVisible({ timeout: 10_000 });

    await lobby.matchmakingCancel.click();

    // Après annulation, on doit retrouver le bouton start et le select.
    await expect(lobby.matchmakingStart).toBeVisible({ timeout: 10_000 });
    await expect(lobby.teamSelect).toBeVisible();
  });

  test("matchmaking-start est désactivé sans équipe sélectionnée", async ({
    alice,
  }) => {
    const lobby = new LobbyPage(alice.page);
    await lobby.goto();

    await expect(lobby.teamSelect).toBeVisible({ timeout: 8_000 });

    // S'assurer qu'aucune équipe n'est sélectionnée (option vide par défaut).
    await lobby.teamSelect.selectOption("");

    // Le bouton start doit être visible ET désactivé.
    await expect(lobby.matchmakingStart).toBeVisible({ timeout: 5_000 });
    await expect(lobby.matchmakingStart).toBeDisabled();
  });
});
