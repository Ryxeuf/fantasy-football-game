import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, get } from "../helpers/api";
import {
  bootMatch,
  createTwoCoaches,
  createMatch,
  chooseTeams,
  acceptAndStart,
} from "../helpers/factories";

/**
 * Spec de sanity/smoke:
 * valide que toute la chaîne d'amorçage (seed-user → login → team → match →
 * accept) fonctionne bout-en-bout sur le vrai serveur Express + Socket.IO
 * en SQLite in-memory.
 *
 * Si ce fichier est rouge, aucune autre spec ne peut passer — c'est donc le
 * premier à lancer.
 */
describe("E2E API — smoke", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("seed + login + team creation fonctionne pour deux coachs distincts", async () => {
    const { coachA, coachB } = await createTwoCoaches();

    expect(coachA.userId).toBeTruthy();
    expect(coachB.userId).toBeTruthy();
    expect(coachA.userId).not.toBe(coachB.userId);
    expect(coachA.teamId).toBeTruthy();
    expect(coachB.teamId).toBeTruthy();
    expect(coachA.roster).toBe("skaven");
    expect(coachB.roster).toBe("lizardmen");
  });

  it("création + join d'un match donne deux matchTokens valides", async () => {
    const { coachA, coachB } = await createTwoCoaches();
    const match = await createMatch(coachA, coachB);

    expect(match.id).toBeTruthy();
    expect(match.aToken).toBeTruthy();
    expect(match.bToken).toBeTruthy();
    expect(match.aToken).not.toBe(match.bToken);
  });

  it("acceptation mutuelle démarre le match (prematch-setup)", async () => {
    const { coachA, coachB } = await createTwoCoaches();
    const match = await createMatch(coachA, coachB);
    await chooseTeams(match, coachA, coachB);
    const started = await acceptAndStart(match, coachA, coachB);

    expect(started.kickingUserId).toBeTruthy();
    expect(started.receivingUserId).toBeTruthy();
    expect(started.kickingUserId).not.toBe(started.receivingUserId);

    const summary = await get<{ status: string }>(
      `/match/${match.id}/summary`,
      coachA.token,
    );
    // Au retour de /match/accept le serveur passe la partie en prematch-setup
    // et lance la séquence pré-match automatique. Le statut "active" n'arrive
    // qu'après le setup (placement des joueurs) — voir specs/prematch & setup.
    expect(["prematch-setup", "active"]).toContain(summary.status);
  });

  it("bootMatch() fournit un match prêt à recevoir des actions multijoueur", async () => {
    const { coachA, coachB, match, started } = await bootMatch();

    expect(coachA).toBeTruthy();
    expect(coachB).toBeTruthy();
    expect(match.id).toBeTruthy();
    expect(started.kickingUserId).toBeTruthy();

    // Le match n'est plus en pending; on le vérifie via /summary (route légère).
    const summaryA = await get<{ status: string }>(
      `/match/${match.id}/summary`,
      coachA.token,
    );
    const summaryB = await get<{ status: string }>(
      `/match/${match.id}/summary`,
      coachB.token,
    );
    expect(summaryA.status).not.toBe("pending");
    expect(summaryB.status).not.toBe("pending");
  });
});
