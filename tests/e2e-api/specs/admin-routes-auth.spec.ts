import { describe, it, expect, beforeEach } from "vitest";
import { rawGet, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /admin/* auth gate (O.4 expansion E2E).
 *
 * Le router `apps/server/src/routes/admin.ts` monte
 * `router.use(authUser, adminOnly)` a la racine, ce qui doit garantir
 * que TOUTES les routes administratives (gestion users, matches,
 * teams, stats, purge, reset test) rejettent :
 *
 *  - les requetes non authentifiees (401, via `authUser`)
 *  - les requetes authentifiees sans role `admin` (403, via
 *    `adminOnly` qui re-verifie le role en base pour eviter les
 *    JWT forges avec un role inflate)
 *
 * Ce spec est complementaire de `admin-data-auth.spec.ts` qui couvre
 * la garde sur le sous-router `/admin/data/*`. Ici on se concentre sur
 * le router `/admin/*` direct (gestion fonctionnelle, statistiques).
 *
 * Couverture :
 *
 *  - 401 sans token sur 7 GET principaux (users, users/:id, matches,
 *    matches/:id, teams, teams/:id, stats)
 *  - 403 avec token utilisateur lambda (role par defaut `user`)
 *  - 200 avec token admin sur GET /admin/users (cas trivial sans
 *    filtres : la garde laisse passer et la route renvoie une
 *    structure paginee)
 *  - Le body 401 ne fuite que `{ error }` — aucune donnee admin
 *
 * Aucune donnee metier n'est requise pour les cas 401/403 puisque la
 * garde rejette avant que Prisma soit sollicite.
 */

const PROTECTED_GET_PATHS = [
  "/admin/users",
  "/admin/users/some-id",
  "/admin/matches",
  "/admin/matches/some-id",
  "/admin/teams",
  "/admin/teams/some-id",
  "/admin/stats",
];

interface AdminUsersResponse {
  users: Array<{ id: string; email: string; role: string }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

describe("E2E API — /admin/* auth gate (regression)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it.each(PROTECTED_GET_PATHS)("GET %s sans token -> 401", async (path) => {
    const res = await rawGet(path, null);
    expect(res.status).toBe(401);
  });

  it.each(PROTECTED_GET_PATHS)(
    "GET %s avec token user non-admin -> 403",
    async (path) => {
      const { token } = await seedAndLogin(
        "admin-routes-user@e2e.test",
        "password-u",
        "RegularUser",
      );
      const res = await rawGet(path, token);
      expect(res.status).toBe(403);
    },
  );

  it("GET /admin/users avec token admin -> 200 + structure paginee", async () => {
    const { token, userId } = await seedAndLogin(
      "admin-routes-admin@e2e.test",
      "password-a",
      "AdminUser",
      { role: "admin" },
    );
    const res = await rawGet("/admin/users", token);
    expect(res.status).toBe(200);
    const json = (await res.json()) as AdminUsersResponse;
    expect(json).toHaveProperty("users");
    expect(json).toHaveProperty("pagination");
    expect(Array.isArray(json.users)).toBe(true);
    // L'admin lui-meme doit figurer dans la liste.
    expect(json.users.some((u) => u.id === userId)).toBe(true);
    expect(json.pagination.total).toBeGreaterThanOrEqual(1);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.limit).toBeGreaterThan(0);
    expect(json.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("le body d'une 401 ne fuite aucune donnee admin", async () => {
    const res = await rawGet("/admin/users", null);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
    // Strictement `{ error }` — pas de fuite (liste users, schema).
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("le body d'une 403 ne fuite aucune donnee admin", async () => {
    const { token } = await seedAndLogin(
      "admin-routes-leak@e2e.test",
      "password-l",
      "LeakProbe",
    );
    const res = await rawGet("/admin/users", token);
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
    expect(Object.keys(body)).toEqual(["error"]);
  });
});
