import { describe, it, expect, beforeEach } from "vitest";
import { post, rawPost, resetDb } from "../helpers/api";
import {
  createMatch,
  createTeam,
  createTwoCoaches,
} from "../helpers/factories";

/**
 * Spec /team/choose : association d'une équipe à un coach pour un match.
 *
 * Couvre :
 *  - validation de payload (400)
 *  - matchId inconnu (404)
 *  - second appel par le même coach sur le même match → conflit (409)
 *  - équipe d'un autre coach → l'API permet techniquement le `connect`
 *    via Prisma, mais on documente le contrat actuel
 *  - choix valide → 201 + selection.teamRef.name renseigné
 */
describe("E2E API — /team/choose", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("refuse un payload sans matchId/teamId (400)", async () => {
    const { coachA } = await createTwoCoaches();
    const res = await rawPost("/team/choose", coachA.token, {});
    expect(res.status).toBe(400);
  });

  it("refuse un matchId inconnu (404)", async () => {
    const { coachA } = await createTwoCoaches();
    const res = await rawPost("/team/choose", coachA.token, {
      matchId: "match-that-does-not-exist",
      teamId: coachA.teamId,
    });
    expect(res.status).toBe(404);
  });

  it("accepte un choix valide et retourne la sélection", async () => {
    const { coachA, coachB } = await createTwoCoaches();
    const match = await createMatch(coachA, coachB);

    const result = await post<{
      selection: {
        userId: string;
        matchId: string;
        teamRef: { name: string; roster: string };
      };
    }>("/team/choose", coachA.token, {
      matchId: match.id,
      teamId: coachA.teamId,
    });

    expect(result.selection.userId).toBe(coachA.userId);
    expect(result.selection.matchId).toBe(match.id);
    expect(result.selection.teamRef.name).toBe(coachA.teamName);
    expect(result.selection.teamRef.roster).toBe(coachA.roster);
  });

  it("refuse un second choix par le même coach sur le même match (409)", async () => {
    const { coachA, coachB } = await createTwoCoaches();
    const match = await createMatch(coachA, coachB);

    // Premier choix : OK.
    await post("/team/choose", coachA.token, {
      matchId: match.id,
      teamId: coachA.teamId,
    });

    // Second choix par le même coach (avec une autre équipe lui appartenant).
    const otherTeam = await createTeam(
      coachA.userId,
      "Backup Skavens",
      "skaven",
    );
    const res = await rawPost("/team/choose", coachA.token, {
      matchId: match.id,
      teamId: otherTeam.teamId,
    });
    expect(res.status).toBe(409);
  });

  it("refuse de réutiliser une équipe déjà choisie par l'adversaire (409)", async () => {
    const { coachA, coachB } = await createTwoCoaches();
    const match = await createMatch(coachA, coachB);

    // A choisit son équipe.
    await post("/team/choose", coachA.token, {
      matchId: match.id,
      teamId: coachA.teamId,
    });

    // B essaie de choisir l'équipe de A → conflit "déjà utilisée".
    const res = await rawPost("/team/choose", coachB.token, {
      matchId: match.id,
      teamId: coachA.teamId,
    });
    expect(res.status).toBe(409);
  });

  it("refuse un coach non authentifié (401)", async () => {
    const { coachA, coachB } = await createTwoCoaches();
    const match = await createMatch(coachA, coachB);
    const res = await rawPost("/team/choose", null, {
      matchId: match.id,
      teamId: coachA.teamId,
    });
    expect(res.status).toBe(401);
  });
});
