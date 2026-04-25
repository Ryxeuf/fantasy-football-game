import { describe, it, expect, beforeEach } from "vitest";
import { rawDelete, rawGet, rawPost, resetDb } from "../helpers/api";
import { API_BASE } from "../helpers/env";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /admin/feature-flags/* — O.4 expansion E2E.
 *
 * `feature-flags.spec.ts` couvre la route utilisateur GET /api/feature-flags/me.
 * Ce spec couvre le router admin (`apps/server/src/routes/feature-flags.ts`,
 * monte sur `/admin/feature-flags`) :
 *
 *  - Auth gates 401/403 sur les 7 endpoints admin
 *  - Validations Zod (createFeatureFlagSchema, updateFeatureFlagSchema,
 *    addFeatureFlagUserSchema)
 *  - 404 sur flag inconnu (GET/DELETE /:id, /:id/users)
 *  - happy path : create -> get -> patch -> delete
 */

async function adminLogin(): Promise<{ token: string }> {
  const { token } = await seedAndLogin(
    "admin@ffa.test",
    "password-a",
    "Admin",
    { role: "admin" },
  );
  return { token };
}

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

interface FlagResponse {
  success: boolean;
  data: { id: string; key: string; enabled: boolean };
}

describe("E2E API — /admin/feature-flags/*", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("auth gates (401/403)", () => {
    const ADMIN_PATHS: Array<[string, () => Promise<Response>]> = [
      ["GET /admin/feature-flags", () => rawGet("/admin/feature-flags", null)],
      [
        "POST /admin/feature-flags",
        () => rawPost("/admin/feature-flags", null, { key: "x" }),
      ],
      [
        "DELETE /admin/feature-flags/:id",
        () => rawDelete("/admin/feature-flags/dummy", null),
      ],
      [
        "GET /admin/feature-flags/:id/users",
        () => rawGet("/admin/feature-flags/dummy/users", null),
      ],
      [
        "POST /admin/feature-flags/:id/users",
        () =>
          rawPost("/admin/feature-flags/dummy/users", null, { userId: "u" }),
      ],
      [
        "DELETE /admin/feature-flags/:id/users/:userId",
        () => rawDelete("/admin/feature-flags/dummy/users/u", null),
      ],
    ];

    it.each(ADMIN_PATHS)("%s sans token -> 401", async (_label, call) => {
      const res = await call();
      expect(res.status).toBe(401);
    });

    it("GET /admin/feature-flags avec user non-admin -> 403", async () => {
      const { token } = await seedAndLogin(
        "user@ffa.test",
        "password-u",
        "User",
      );
      const res = await rawGet("/admin/feature-flags", token);
      expect(res.status).toBe(403);
    });

    it("POST /admin/feature-flags avec user non-admin -> 403", async () => {
      const { token } = await seedAndLogin(
        "user@ffa.test",
        "password-u",
        "User",
      );
      const res = await rawPost("/admin/feature-flags", token, {
        key: "test_flag",
      });
      expect(res.status).toBe(403);
    });
  });

  describe("validations Zod (createFeatureFlagSchema)", () => {
    it("body vide -> 400 (key requis)", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/feature-flags", token, {});
      expect(res.status).toBe(400);
    });

    it("key avec majuscules -> 400 (regex echoue)", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/feature-flags", token, {
        key: "MyFlag",
      });
      expect(res.status).toBe(400);
    });

    it("key avec point invalide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/feature-flags", token, {
        key: "my.flag",
      });
      expect(res.status).toBe(400);
    });

    it("key trop longue (>64 chars) -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/feature-flags", token, {
        key: "a".repeat(65),
      });
      expect(res.status).toBe(400);
    });

    it("description > 500 chars -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/feature-flags", token, {
        key: "good_key",
        description: "x".repeat(501),
      });
      expect(res.status).toBe(400);
    });

    it("enabled type-check (string au lieu de bool) -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost("/admin/feature-flags", token, {
        key: "good_key2",
        enabled: "true",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("validations Zod (updateFeatureFlagSchema)", () => {
    it("body vide -> 400 (refine: au moins un champ)", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/feature-flags/some-id",
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("description > 500 chars -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/feature-flags/some-id",
        token,
        { description: "x".repeat(501) },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("validations Zod (addFeatureFlagUserSchema)", () => {
    it("userId absent -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost(
        "/admin/feature-flags/some-id/users",
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("userId vide -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost(
        "/admin/feature-flags/some-id/users",
        token,
        { userId: "" },
      );
      expect(res.status).toBe(400);
    });

    it("userId > 64 chars -> 400", async () => {
      const { token } = await adminLogin();
      const res = await rawPost(
        "/admin/feature-flags/some-id/users",
        token,
        { userId: "x".repeat(65) },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("404 sur flag inconnu (post-validation)", () => {
    it("DELETE /admin/feature-flags/:id inconnu -> 404", async () => {
      const { token } = await adminLogin();
      const res = await rawDelete(
        "/admin/feature-flags/this-flag-does-not-exist",
        token,
      );
      expect(res.status).toBe(404);
    });

    it("GET /admin/feature-flags/:id/users inconnu -> 404", async () => {
      const { token } = await adminLogin();
      const res = await rawGet(
        "/admin/feature-flags/this-flag-does-not-exist/users",
        token,
      );
      expect(res.status).toBe(404);
    });

    it("PATCH /admin/feature-flags/:id inconnu (avec body valide) -> 404", async () => {
      const { token } = await adminLogin();
      const res = await rawPatch(
        "/admin/feature-flags/this-flag-does-not-exist",
        token,
        { enabled: true },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("happy path : create / list / patch / delete", () => {
    it("POST /admin/feature-flags cree un flag -> 201", async () => {
      const { token } = await adminLogin();
      const flag = (await (
        await rawPost("/admin/feature-flags", token, {
          key: "alpha_test",
          description: "Test flag",
          enabled: true,
        })
      ).json()) as FlagResponse;
      expect(flag.success).toBe(true);
      expect(flag.data.key).toBe("alpha_test");

      // GET / liste le flag cree
      const list = (await (
        await rawGet("/admin/feature-flags", token)
      ).json()) as { success: boolean; data: Array<{ key: string }> };
      expect(list.data.some((f) => f.key === "alpha_test")).toBe(true);

      // PATCH /:id desactive le flag
      const patchRes = await rawPatch(
        `/admin/feature-flags/${flag.data.id}`,
        token,
        { enabled: false },
      );
      expect(patchRes.status).toBe(200);

      // DELETE /:id retourne 200
      const delRes = await rawDelete(
        `/admin/feature-flags/${flag.data.id}`,
        token,
      );
      expect(delRes.status).toBe(200);
    });

    it("POST /admin/feature-flags avec key existante -> 409", async () => {
      const { token } = await adminLogin();
      await rawPost("/admin/feature-flags", token, { key: "duplicate_key" });
      const dup = await rawPost("/admin/feature-flags", token, {
        key: "duplicate_key",
      });
      expect(dup.status).toBe(409);
    });
  });
});
