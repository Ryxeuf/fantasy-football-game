import { describe, it, expect, beforeEach } from "vitest";
import { rawPost, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec validations Zod sur les routes /match/* — O.4 expansion E2E.
 *
 * `match-routes.spec.ts` et `match-extended.spec.ts` couvrent l'auth
 * gate. Ce spec verifie en plus que les schemas Zod (cf.
 * `apps/server/src/schemas/match.schemas.ts`) rejettent bien les
 * payloads invalides en E2E.
 *
 * Schemas couverts :
 *  - joinMatchSchema     : POST /match/join
 *  - acceptMatchSchema   : POST /match/accept
 *  - createPracticeOnlineMatchSchema : POST /match/practice
 *  - moveSchema          : POST /match/:id/move
 *  - validateSetupSchema : POST /match/:id/validate-setup
 *  - placeKickoffBallSchema : POST /match/:id/place-kickoff-ball
 *
 * Le `validate` middleware fire AVANT toute lecture Prisma, donc on
 * utilise un matchId fictif : la 400 est renvoyee avant que la route
 * ne cherche le match en base.
 */

const MATCH_ID = "fictional-match-id";

describe("E2E API — /match/* validations Zod", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("POST /match/join (joinMatchSchema)", () => {
    it("matchId absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/match/join", token, {});
      expect(res.status).toBe(400);
    });

    it("matchId vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/match/join", token, { matchId: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /match/accept (acceptMatchSchema)", () => {
    it("matchId absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/match/accept", token, {});
      expect(res.status).toBe(400);
    });

    it("matchId vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/match/accept", token, { matchId: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /match/practice (createPracticeOnlineMatchSchema)", () => {
    it("userTeamId absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/match/practice", token, {
        difficulty: "easy",
      });
      expect(res.status).toBe(400);
    });

    it("difficulty absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/match/practice", token, {
        userTeamId: "team-1",
      });
      expect(res.status).toBe(400);
    });

    it("difficulty invalide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/match/practice", token, {
        userTeamId: "team-1",
        difficulty: "extreme",
      });
      expect(res.status).toBe(400);
    });

    it("userSide invalide (= 'C') -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/match/practice", token, {
        userTeamId: "team-1",
        difficulty: "medium",
        userSide: "C",
      });
      expect(res.status).toBe(400);
    });

    it("seed > 200 chars -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/match/practice", token, {
        userTeamId: "team-1",
        difficulty: "easy",
        seed: "x".repeat(201),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /match/:id/move (moveSchema)", () => {
    it("move absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/match/${MATCH_ID}/move`, token, {});
      expect(res.status).toBe(400);
    });

    it("move sans type -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/match/${MATCH_ID}/move`, token, {
        move: {},
      });
      expect(res.status).toBe(400);
    });

    it("move.type vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(`/match/${MATCH_ID}/move`, token, {
        move: { type: "" },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /match/:id/validate-setup (validateSetupSchema)", () => {
    it("placedPlayers et playerPositions absents -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        `/match/${MATCH_ID}/validate-setup`,
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("playerPositions avec coords manquantes -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        `/match/${MATCH_ID}/validate-setup`,
        token,
        {
          placedPlayers: [],
          playerPositions: [{ playerId: "p1", x: 0 }], // y manquant
        },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("POST /match/:id/place-kickoff-ball (placeKickoffBallSchema)", () => {
    it("position absente -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        `/match/${MATCH_ID}/place-kickoff-ball`,
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("position avec x non-numerique -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@mv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        `/match/${MATCH_ID}/place-kickoff-ball`,
        token,
        { position: { x: "left", y: 5 } },
      );
      expect(res.status).toBe(400);
    });
  });
});
