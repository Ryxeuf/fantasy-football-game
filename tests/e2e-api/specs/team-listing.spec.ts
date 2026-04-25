import { describe, it, expect, beforeEach } from "vitest";
import {
  get,
  rawDelete,
  rawGet,
  rawPost,
  rawPut,
  resetDb,
} from "../helpers/api";
import { createTeam, seedAndLogin } from "../helpers/factories";

/**
 * Spec /team/* (listing & detail) — O.4 expansion E2E.
 *
 * Le spec `team-choose.spec.ts` deja merge couvre POST /team/choose.
 * Ce spec etend la couverture aux autres routes auth-protegees du
 * controller team :
 *
 *  - GET /team/mine            : liste des equipes du coach
 *  - GET /team/available       : equipes du coach non engagees dans
 *                                un match actif
 *  - GET /team/:id             : detail d'une equipe (avec stats locales)
 *  - GET /team/rosters/:id     : 404 sur roster inconnu
 *
 * Et verifie l'auth gate sur les routes CRUD jusqu'ici non couvertes :
 *
 *  - PUT /team/:id, PUT /team/:id/info, POST /team/:id/recalculate
 *  - POST /team/:id/players, DELETE /team/:id/players/:playerId
 *  - PUT /team/:id/players/:playerId/skills
 *  - GET /team/:id/star-players, POST/DELETE star-player endpoints
 *  - POST /team/build, POST /team/:id/purchase
 *
 * Aucun changement de schema requis : seul le seed-team helper est
 * utilise pour creer une equipe minimaliste.
 */

interface TeamMineEntry {
  id: string;
  name: string;
  roster: string;
  ruleset: string;
  createdAt: string;
  currentValue: number;
}

interface TeamMineResponse {
  teams: TeamMineEntry[];
}

interface TeamAvailableResponse {
  teams: Array<Omit<TeamMineEntry, "currentValue">>;
}

interface TeamDetail {
  team: {
    id: string;
    name: string;
    roster: string;
    ruleset: string;
    ownerId: string;
    players: Array<{ id: string; name: string; position: string }>;
    starPlayers: unknown[];
  };
  currentMatch: unknown | null;
  localMatchStats: unknown;
}

describe("E2E API — /team/* (listing & detail)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("auth gates", () => {
    it("GET /team/mine sans token -> 401", async () => {
      const res = await rawGet("/team/mine", null);
      expect(res.status).toBe(401);
    });

    it("GET /team/available sans token -> 401", async () => {
      const res = await rawGet("/team/available", null);
      expect(res.status).toBe(401);
    });

    it("GET /team/:id sans token -> 401", async () => {
      const res = await rawGet("/team/dummy-id", null);
      expect(res.status).toBe(401);
    });

    it("GET /team/rosters/:id sans token -> 401", async () => {
      const res = await rawGet("/team/rosters/skaven", null);
      expect(res.status).toBe(401);
    });

    it("PUT /team/:id sans token -> 401", async () => {
      const res = await rawPut("/team/dummy-id", null, { name: "x" });
      expect(res.status).toBe(401);
    });

    it("PUT /team/:id/info sans token -> 401", async () => {
      const res = await rawPut("/team/dummy-id/info", null, {});
      expect(res.status).toBe(401);
    });

    it("POST /team/:id/recalculate sans token -> 401", async () => {
      const res = await rawPost("/team/dummy-id/recalculate", null, {});
      expect(res.status).toBe(401);
    });

    it("POST /team/:id/players sans token -> 401", async () => {
      const res = await rawPost("/team/dummy-id/players", null, {});
      expect(res.status).toBe(401);
    });

    it("DELETE /team/:id/players/:playerId sans token -> 401", async () => {
      const res = await rawDelete(
        "/team/dummy-id/players/dummy-player",
        null,
      );
      expect(res.status).toBe(401);
    });

    it("PUT /team/:id/players/:playerId/skills sans token -> 401", async () => {
      const res = await rawPut(
        "/team/dummy-id/players/dummy-player/skills",
        null,
        {},
      );
      expect(res.status).toBe(401);
    });

    it("GET /team/:id/star-players sans token -> 401", async () => {
      const res = await rawGet("/team/dummy-id/star-players", null);
      expect(res.status).toBe(401);
    });

    it("POST /team/:id/star-players sans token -> 401", async () => {
      const res = await rawPost("/team/dummy-id/star-players", null, {});
      expect(res.status).toBe(401);
    });

    it("DELETE /team/:id/star-players/:starPlayerId sans token -> 401", async () => {
      const res = await rawDelete(
        "/team/dummy-id/star-players/dummy-sp",
        null,
      );
      expect(res.status).toBe(401);
    });

    it("POST /team/build sans token -> 401", async () => {
      const res = await rawPost("/team/build", null, {});
      expect(res.status).toBe(401);
    });

    it("POST /team/:id/purchase sans token -> 401", async () => {
      const res = await rawPost("/team/dummy-id/purchase", null, {});
      expect(res.status).toBe(401);
    });
  });

  describe("GET /team/mine", () => {
    it("user neuf : retourne `{ teams: [] }`", async () => {
      const { token } = await seedAndLogin(
        "fresh@team.test",
        "pwd",
        "Fresh",
      );
      const json = await get<TeamMineResponse>("/team/mine", token);
      expect(json.teams).toEqual([]);
    });

    it("apres seed-team : retourne l'equipe creee", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@team.test",
        "pwd",
        "Alice",
      );
      const team = await createTeam(userId, "Alice Skavens", "skaven");

      const json = await get<TeamMineResponse>("/team/mine", token);
      expect(json.teams).toHaveLength(1);
      expect(json.teams[0]!.id).toBe(team.teamId);
      expect(json.teams[0]!.name).toBe("Alice Skavens");
      expect(json.teams[0]!.roster).toBe("skaven");
    });

    it("isolation : le coach ne voit pas les equipes d'un autre", async () => {
      const alice = await seedAndLogin("alice@team.test", "pwd-a", "Alice");
      const bob = await seedAndLogin("bob@team.test", "pwd-b", "Bob");
      await createTeam(alice.userId, "Alice", "skaven");
      await createTeam(bob.userId, "Bob", "lizardmen");

      const aJson = await get<TeamMineResponse>("/team/mine", alice.token);
      expect(aJson.teams.map((t) => t.name)).toEqual(["Alice"]);

      const bJson = await get<TeamMineResponse>("/team/mine", bob.token);
      expect(bJson.teams.map((t) => t.name)).toEqual(["Bob"]);
    });

    it("filtre ?ruleset=season_2 retourne uniquement les equipes du ruleset", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@team.test",
        "pwd",
        "Alice",
      );
      // Le seed-team cree par defaut en season_3.
      await createTeam(userId, "Alice", "skaven");
      const json = await get<TeamMineResponse>(
        "/team/mine?ruleset=season_2",
        token,
      );
      expect(json.teams).toEqual([]);
    });
  });

  describe("GET /team/available", () => {
    it("user neuf : retourne `{ teams: [] }`", async () => {
      const { token } = await seedAndLogin(
        "fresh@team.test",
        "pwd",
        "Fresh",
      );
      const json = await get<TeamAvailableResponse>("/team/available", token);
      expect(json.teams).toEqual([]);
    });

    it("apres seed-team : retourne l'equipe (non engagee dans un match)", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@team.test",
        "pwd",
        "Alice",
      );
      const team = await createTeam(userId, "Alice Skavens", "skaven");
      const json = await get<TeamAvailableResponse>("/team/available", token);
      expect(json.teams).toHaveLength(1);
      expect(json.teams[0]!.id).toBe(team.teamId);
    });
  });

  describe("GET /team/:id", () => {
    it("propre equipe : 200 + detail (players, ownerId)", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@team.test",
        "pwd",
        "Alice",
      );
      const team = await createTeam(userId, "Alice Skavens", "skaven");

      const json = await get<TeamDetail>(`/team/${team.teamId}`, token);
      expect(json.team.id).toBe(team.teamId);
      expect(json.team.name).toBe("Alice Skavens");
      expect(json.team.roster).toBe("skaven");
      expect(Array.isArray(json.team.players)).toBe(true);
      // seed-team cree 11 linemen
      expect(json.team.players).toHaveLength(11);
      expect(json.currentMatch).toBeNull();
      expect(json.localMatchStats).toBeDefined();
    });

    it("equipe d'un autre coach : 404 (filtre ownerId)", async () => {
      const alice = await seedAndLogin("alice@team.test", "pwd-a", "Alice");
      const bob = await seedAndLogin("bob@team.test", "pwd-b", "Bob");
      const aliceTeam = await createTeam(alice.userId, "Alice", "skaven");

      const res = await rawGet(`/team/${aliceTeam.teamId}`, bob.token);
      expect(res.status).toBe(404);
    });

    it("equipe inconnue : 404", async () => {
      const { token } = await seedAndLogin(
        "alice@team.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet("/team/this-team-does-not-exist", token);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /team/rosters/:id", () => {
    it("roster inconnu : 404", async () => {
      const { token } = await seedAndLogin(
        "alice@team.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet("/team/rosters/this-roster-does-not-exist", token);
      expect(res.status).toBe(404);
    });
  });
});
