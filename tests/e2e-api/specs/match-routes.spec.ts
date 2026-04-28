import { describe, it, expect, beforeEach } from "vitest";
import { get, rawGet, rawPost, resetDb, unwrap } from "../helpers/api";
import {
  bootMatch,
  createMatch,
  createTwoCoaches,
  seedAndLogin,
} from "../helpers/factories";

/**
 * Spec des routes REST /match/* qui n'étaient pas couvertes par les
 * suites existantes (smoke / setup / actions). On valide ici :
 *
 *   - les codes d'erreur d'authentification (401 / 403 / 404)
 *   - le contrat de /match/:id/summary
 *   - le contrat de /match/my-matches
 *   - l'isolation entre coachs (un tiers ne peut pas join un match)
 *
 * On reste sur le chemin "contrats HTTP" : la mécanique de jeu est testée
 * par les specs prematch / setup / actions et par les tests game-engine.
 */
describe("E2E API — routes /match/*", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("POST /match/create sans token → 401", async () => {
    const res = await rawPost("/match/create", null, {});
    expect(res.status).toBe(401);
  });

  it("POST /match/join refuse un payload sans matchId (400)", async () => {
    const { token } = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const res = await rawPost("/match/join", token, {});
    expect(res.status).toBe(400);
  });

  it("POST /match/join sur un matchId inexistant → 4xx/5xx (pas 200)", async () => {
    const { token } = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const res = await rawPost("/match/join", token, {
      matchId: "match-that-does-not-exist",
    });
    // L'implémentation actuelle laisse Prisma lever P2025 → 500. On accepte
    // 404 ou 500 pour rester tolérant à un futur durcissement de la route,
    // mais on garantit qu'aucun token n'est renvoyé.
    expect(res.ok).toBe(false);
    const body = (await res.json().catch(() => ({}))) as {
      matchToken?: string;
      error?: string;
    };
    expect(body.matchToken).toBeUndefined();
  });

  it("POST /match/accept par un tiers non membre est refusé", async () => {
    const { coachA, coachB } = await createTwoCoaches();
    const match = await createMatch(coachA, coachB);

    // Un troisième coach qui n'a pas join le match essaie d'accepter.
    const { token: outsiderToken } = await seedAndLogin(
      "carol@e2e.test",
      "password-c",
      "Carol",
    );
    const res = await rawPost("/match/accept", outsiderToken, {
      matchId: match.id,
    });
    expect(res.ok).toBe(false);
    // L'implémentation actuelle de acceptAndMaybeStartMatch refuse un coach
    // non membre via une 400 ("Coach non membre du match"). On reste tolérant
    // au cas où le contrat évoluerait vers 401/403/404.
    expect([400, 401, 403, 404]).toContain(res.status);
  });

  it("GET /match/:id/summary retourne un objet stable pour un coach membre", async () => {
    const { coachA, match } = await bootMatch();

    const summary = await get<{
      id: string;
      status: string;
      teams: {
        local: { name: string; coach: string };
        visitor: { name: string; coach: string };
      };
      acceptances: { local: boolean; visitor: boolean };
      score: { teamA: number; teamB: number };
    }>(`/match/${match.id}/summary`, coachA.token);

    expect(summary.id).toBe(match.id);
    expect(typeof summary.status).toBe("string");
    expect(summary.teams.local).toBeDefined();
    expect(summary.teams.visitor).toBeDefined();
    expect(summary.score).toEqual({ teamA: 0, teamB: 0 });
    // Les deux coachs ont accepté via bootMatch → les flags doivent être true.
    expect(summary.acceptances.local).toBe(true);
    expect(summary.acceptances.visitor).toBe(true);
  });

  it("GET /match/:id/summary sur un match inconnu → 404", async () => {
    const { token } = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const res = await rawGet("/match/match-that-does-not-exist/summary", token);
    expect(res.status).toBe(404);
  });

  it("GET /match/my-matches liste les matches du coach courant uniquement", async () => {
    const { coachA, coachB, match } = await bootMatch();

    const aMatches = unwrap(
      await get<{
        success: true;
        data: {
          matches: Array<{ id: string; myTeam: unknown; opponent: unknown }>;
        };
      }>("/match/my-matches", coachA.token),
    );
    const bMatches = unwrap(
      await get<{
        success: true;
        data: {
          matches: Array<{ id: string; myTeam: unknown; opponent: unknown }>;
        };
      }>("/match/my-matches", coachB.token),
    );

    expect(aMatches.matches.length).toBeGreaterThan(0);
    expect(bMatches.matches.length).toBeGreaterThan(0);
    expect(aMatches.matches.some((m) => m.id === match.id)).toBe(true);
    expect(bMatches.matches.some((m) => m.id === match.id)).toBe(true);
    // Chaque coach voit son équipe en "myTeam" et son adversaire en "opponent".
    const aRow = aMatches.matches.find((m) => m.id === match.id)!;
    expect(aRow.myTeam).not.toBeNull();
    expect(aRow.opponent).not.toBeNull();
  });

  it("GET /match/my-matches sans token → 401", async () => {
    const res = await rawGet("/match/my-matches", null);
    expect(res.status).toBe(401);
  });

  it("GET /match/my-matches d'un coach tiers ne contient pas le match", async () => {
    const { match } = await bootMatch();

    // Coach C n'est pas membre du match.
    const { token: outsiderToken } = await seedAndLogin(
      "carol@e2e.test",
      "password-c",
      "Carol",
    );
    const list = unwrap(
      await get<{ success: true; data: { matches: Array<{ id: string }> } }>(
        "/match/my-matches",
        outsiderToken,
      ),
    );
    expect(list.matches.some((m) => m.id === match.id)).toBe(false);
  });
});
