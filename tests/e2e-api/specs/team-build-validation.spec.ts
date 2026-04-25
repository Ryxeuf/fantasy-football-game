import { describe, it, expect, beforeEach } from "vitest";
import { rawPost, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec POST /team/build (Zod validation) — O.4 expansion E2E.
 *
 * `team-listing.spec.ts` couvre l'auth gate sur POST /team/build.
 * Ce spec verifie en plus que le schema Zod (`buildTeamSchema`)
 * rejette correctement les payloads invalides en E2E.
 *
 * Couvre :
 *  - name vide / absent / > 100 chars -> 400
 *  - roster absent -> 400
 *  - choices absent -> 400
 *  - rerolls hors bornes (-1 ou 9) -> 400
 *  - cheerleaders > 12 -> 400
 *  - assistants > 6 -> 400
 *  - dedicatedFans = 0 ou > 6 -> 400
 *  - apothecary type-check (boolean attendu) -> 400
 *  - teamValue hors bornes (< 100 ou > 2000) -> 400
 *  - rerolls non entier (1.5) -> 400
 *  - roster non whitelist (ALLOWED_TEAMS) -> 400
 *
 * Aucune donnee n'est requise : la validation Zod rejette avant
 * d'atteindre Prisma. Les tests sont independants et rapides.
 */

const baseBody = {
  name: "Test Team",
  roster: "skaven",
  choices: [{ key: "skaven_lineman", count: 11 }],
};

describe("E2E API — POST /team/build (Zod validation)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("sans token -> 401 (deja couvert par team-listing, regression)", async () => {
    const res = await rawPost("/team/build", null, baseBody);
    expect(res.status).toBe(401);
  });

  describe("validations sur les champs requis", () => {
    it("name absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const { name: _, ...body } = baseBody;
      const res = await rawPost("/team/build", token, body);
      expect(res.status).toBe(400);
    });

    it("name vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        name: "",
      });
      expect(res.status).toBe(400);
    });

    it("name > 100 chars -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        name: "x".repeat(101),
      });
      expect(res.status).toBe(400);
    });

    it("roster absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const { roster: _, ...body } = baseBody;
      const res = await rawPost("/team/build", token, body);
      expect(res.status).toBe(400);
    });

    it("choices absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const { choices: _, ...body } = baseBody;
      const res = await rawPost("/team/build", token, body);
      expect(res.status).toBe(400);
    });
  });

  describe("validations sur le staff (bornes)", () => {
    it("rerolls = -1 -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        rerolls: -1,
      });
      expect(res.status).toBe(400);
    });

    it("rerolls = 9 -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        rerolls: 9,
      });
      expect(res.status).toBe(400);
    });

    it("rerolls = 1.5 (non entier) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        rerolls: 1.5,
      });
      expect(res.status).toBe(400);
    });

    it("cheerleaders = 13 -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        cheerleaders: 13,
      });
      expect(res.status).toBe(400);
    });

    it("assistants = 7 -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        assistants: 7,
      });
      expect(res.status).toBe(400);
    });

    it("dedicatedFans = 0 -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        dedicatedFans: 0,
      });
      expect(res.status).toBe(400);
    });

    it("dedicatedFans = 7 -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        dedicatedFans: 7,
      });
      expect(res.status).toBe(400);
    });

    it("apothecary = 'yes' (string au lieu de bool) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        apothecary: "yes",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("validations sur teamValue (bornes)", () => {
    it("teamValue = 50 (< 100) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        teamValue: 50,
      });
      expect(res.status).toBe(400);
    });

    it("teamValue = 5000 (> 2000) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        teamValue: 5000,
      });
      expect(res.status).toBe(400);
    });
  });

  describe("validations metier (post-Zod)", () => {
    it("roster non whitelist (ALLOWED_TEAMS) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@tb.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/team/build", token, {
        ...baseBody,
        roster: "this-is-not-an-allowed-roster",
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: string };
      // Le message metier doit indiquer "non autorise" (post Zod : Zod
      // accepte n'importe quelle string non vide pour `roster`).
      expect(body.error?.toLowerCase()).toContain("autoris");
    });
  });
});
