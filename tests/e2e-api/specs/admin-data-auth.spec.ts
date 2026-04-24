import { describe, it, expect, beforeEach } from "vitest";
import { rawGet, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /admin/data/* auth gate (O.4 expansion E2E).
 *
 * La regression test est critique : historiquement la faille SEC-1
 * decouverte lors de l'audit (voir TODO.md Sprint 0) etait que les
 * endpoints `/admin/data/*` n'avaient pas de middleware auth,
 * exposant la gestion des skills / rosters / positions / star
 * players au monde entier.
 *
 * Le fix (Sprint 0 SEC-1) monte `authUser` + `adminOnly` a la racine
 * du router (`router.use(authUser, adminOnly)`). Ce spec verifie que
 * la garde reste en place apres toute modification du router.
 *
 * Ce spec couvre :
 *
 *  - 401 sans token sur toutes les methodes GET listees
 *  - 403 avec token user non-admin (role par defaut `user`)
 *  - 403 sur POST/PUT/DELETE (sans executer le body, seule la garde
 *    doit rejeter) — on utilise GET qui suffit puisque la garde est
 *    montee au niveau router.
 *  - Pas de data fuite : la reponse n'expose pas le contenu de la
 *    table (verifie implicitement par le code != 200)
 *
 * Aucune donnee metier n'est requise : la garde rejette avant que
 * Prisma ne soit sollicite.
 */

const PROTECTED_GET_PATHS = [
  "/admin/data/skills",
  "/admin/data/skills/some-id",
  "/admin/data/rosters",
  "/admin/data/rosters/some-id",
  "/admin/data/positions",
  "/admin/data/positions/some-id",
  "/admin/data/star-players",
  "/admin/data/star-players/some-id",
];

describe("E2E API — /admin/data/* auth gate (SEC-1 regression)", () => {
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
        "admin-data-user@e2e.test",
        "password-u",
        "RegularUser",
      );
      const res = await rawGet(path, token);
      expect(res.status).toBe(403);
    },
  );

  it("GET /admin/data/skills avec token admin -> 200 (garde laisse passer)", async () => {
    const { token } = await seedAndLogin(
      "admin-data-admin@e2e.test",
      "password-a",
      "AdminUser",
      { role: "admin" },
    );
    const res = await rawGet("/admin/data/skills", token);
    // On verifie uniquement que la garde laisse passer : le code
    // peut etre 200 (liste vide) ou 500 si Prisma a un souci avec
    // un model non seed. Le but du spec est l'auth, pas la data.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("le body d'une 401/403 ne fuite aucune donnee metier", async () => {
    const res = await rawGet("/admin/data/skills", null);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    // Seul un message d'erreur generique doit etre present, pas
    // de liste de skills ou de schema db.
    expect(body).toHaveProperty("error");
    expect(Object.keys(body)).toEqual(["error"]);
  });
});
