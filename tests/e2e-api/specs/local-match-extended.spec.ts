import { describe, it, expect, beforeEach } from "vitest";
import {
  get,
  post,
  rawDelete,
  rawGet,
  rawPost,
  rawPut,
  resetDb,
} from "../helpers/api";
import { createTeam, seedAndLogin } from "../helpers/factories";

/**
 * Spec /local-match/* (etendu) — O.4 expansion E2E.
 *
 * Le spec `local-match.spec.ts` deja merge couvre auth/validation/404
 * pour les endpoints de base (GET /, GET /:id, POST /, DELETE /:id,
 * GET /:id/actions, GET /share/:token). Le controller expose ~14 routes
 * au total. Ce spec ajoute la couverture pour les routes restantes :
 *
 *  - POST /local-match/:id/start           (lance le match)
 *  - POST /local-match/:id/inducements     (selection inducements)
 *  - GET  /local-match/:id/inducements-info (catalogue inducements)
 *  - PUT  /local-match/:id/state           (sync gameState)
 *  - POST /local-match/:id/complete        (cloture avec scores)
 *  - POST /local-match/:id/actions         (log d'action)
 *  - DELETE /local-match/:id/actions/:actionId (suppression d'action)
 *  - POST /local-match/share/:token/validate (validation invite)
 *
 * Plus le happy-path complet de creation : POST /local-match avec
 * teamAId valide -> 201, GET /:id retourne le match, DELETE /:id 200.
 *
 * Aucun changement de schema requis.
 */

interface LocalMatch {
  id: string;
  name: string | null;
  status: string;
  teamAId: string;
  teamBId: string | null;
  ownerId: string;
}

interface LocalMatchResponse {
  localMatch: LocalMatch;
}

interface LocalMatchListResponse {
  localMatches: LocalMatch[];
}

describe("E2E API — /local-match/* (extended)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("auth gates (routes non couvertes par local-match.spec.ts)", () => {
    it("POST /local-match/:id/start sans token -> 401", async () => {
      const res = await rawPost("/local-match/dummy-id/start", null, {});
      expect(res.status).toBe(401);
    });

    it("POST /local-match/:id/inducements sans token -> 401", async () => {
      const res = await rawPost(
        "/local-match/dummy-id/inducements",
        null,
        { selectionA: { items: [] } },
      );
      expect(res.status).toBe(401);
    });

    it("GET /local-match/:id/inducements-info sans token -> 401", async () => {
      const res = await rawGet(
        "/local-match/dummy-id/inducements-info",
        null,
      );
      expect(res.status).toBe(401);
    });

    it("PUT /local-match/:id/state sans token -> 401", async () => {
      const res = await rawPut("/local-match/dummy-id/state", null, {
        gameState: {},
      });
      expect(res.status).toBe(401);
    });

    it("POST /local-match/:id/complete sans token -> 401", async () => {
      const res = await rawPost("/local-match/dummy-id/complete", null, {
        scoreTeamA: 0,
        scoreTeamB: 0,
      });
      expect(res.status).toBe(401);
    });

    it("POST /local-match/:id/actions sans token -> 401", async () => {
      const res = await rawPost("/local-match/dummy-id/actions", null, {});
      expect(res.status).toBe(401);
    });

    it("DELETE /local-match/:id/actions/:actionId sans token -> 401", async () => {
      const res = await rawDelete(
        "/local-match/dummy-id/actions/dummy-action",
        null,
      );
      expect(res.status).toBe(401);
    });

    it("POST /local-match/share/:token/validate sans token -> 401", async () => {
      const res = await rawPost(
        "/local-match/share/some-token/validate",
        null,
        {},
      );
      expect(res.status).toBe(401);
    });
  });

  describe("404 sur match inconnu (auth ok)", () => {
    it("POST /local-match/:id/start sur id inconnu -> 404", async () => {
      const { token } = await seedAndLogin(
        "alice@lm.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/local-match/unknown-match/start", token, {});
      expect(res.status).toBe(404);
    });

    it("GET /local-match/:id/inducements-info sur id inconnu -> 404", async () => {
      const { token } = await seedAndLogin(
        "alice@lm.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet(
        "/local-match/unknown-match/inducements-info",
        token,
      );
      expect(res.status).toBe(404);
    });

    it("PUT /local-match/:id/state sur id inconnu -> 404", async () => {
      const { token } = await seedAndLogin(
        "alice@lm.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(
        "/local-match/unknown-match/state",
        token,
        { gameState: { tick: 1 } },
      );
      expect(res.status).toBe(404);
    });

    it("POST /local-match/:id/complete sur id inconnu -> 404", async () => {
      const { token } = await seedAndLogin(
        "alice@lm.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        "/local-match/unknown-match/complete",
        token,
        { scoreTeamA: 1, scoreTeamB: 0 },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("validation Zod sur les routes auth", () => {
    it("POST /local-match/:id/complete sans scoreTeamA -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@lm.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        "/local-match/some-id/complete",
        token,
        { scoreTeamB: 0 },
      );
      expect(res.status).toBe(400);
    });

    it("PUT /local-match/:id/state sans gameState -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@lm.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut(
        "/local-match/some-id/state",
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("POST /local-match/:id/actions sans payload -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@lm.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        "/local-match/some-id/actions",
        token,
        {},
      );
      expect(res.status).toBe(400);
    });
  });

  describe("happy path : create, get, delete", () => {
    it("POST /local-match avec teamAId valide -> 201, GET retourne le match, DELETE -> 200", async () => {
      const { token, userId } = await seedAndLogin(
        "alice@lm.test",
        "pwd",
        "Alice",
      );
      const team = await createTeam(userId, "Alice Skavens", "skaven");

      const created = await post<LocalMatchResponse>(
        "/local-match",
        token,
        { name: "Match local Alice", teamAId: team.teamId },
      );
      expect(created.localMatch.id).toBeTruthy();
      expect(created.localMatch.name).toBe("Match local Alice");
      expect(created.localMatch.teamAId).toBe(team.teamId);
      expect(created.localMatch.teamBId).toBeNull();
      const matchId = created.localMatch.id;

      // GET /local-match liste les matchs du coach
      const list = await get<LocalMatchListResponse>(
        "/local-match",
        token,
      );
      const ids = list.localMatches.map((m) => m.id);
      expect(ids).toContain(matchId);

      // GET /local-match/:id retourne le detail (envelope `localMatch`)
      const detail = await get<LocalMatchResponse>(
        `/local-match/${matchId}`,
        token,
      );
      expect(detail.localMatch.id).toBe(matchId);

      // DELETE /local-match/:id retourne 200
      const del = await rawDelete(`/local-match/${matchId}`, token);
      expect(del.status).toBe(200);

      // GET /local-match/:id apres delete -> 404
      const after = await rawGet(`/local-match/${matchId}`, token);
      expect(after.status).toBe(404);
    });

    it("DELETE /local-match/:id sur id inconnu -> 404", async () => {
      const { token } = await seedAndLogin(
        "alice@lm.test",
        "pwd",
        "Alice",
      );
      const res = await rawDelete(
        "/local-match/this-match-does-not-exist",
        token,
      );
      expect(res.status).toBe(404);
    });
  });
});
