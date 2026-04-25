import { describe, it, expect, beforeEach } from "vitest";
import { rawPost, rawPut, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec validations Zod sur /admin/data/* (post-auth) — O.4 expansion E2E.
 *
 * `admin-data-write-auth.spec.ts` couvre auth gates 401/403 sur les
 * 15 endpoints write. Ce spec verifie en plus que les schemas Zod
 * (cf. apps/server/src/schemas/admin-data.schemas.ts) rejettent
 * bien les payloads invalides en E2E une fois la garde admin franchie.
 *
 * Schemas couverts :
 *  - createSkillSchema, updateSkillSchema
 *  - createRosterSchema, updateRosterSchema
 *  - createPositionSchema, updatePositionSchema
 *  - duplicateToRulesetSchema, duplicatePositionSchema
 */

async function adminLogin(): Promise<{ token: string }> {
  const { token } = await seedAndLogin(
    "admin@adv.test",
    "password-a",
    "Admin",
    { role: "admin" },
  );
  return { token };
}

describe("E2E API — /admin/data/* validations Zod (post-auth)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("POST /admin/data/skills (createSkillSchema)", () => {
    it("body vide -> 400 (slug, nameFr, nameEn, description, category requis)", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/data/skills", token, {});
      expect(res.status).toBe(400);
    });

    it("slug vide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/data/skills", token, {
        slug: "",
        nameFr: "Block",
        nameEn: "Block",
        description: "x",
        category: "general",
      });
      expect(res.status).toBe(400);
    });

    it("nameFr > 200 chars -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/data/skills", token, {
        slug: "test",
        nameFr: "x".repeat(201),
        nameEn: "Block",
        description: "x",
        category: "general",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /admin/data/skills/:id (updateSkillSchema)", () => {
    it("nameFr vide -> 400 (.min(1))", async () => {
      const { token } = await adminLogin();
      const res = await rawPut(
        "/admin/data/skills/some-id",
        token,
        { nameFr: "" },
      );
      expect(res.status).toBe(400);
    });

    it("isElite type-check (string au lieu de bool) -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPut(
        "/admin/data/skills/some-id",
        token,
        { isElite: "true" },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("POST /admin/data/skills/:id/duplicate (duplicateToRulesetSchema)", () => {
    it("targetRuleset absent -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost(
        "/admin/data/skills/some-id/duplicate",
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("targetRuleset vide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost(
        "/admin/data/skills/some-id/duplicate",
        token,
        { targetRuleset: "" },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("POST /admin/data/rosters (createRosterSchema)", () => {
    it("body vide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/data/rosters", token, {});
      expect(res.status).toBe(400);
    });

    it("budget absent -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/data/rosters", token, {
        slug: "test-roster",
        name: "Test",
        nameEn: "Test",
        tier: "I",
      });
      expect(res.status).toBe(400);
    });

    it("budget non-numerique -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/data/rosters", token, {
        slug: "test-roster",
        name: "Test",
        nameEn: "Test",
        tier: "I",
        budget: "expensive",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /admin/data/rosters/:id (updateRosterSchema)", () => {
    it("name absent -> 400 (requis)", async () => {
      const { token } = await adminLogin();
      const res = await rawPut(
        "/admin/data/rosters/some-id",
        token,
        { nameEn: "Test" },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("POST /admin/data/positions (createPositionSchema)", () => {
    it("body vide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/data/positions", token, {});
      expect(res.status).toBe(400);
    });

    it("ma non-entier -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/data/positions", token, {
        rosterId: "r1",
        slug: "lineman",
        displayName: "Lineman",
        cost: 50,
        min: 0,
        max: 16,
        ma: 6.5,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
      });
      expect(res.status).toBe(400);
    });

    it("rosterId vide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/data/positions", token, {
        rosterId: "",
        slug: "lineman",
        displayName: "Lineman",
        cost: 50,
        min: 0,
        max: 16,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /admin/data/positions/:id/duplicate (duplicatePositionSchema)", () => {
    it("targetRosterId absent -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost(
        "/admin/data/positions/some-id/duplicate",
        token,
        {},
      );
      expect(res.status).toBe(400);
    });
  });
});
