import { describe, it, expect, beforeEach } from "vitest";
import {
  get,
  rawGet,
  rawPost,
  resetDb,
} from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /match/* (etendu) — O.4 expansion E2E.
 *
 * Le spec `match-routes.spec.ts` deja merge couvre 9 cas (create,
 * join, accept, my-matches, summary). Le controller match expose
 * ~20 routes. Ce spec ajoute auth gates et 404 sur les routes
 * jusqu'ici non couvertes :
 *
 *   POST /practice                  (ne pas confondre avec /local-match)
 *   GET  /details                   (no auth, x-match-token requis)
 *   GET  /:id/details
 *   GET  /:id/teams
 *   GET  /:id/state
 *   POST /:id/move                  (deja partiellement couvert dans actions.spec)
 *   POST /:id/validate-setup
 *   POST /:id/place-kickoff-ball
 *   POST /:id/calculate-kick-deviation
 *   POST /:id/resolve-kickoff-event
 *   GET  /:id/turns
 *   GET  /:id/results
 *   GET  /live
 *   GET  /:id/spectate
 *   GET  /:id/replay
 *
 * Plus :
 *  - GET /match/details renvoie 401 sans header x-match-token
 *  - GET /match/details renvoie 401 si le token est invalide
 *  - GET /match/live retourne `{ matches: [] }` quand aucun match actif
 *
 * Les routes online sont gatees par le feature-flag ONLINE_PLAY ;
 * la suite e2e-api force `FEATURE_FLAGS_FORCE_ENABLED=true` au boot
 * (cf. tests/e2e-api/setup.ts), donc le gate ne nous bloque pas.
 */

interface LiveMatchesResponse {
  matches: unknown[];
}

describe("E2E API — /match/* (extended)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("auth gates (routes non couvertes par match-routes.spec.ts)", () => {
    it("POST /match/practice sans token -> 401", async () => {
      const res = await rawPost("/match/practice", null, {});
      expect(res.status).toBe(401);
    });

    it("POST /match/join sans token -> 401", async () => {
      const res = await rawPost("/match/join", null, { matchId: "x" });
      expect(res.status).toBe(401);
    });

    it("POST /match/accept sans token -> 401", async () => {
      const res = await rawPost("/match/accept", null, { matchId: "x" });
      expect(res.status).toBe(401);
    });

    it("GET /match/:id/details sans token -> 401", async () => {
      const res = await rawGet("/match/dummy-id/details", null);
      expect(res.status).toBe(401);
    });

    it("GET /match/:id/teams sans token -> 401", async () => {
      const res = await rawGet("/match/dummy-id/teams", null);
      expect(res.status).toBe(401);
    });

    it("GET /match/:id/state sans token -> 401", async () => {
      const res = await rawGet("/match/dummy-id/state", null);
      expect(res.status).toBe(401);
    });

    it("POST /match/:id/move sans token -> 401", async () => {
      const res = await rawPost("/match/dummy-id/move", null, {
        move: { type: "END_TURN" },
      });
      expect(res.status).toBe(401);
    });

    it("POST /match/:id/validate-setup sans token -> 401", async () => {
      const res = await rawPost(
        "/match/dummy-id/validate-setup",
        null,
        {},
      );
      expect(res.status).toBe(401);
    });

    it("POST /match/:id/place-kickoff-ball sans token -> 401", async () => {
      const res = await rawPost(
        "/match/dummy-id/place-kickoff-ball",
        null,
        {},
      );
      expect(res.status).toBe(401);
    });

    it("POST /match/:id/calculate-kick-deviation sans token -> 401", async () => {
      const res = await rawPost(
        "/match/dummy-id/calculate-kick-deviation",
        null,
        {},
      );
      expect(res.status).toBe(401);
    });

    it("POST /match/:id/resolve-kickoff-event sans token -> 401", async () => {
      const res = await rawPost(
        "/match/dummy-id/resolve-kickoff-event",
        null,
        {},
      );
      expect(res.status).toBe(401);
    });

    it("GET /match/:id/turns sans token -> 401", async () => {
      const res = await rawGet("/match/dummy-id/turns", null);
      expect(res.status).toBe(401);
    });

    it("GET /match/:id/results sans token -> 401", async () => {
      const res = await rawGet("/match/dummy-id/results", null);
      expect(res.status).toBe(401);
    });

    it("GET /match/live sans token -> 401", async () => {
      const res = await rawGet("/match/live", null);
      expect(res.status).toBe(401);
    });

    it("GET /match/:id/spectate sans token -> 401", async () => {
      const res = await rawGet("/match/dummy-id/spectate", null);
      expect(res.status).toBe(401);
    });

    it("GET /match/:id/replay sans token -> 401", async () => {
      const res = await rawGet("/match/dummy-id/replay", null);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /match/details (x-match-token public-but-signed)", () => {
    it("sans header x-match-token -> 401", async () => {
      const res = await rawGet("/match/details", null);
      expect(res.status).toBe(401);
    });

    it("avec x-match-token invalide -> 401", async () => {
      const res = await fetch(
        `${process.env.API_BASE || "http://localhost:18002"}/match/details`,
        { headers: { "x-match-token": "not-a-valid-jwt" } },
      );
      expect(res.status).toBe(401);
    });
  });

  describe("404 sur match inconnu (auth ok)", () => {
    it("GET /match/:id/details inconnu -> 404", async () => {
      const { token } = await seedAndLogin(
        "alice@match.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet("/match/unknown-match/details", token);
      expect(res.status).toBe(404);
    });

    it("GET /match/:id/teams inconnu -> 404", async () => {
      const { token } = await seedAndLogin(
        "alice@match.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet("/match/unknown-match/teams", token);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /match/live (DB vide)", () => {
    it("retourne `{ matches: [] }` quand aucun match actif", async () => {
      const { token } = await seedAndLogin(
        "alice@match.test",
        "pwd",
        "Alice",
      );
      const json = await get<LiveMatchesResponse>("/match/live", token);
      expect(json).toHaveProperty("matches");
      expect(Array.isArray(json.matches)).toBe(true);
      expect(json.matches).toEqual([]);
    });
  });
});
