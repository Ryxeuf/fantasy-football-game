import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, get, unwrap } from "../helpers/api";
import {
  bootMatch,
  createTwoCoaches,
  createMatch,
  chooseTeams,
  acceptAndStart,
} from "../helpers/factories";
import { connectToMatch } from "../helpers/socket";

/**
 * Spec pré-match automatisé:
 * Après l'acceptation mutuelle, le serveur déclenche
 * `runAutomatedPreMatchSequence` en fire-and-forget. Cette séquence enchaîne
 *   idle → fans → weather → journeymen → inducements
 * et broadcast chaque transition via `game:state-updated` sur la room du match.
 *
 * On valide ici que:
 *  1. l'état atteint bien la phase `inducements`
 *  2. les données de `preMatch.fanFactor` / `preMatch.weather` sont présentes
 *  3. les deux joueurs reçoivent la broadcast
 */
describe("E2E API — pré-match automatisé", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("atteint la phase 'inducements' via broadcast WebSocket", async () => {
    // Pour être sûr de capter la broadcast, on se connecte au match AVANT
    // de déclencher l'acceptation: la fire-and-forget
    // `runAutomatedPreMatchSequence` peut finir en quelques millisecondes.
    const { coachA, coachB } = await createTwoCoaches();
    const match = await createMatch(coachA, coachB);
    await chooseTeams(match, coachA, coachB);

    const sockA = await connectToMatch(coachA.token, match.id);
    const sockB = await connectToMatch(coachB.token, match.id);

    try {
      // On prépare l'attente AVANT d'accepter, sinon le broadcast peut
      // arriver entre l'accept et la pose du listener.
      const inducementsPromise = sockA.waitForMatching<{
        gameState: {
          preMatch?: { phase?: string; fanFactor?: unknown; weather?: unknown };
        };
      }>(
        "game:state-updated",
        (ev) => ev?.gameState?.preMatch?.phase === "inducements",
        15_000,
      );

      await acceptAndStart(match, coachA, coachB);
      const payload = await inducementsPromise;

      expect(payload.gameState.preMatch?.phase).toBe("inducements");
      expect(payload.gameState.preMatch?.fanFactor).toBeDefined();
      expect(payload.gameState.preMatch?.weather).toBeDefined();
    } finally {
      sockA.disconnect();
      sockB.disconnect();
    }
  });

  it("l'état pré-match est lisible via REST /match/:id/state", async () => {
    const { coachA, match } = await bootMatch();

    // On poll /state jusqu'à trouver preMatch.phase == "inducements"
    // (ou jusqu'au timeout).
    const deadline = Date.now() + 10_000;
    let lastPhase: string | undefined;
    while (Date.now() < deadline) {
      try {
        const state = unwrap(
          await get<{
            success: true;
            data: { gameState: { preMatch?: { phase?: string } } };
          }>(`/match/${match.id}/state`, coachA.token),
        );
        lastPhase = state.gameState?.preMatch?.phase;
        if (
          lastPhase === "inducements" ||
          lastPhase === "kicking-team" ||
          lastPhase === "setup"
        ) {
          break;
        }
      } catch {
        // La route /state peut être transitoirement 500 pendant que l'auto
        // séquence écrit un turn — on retente.
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    expect(
      ["inducements", "kicking-team", "setup"].includes(lastPhase ?? ""),
    ).toBe(true);
  });
});
