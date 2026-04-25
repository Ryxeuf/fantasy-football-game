import { describe, it, expect, beforeEach } from "vitest";
import { rawDelete, rawPost, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /admin/* auth gate sur les routes write (O.4 expansion E2E).
 *
 * Pendant de `admin-data-write-auth.spec.ts` (qui couvre
 * `/admin/data/*` POST/PUT/DELETE), ce spec verifie le router
 * principal `/admin/*` (gestion fonctionnelle : users, matches,
 * teams, purge, reset test).
 *
 * Comme pour `/admin/data/*`, le router `/admin/*` monte
 * `authUser + adminOnly` a la racine. La regression test sur les
 * methodes write est cruciale puisque ces routes peuvent supprimer
 * du contenu utilisateur.
 *
 * Couvre :
 *  - 401 sans token sur les 5 endpoints write (DELETE users/:id,
 *    DELETE matches/:id, POST matches/purge, POST test/reset,
 *    DELETE teams/:id)
 *  - 403 avec token user non-admin
 *  - body 401/403 ne fuite pas de donnees metier
 */

interface ProtectedRoute {
  method: "POST" | "DELETE";
  path: string;
}

const PROTECTED_WRITE_ROUTES: ProtectedRoute[] = [
  { method: "DELETE", path: "/admin/users/some-id" },
  { method: "DELETE", path: "/admin/matches/some-id" },
  { method: "POST", path: "/admin/matches/purge" },
  { method: "POST", path: "/admin/test/reset" },
  { method: "DELETE", path: "/admin/teams/some-id" },
];

async function callRoute(
  route: ProtectedRoute,
  token: string | null,
): Promise<Response> {
  if (route.method === "POST") {
    return rawPost(route.path, token, {});
  }
  return rawDelete(route.path, token);
}

describe("E2E API — /admin/* auth gate sur routes write (regression)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it.each(PROTECTED_WRITE_ROUTES)(
    "$method $path sans token -> 401",
    async (route) => {
      const res = await callRoute(route, null);
      expect(res.status).toBe(401);
    },
  );

  it.each(PROTECTED_WRITE_ROUTES)(
    "$method $path avec token user non-admin -> 403",
    async (route) => {
      const { token } = await seedAndLogin(
        "user@aw.test",
        "password-u",
        "User",
      );
      const res = await callRoute(route, token);
      expect(res.status).toBe(403);
    },
  );

  it("le body d'une 401 sur DELETE /admin/users/:id ne fuite pas de donnees", async () => {
    const res = await rawDelete("/admin/users/dummy-id", null);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body).toHaveProperty("error");
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("le body d'une 403 sur POST /admin/matches/purge ne fuite pas de donnees", async () => {
    const { token } = await seedAndLogin(
      "user@aw.test",
      "password-u",
      "User",
    );
    const res = await rawPost("/admin/matches/purge", token, {});
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body).toHaveProperty("error");
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("avec token admin, la garde laisse passer (POST /admin/matches/purge)", async () => {
    const { token } = await seedAndLogin(
      "admin@aw.test",
      "password-a",
      "Admin",
      { role: "admin" },
    );
    const res = await rawPost("/admin/matches/purge", token, {});
    // On verifie uniquement que la garde laisse passer : la route
    // peut renvoyer 200 (purge OK) ou 500 selon l'etat de la DB.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
