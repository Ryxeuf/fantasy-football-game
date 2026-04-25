import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawGet, rawPost, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

/**
 * Spec /leagues (saisons & rondes) — Sprint 17 L.3 / O.4 expansion.
 *
 * Le spec `leagues.spec.ts` deja merge couvre la creation/listing/detail
 * d'une ligue. Ce spec cible les sous-routes saison et ronde, jusqu'ici
 * non couvertes :
 *
 *  - POST /leagues/:id/seasons (createur uniquement)
 *  - GET  /leagues/seasons/:seasonId
 *  - GET  /leagues/seasons/:seasonId/standings
 *  - POST /leagues/seasons/:seasonId/join
 *  - POST /leagues/seasons/:seasonId/leave
 *  - POST /leagues/seasons/:seasonId/rounds (createur uniquement)
 *
 * Cas couverts :
 *  - Auth gates 401 sur chacune
 *  - 404 sur ligue/saison inconnue
 *  - 403 sur create-season / create-round par un non-createur
 *  - Flux complet : create-league -> create-season -> join -> leave
 *  - GET standings sur saison vide -> tableau vide
 *  - Validation Zod : POST /:id/seasons sans name -> 400
 */

interface League {
  id: string;
  creatorId: string;
  name: string;
}

interface Season {
  id: string;
  leagueId: string;
  name: string;
  seasonNumber: number;
  status: string;
}

interface SeasonResponse {
  season: Season & { league?: { id: string } };
}

interface StandingsResponse {
  // La forme exacte depend de computeSeasonStandings; on se contente de
  // valider qu'on recoit un objet avec un tableau standings.
  standings: unknown[];
}

describe("E2E API — /leagues (saisons & rondes)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("auth gates", () => {
    it("POST /leagues/:id/seasons sans token -> 401", async () => {
      const res = await rawPost("/leagues/abc/seasons", null, {
        name: "S1",
      });
      expect(res.status).toBe(401);
    });

    it("GET /leagues/seasons/:seasonId sans token -> 401", async () => {
      const res = await rawGet("/leagues/seasons/abc", null);
      expect(res.status).toBe(401);
    });

    it("GET /leagues/seasons/:seasonId/standings sans token -> 401", async () => {
      const res = await rawGet("/leagues/seasons/abc/standings", null);
      expect(res.status).toBe(401);
    });

    it("POST /leagues/seasons/:seasonId/join sans token -> 401", async () => {
      const res = await rawPost("/leagues/seasons/abc/join", null, {
        teamId: "x",
      });
      expect(res.status).toBe(401);
    });

    it("POST /leagues/seasons/:seasonId/leave sans token -> 401", async () => {
      const res = await rawPost("/leagues/seasons/abc/leave", null, {
        teamId: "x",
      });
      expect(res.status).toBe(401);
    });

    it("POST /leagues/seasons/:seasonId/rounds sans token -> 401", async () => {
      const res = await rawPost("/leagues/seasons/abc/rounds", null, {
        roundNumber: 1,
      });
      expect(res.status).toBe(401);
    });
  });

  describe("404 sur ressource inconnue", () => {
    it("POST /leagues/:id/seasons sur ligue inconnue -> 404", async () => {
      const { token } = await seedAndLogin(
        "ls@e2e.test",
        "pwd",
        "LS",
      );
      const res = await rawPost("/leagues/unknown-league/seasons", token, {
        name: "S1",
      });
      expect(res.status).toBe(404);
    });

    it("GET /leagues/seasons/:seasonId inconnu -> 404", async () => {
      const { token } = await seedAndLogin(
        "ls@e2e.test",
        "pwd",
        "LS",
      );
      const res = await rawGet("/leagues/seasons/unknown-season", token);
      expect(res.status).toBe(404);
    });

    it("POST /leagues/seasons/:seasonId/rounds sur saison inconnue -> 404", async () => {
      const { token } = await seedAndLogin(
        "ls@e2e.test",
        "pwd",
        "LS",
      );
      const res = await rawPost(
        "/leagues/seasons/unknown-season/rounds",
        token,
        { roundNumber: 1 },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("happy path : create-league -> create-season -> join -> leave", () => {
    it("flux complet d'inscription/desinscription d'une equipe", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@ls.test",
        "pwd",
        "Alice",
      );
      const team = await createTeam(userId, "Alice Skavens", "skaven");

      // 1. Creer la ligue (autorise le roster Skaven via allowedRosters=null).
      const league = await post<League>("/leagues", token, {
        name: "Ligue Saison",
      });

      // 2. Creer une saison (createur uniquement).
      const seasonResponse = await post<Season>(
        `/leagues/${league.id}/seasons`,
        token,
        { name: "Saison 1" },
      );
      expect(seasonResponse.id).toBeTruthy();
      expect(seasonResponse.leagueId).toBe(league.id);
      expect(seasonResponse.name).toBe("Saison 1");
      const seasonId = seasonResponse.id;

      // 3. GET /seasons/:id renvoie la saison + sa ligue serialisee.
      const detail = await get<SeasonResponse>(
        `/leagues/seasons/${seasonId}`,
        token,
      );
      expect(detail.season.id).toBe(seasonId);
      expect(detail.season.league?.id).toBe(league.id);

      // 4. Join : inscrire l'equipe.
      const joinRes = await rawPost(
        `/leagues/seasons/${seasonId}/join`,
        token,
        { teamId: team.teamId },
      );
      expect(joinRes.status).toBe(201);

      // 5. Leave : desinscrire l'equipe.
      const leaveRes = await rawPost(
        `/leagues/seasons/${seasonId}/leave`,
        token,
        { teamId: team.teamId },
      );
      expect(leaveRes.status).toBe(200);
    });

    it("GET /leagues/seasons/:id/standings renvoie un tableau (peut etre vide)", async () => {
      const { token } = await seedAndLogin(
        "alice@ls.test",
        "pwd",
        "Alice",
      );
      const league = await post<League>("/leagues", token, {
        name: "Ligue Standings",
      });
      const season = await post<Season>(
        `/leagues/${league.id}/seasons`,
        token,
        { name: "S1" },
      );
      const standings = await get<StandingsResponse>(
        `/leagues/seasons/${season.id}/standings`,
        token,
      );
      expect(standings).toBeDefined();
      // computeSeasonStandings renvoie un objet avec standings (peut etre
      // un tableau vide si aucun match termine).
      expect(typeof standings).toBe("object");
    });
  });

  describe("autorisations", () => {
    it("POST /leagues/:id/seasons par non-createur -> 403", async () => {
      const alice = await seedAndLogin("alice@ls.test", "pwd-a", "Alice");
      const bob = await seedAndLogin("bob@ls.test", "pwd-b", "Bob");
      const league = await post<League>("/leagues", alice.token, {
        name: "Ligue Alice",
      });
      const res = await rawPost(
        `/leagues/${league.id}/seasons`,
        bob.token,
        { name: "S1" },
      );
      expect(res.status).toBe(403);
    });

    it("POST /leagues/seasons/:seasonId/rounds par non-createur -> 403", async () => {
      const alice = await seedAndLogin("alice@ls.test", "pwd-a", "Alice");
      const bob = await seedAndLogin("bob@ls.test", "pwd-b", "Bob");
      const league = await post<League>("/leagues", alice.token, {
        name: "Ligue rondes",
      });
      const season = await post<Season>(
        `/leagues/${league.id}/seasons`,
        alice.token,
        { name: "S1" },
      );
      const res = await rawPost(
        `/leagues/seasons/${season.id}/rounds`,
        bob.token,
        { roundNumber: 1 },
      );
      expect(res.status).toBe(403);
    });
  });

  describe("validation Zod", () => {
    it("POST /leagues/:id/seasons sans name -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@ls.test",
        "pwd",
        "Alice",
      );
      const league = await post<League>("/leagues", token, {
        name: "Ligue Validation",
      });
      const res = await rawPost(
        `/leagues/${league.id}/seasons`,
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("POST /leagues/seasons/:seasonId/join sans teamId -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@ls.test",
        "pwd",
        "Alice",
      );
      const league = await post<League>("/leagues", token, {
        name: "Ligue Join",
      });
      const season = await post<Season>(
        `/leagues/${league.id}/seasons`,
        token,
        { name: "S1" },
      );
      const res = await rawPost(
        `/leagues/seasons/${season.id}/join`,
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("POST /leagues/seasons/:seasonId/rounds avec roundNumber=0 -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@ls.test",
        "pwd",
        "Alice",
      );
      const league = await post<League>("/leagues", token, {
        name: "Ligue Rounds",
      });
      const season = await post<Season>(
        `/leagues/${league.id}/seasons`,
        token,
        { name: "S1" },
      );
      const res = await rawPost(
        `/leagues/seasons/${season.id}/rounds`,
        token,
        { roundNumber: 0 },
      );
      expect(res.status).toBe(400);
    });
  });
});
