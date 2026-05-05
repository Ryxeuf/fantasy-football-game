/**
 * L2.C.6 — E2E API : routes admin pour la gestion des ligues
 * (Sprint Ligues v2 PR10).
 *
 * Couvre :
 *  - Auth gates (401 sans token, 403 user non-admin).
 *  - GET /admin/leagues : structure de reponse, filtres status,
 *    pagination, seasonsCount.
 *  - PATCH /admin/leagues/:id/status : force le status.
 *  - POST /admin/leagues/:id/archive : raccourci status=archived.
 *  - PATCH /admin/leagues/:id/creator : transfere le creator.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  get,
  post,
  rawGet,
  rawPost,
  rawPatch,
  resetDb,
  unwrap,
} from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

interface AdminLeagueRow {
  id: string;
  name: string;
  status: string;
  creatorId: string;
  seasonsCount: number;
}

interface AdminLeaguesListResponse {
  data: { leagues: AdminLeagueRow[] };
  meta: { total: number; limit: number; page: number };
}

interface CreatedLeague {
  id: string;
  status: string;
}

describe("E2E API — /admin/leagues", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("auth gates", () => {
    it("GET /admin/leagues sans token -> 401", async () => {
      const res = await rawGet("/admin/leagues", null);
      expect(res.status).toBe(401);
    });

    it("GET /admin/leagues avec user non-admin -> 403", async () => {
      const { token } = await seedAndLogin(
        "admin-leagues-user@e2e.test",
        "pwd",
        "Coach",
      );
      const res = await rawGet("/admin/leagues", token);
      expect(res.status).toBe(403);
    });

    it("PATCH /admin/leagues/:id/status sans token -> 401", async () => {
      const res = await rawPatch("/admin/leagues/abc/status", null, {
        status: "archived",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("with admin token", () => {
    it("GET /admin/leagues retourne une enveloppe paginated avec leagues + meta", async () => {
      const admin = await seedAndLogin(
        "admin-leagues-admin@e2e.test",
        "pwd",
        "AdminCoach",
        { role: "admin" },
      );
      // Seed 2 ligues a partir de l'admin (le test admin user est
      // creator).
      await post("/leagues", admin.token, { name: "Open Cup" });
      await post("/leagues", admin.token, {
        name: "Closed Cup",
        isPublic: false,
      });

      const res = await rawGet("/admin/leagues", admin.token);
      expect(res.status).toBe(200);
      const json = (await res.json()) as AdminLeaguesListResponse;
      expect(json.data.leagues.length).toBeGreaterThanOrEqual(2);
      expect(json.meta.limit).toBe(50);
      const names = json.data.leagues.map((l) => l.name);
      expect(names).toContain("Open Cup");
      expect(names).toContain("Closed Cup");
      // seasonsCount expose
      const target = json.data.leagues.find((l) => l.name === "Open Cup");
      expect(target?.seasonsCount).toBe(0);
    });

    it("GET /admin/leagues filtre par status", async () => {
      const admin = await seedAndLogin(
        "admin-leagues-filter@e2e.test",
        "pwd",
        "Admin",
        { role: "admin" },
      );
      await post("/leagues", admin.token, { name: "Active League" });

      // Verifie default = draft.
      const draftRes = await rawGet(
        "/admin/leagues?status=draft",
        admin.token,
      );
      const draftJson = (await draftRes.json()) as AdminLeaguesListResponse;
      expect(
        draftJson.data.leagues.every((l) => l.status === "draft"),
      ).toBe(true);

      // Filter on a status with no league should return empty.
      const completedRes = await rawGet(
        "/admin/leagues?status=completed",
        admin.token,
      );
      const completedJson =
        (await completedRes.json()) as AdminLeaguesListResponse;
      expect(completedJson.data.leagues).toHaveLength(0);
    });

    it("PATCH /admin/leagues/:id/status passe une ligue de draft a archived", async () => {
      const admin = await seedAndLogin(
        "admin-leagues-status@e2e.test",
        "pwd",
        "Admin",
        { role: "admin" },
      );
      const league = unwrap(
        await post<{ success: true; data: CreatedLeague }>(
          "/leagues",
          admin.token,
          { name: "ToArchive" },
        ),
      );
      expect(league.status).toBe("draft");

      const res = await rawPatch(
        `/admin/leagues/${league.id}/status`,
        admin.token,
        { status: "archived" },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { changed: boolean; status: string; previousStatus?: string };
      };
      expect(json.data.changed).toBe(true);
      expect(json.data.status).toBe("archived");
      expect(json.data.previousStatus).toBe("draft");

      // Idempotence : 2e appel renvoie changed=false.
      const res2 = await rawPatch(
        `/admin/leagues/${league.id}/status`,
        admin.token,
        { status: "archived" },
      );
      const json2 = (await res2.json()) as { data: { changed: boolean } };
      expect(json2.data.changed).toBe(false);
    });

    it("POST /admin/leagues/:id/archive est un raccourci", async () => {
      const admin = await seedAndLogin(
        "admin-leagues-arch@e2e.test",
        "pwd",
        "Admin",
        { role: "admin" },
      );
      const league = unwrap(
        await post<{ success: true; data: CreatedLeague }>(
          "/leagues",
          admin.token,
          { name: "QuickArchive" },
        ),
      );
      const res = await rawPost(
        `/admin/leagues/${league.id}/archive`,
        admin.token,
        {},
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { status: string; changed: boolean };
      };
      expect(json.data.status).toBe("archived");
      expect(json.data.changed).toBe(true);
    });

    it("PATCH /admin/leagues/:id/creator transfere a un autre user", async () => {
      const admin = await seedAndLogin(
        "admin-leagues-tx@e2e.test",
        "pwd",
        "Admin",
        { role: "admin" },
      );
      const target = await seedAndLogin(
        "admin-leagues-target@e2e.test",
        "pwd",
        "Target",
      );
      const league = unwrap(
        await post<{ success: true; data: CreatedLeague & { creatorId: string }
        }>("/leagues", admin.token, { name: "ToTransfer" }),
      );

      const res = await rawPatch(
        `/admin/leagues/${league.id}/creator`,
        admin.token,
        { userId: target.userId },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { creatorId: string; changed: boolean; previousCreatorId?: string };
      };
      expect(json.data.changed).toBe(true);
      expect(json.data.creatorId).toBe(target.userId);
    });

    it("PATCH /admin/leagues/:id/creator -> 404 quand userId cible inexistant", async () => {
      const admin = await seedAndLogin(
        "admin-leagues-tx2@e2e.test",
        "pwd",
        "Admin",
        { role: "admin" },
      );
      const league = unwrap(
        await post<{ success: true; data: CreatedLeague }>(
          "/leagues",
          admin.token,
          { name: "Solo" },
        ),
      );
      const res = await rawPatch(
        `/admin/leagues/${league.id}/creator`,
        admin.token,
        { userId: "user-does-not-exist" },
      );
      expect(res.status).toBe(404);
    });

    it("PATCH /admin/leagues/:id/status sur ligue inconnue -> 404", async () => {
      const admin = await seedAndLogin(
        "admin-leagues-404@e2e.test",
        "pwd",
        "Admin",
        { role: "admin" },
      );
      const res = await rawPatch(
        `/admin/leagues/missing-id/status`,
        admin.token,
        { status: "archived" },
      );
      expect(res.status).toBe(404);
    });
  });
});
