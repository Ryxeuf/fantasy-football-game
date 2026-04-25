import { describe, it, expect, beforeEach } from "vitest";
import { rawDelete, rawPost, rawPut, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /admin/data/* auth gate sur les routes write (O.4 expansion E2E).
 *
 * Le spec `admin-data-auth.spec.ts` deja merge couvre les GET sur
 * `/admin/data/*` (8 chemins). Le router monte `authUser + adminOnly`
 * a la racine, donc en theorie toutes les methodes sont protegees,
 * mais il n'existe pas de regression test explicite sur les
 * POST/PUT/DELETE — qui sont les routes les plus dangereuses du
 * controller (ecrasement du catalogue skills/rosters/positions/star
 * players).
 *
 * Ce spec verifie explicitement que :
 *
 *  - 401 sans token sur 15 endpoints write (POST/PUT/DELETE) du
 *    controller admin-data
 *  - 403 avec un token utilisateur lambda (role par defaut "user")
 *  - le body 401/403 ne fuite pas de donnees metier
 *
 * SEC-1 regression : avant Sprint 0 ces routes etaient publiques.
 * Ce spec maintient la garantie qu'on ne re-introduise pas la faille
 * en touchant le router.
 */

interface ProtectedRoute {
  method: "POST" | "PUT" | "DELETE";
  path: string;
}

const PROTECTED_WRITE_ROUTES: ProtectedRoute[] = [
  // Skills
  { method: "POST", path: "/admin/data/skills" },
  { method: "PUT", path: "/admin/data/skills/some-id" },
  { method: "POST", path: "/admin/data/skills/some-id/duplicate" },
  { method: "DELETE", path: "/admin/data/skills/some-id" },
  // Rosters
  { method: "POST", path: "/admin/data/rosters" },
  { method: "PUT", path: "/admin/data/rosters/some-id" },
  { method: "POST", path: "/admin/data/rosters/some-id/duplicate" },
  { method: "DELETE", path: "/admin/data/rosters/some-id" },
  // Positions
  { method: "POST", path: "/admin/data/positions" },
  { method: "PUT", path: "/admin/data/positions/some-id" },
  { method: "POST", path: "/admin/data/positions/some-id/duplicate" },
  { method: "DELETE", path: "/admin/data/positions/some-id" },
  // Star Players
  { method: "POST", path: "/admin/data/star-players" },
  { method: "PUT", path: "/admin/data/star-players/some-id" },
  { method: "DELETE", path: "/admin/data/star-players/some-id" },
];

async function callRoute(
  route: ProtectedRoute,
  token: string | null,
): Promise<Response> {
  const body = { dummy: true };
  switch (route.method) {
    case "POST":
      return rawPost(route.path, token, body);
    case "PUT":
      return rawPut(route.path, token, body);
    case "DELETE":
      return rawDelete(route.path, token);
  }
}

describe("E2E API — /admin/data/* auth gate sur routes write (SEC-1 regression)", () => {
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
        "user@adw.test",
        "password-u",
        "User",
      );
      const res = await callRoute(route, token);
      expect(res.status).toBe(403);
    },
  );

  it("le body d'une 401 sur POST /admin/data/skills ne fuite pas de donnees", async () => {
    const res = await rawPost("/admin/data/skills", null, {
      slug: "test",
      nameFr: "Test",
      nameEn: "Test",
      description: "x",
      category: "general",
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body).toHaveProperty("error");
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("le body d'une 403 sur DELETE /admin/data/skills/:id ne fuite pas de donnees", async () => {
    const { token } = await seedAndLogin(
      "user@adw.test",
      "password-u",
      "User",
    );
    const res = await rawDelete("/admin/data/skills/dummy-id", token);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body).toHaveProperty("error");
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("avec token admin, la garde laisse passer (POST /admin/data/skills)", async () => {
    const { token } = await seedAndLogin(
      "admin@adw.test",
      "password-a",
      "Admin",
      { role: "admin" },
    );
    const res = await rawPost("/admin/data/skills", token, {
      slug: "auth-passthrough-test",
      nameFr: "Test garde",
      nameEn: "Auth gate test",
      description: "spec sec-1",
      category: "general",
    });
    // On verifie uniquement que la garde laisse passer.
    // Le code peut etre 201 (creation reussie), 400 (validation Zod
    // sur un champ non fourni) ou 500 (Prisma sur SQLite). Le but
    // du spec est de valider l'auth, pas la data.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
