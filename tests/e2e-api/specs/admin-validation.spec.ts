import { describe, it, expect, beforeEach } from "vitest";
import { rawGet, resetDb } from "../helpers/api";
import { API_BASE } from "../helpers/env";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec validations Zod sur les routes /admin/* — O.4 expansion E2E.
 *
 * `admin-routes-auth.spec.ts` couvre les auth gates (401/403),
 * `admin-write-auth.spec.ts` couvre POST/DELETE auth gates. Ce spec
 * verifie en plus que les schemas Zod (cf.
 * `apps/server/src/schemas/admin.schemas.ts`) rejettent les payloads
 * invalides en E2E une fois la garde admin franchie.
 *
 * Schemas couverts :
 *  - adminUsersQuerySchema   : GET /admin/users
 *  - adminMatchesQuerySchema : GET /admin/matches
 *  - adminTeamsQuerySchema   : GET /admin/teams
 *  - updateUserRoleSchema    : PATCH /admin/users/:id/role
 *  - updateUserPatreonSchema : PATCH /admin/users/:id/patreon
 *  - updateUserValidSchema   : PATCH /admin/users/:id/valid
 *  - updateMatchStatusSchema : PATCH /admin/matches/:id/status
 */

async function rawPatch(
  path: string,
  token: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });
}

async function adminLogin(): Promise<{ token: string }> {
  const { token } = await seedAndLogin(
    "admin@av.test",
    "password-a",
    "Admin",
    { role: "admin" },
  );
  return { token };
}

describe("E2E API — /admin/* validations Zod (post-auth)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("query schemas", () => {
    it("GET /admin/users avec page=-1 -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawGet("/admin/users?page=-1", token);
      expect(res.status).toBe(400);
    });

    it("GET /admin/users avec limit=500 (>200) -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawGet("/admin/users?limit=500", token);
      expect(res.status).toBe(400);
    });

    it("GET /admin/users avec sortBy=invalid -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawGet("/admin/users?sortBy=invalid", token);
      expect(res.status).toBe(400);
    });

    it("GET /admin/matches avec status invalide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawGet("/admin/matches?status=magical", token);
      expect(res.status).toBe(400);
    });

    it("GET /admin/teams avec sortBy invalide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawGet("/admin/teams?sortBy=invalid", token);
      expect(res.status).toBe(400);
    });

    it("GET /admin/teams avec limit > 200 -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawGet("/admin/teams?limit=300", token);
      expect(res.status).toBe(400);
    });

    it("GET /admin/users (defaults) avec admin token -> 200", async () => {
      const { token } = await adminLogin();
      const res = await rawGet("/admin/users", token);
      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /admin/users/:id/role (updateUserRoleSchema)", () => {
    it("body vide -> 400 (refine: role ou roles requis)", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/users/some-id/role",
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("role invalide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/users/some-id/role",
        token,
        { role: "wizard" },
      );
      expect(res.status).toBe(400);
    });

    it("roles avec valeur invalide dans le tableau -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/users/some-id/role",
        token,
        { roles: ["user", "wizard"] },
      );
      expect(res.status).toBe(400);
    });

    it("roles vide -> 400 (refine)", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/users/some-id/role",
        token,
        { roles: [] },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /admin/users/:id/patreon (updateUserPatreonSchema)", () => {
    it("patreon absent -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/users/some-id/patreon",
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("patreon = 'yes' (string au lieu de bool) -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/users/some-id/patreon",
        token,
        { patreon: "yes" },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /admin/users/:id/valid (updateUserValidSchema)", () => {
    it("valid absent -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/users/some-id/valid",
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("valid = 'true' (string au lieu de bool) -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/users/some-id/valid",
        token,
        { valid: "true" },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /admin/matches/:id/status (updateMatchStatusSchema)", () => {
    it("status absent -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/matches/some-id/status",
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("status invalide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/matches/some-id/status",
        token,
        { status: "magical" },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("auth precedes validation", () => {
    it("PATCH /admin/users/:id/role sans token -> 401 (auth avant Zod)", async () => {
      const res = await fetch(`${API_BASE}/admin/users/some-id/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "wizard" }),
      });
      expect(res.status).toBe(401);
    });

    it("PATCH /admin/users/:id/role avec user non-admin -> 403", async () => {
      const { token } = await seedAndLogin(
        "user@av.test",
        "password-u",
        "User",
      );
      const res = await rawPatch(
        "/admin/users/some-id/role",
        token,
        { role: "admin" },
      );
      expect(res.status).toBe(403);
    });
  });
});
