/**
 * E2E API — archivage / suppression d'une compétition par son commissaire.
 *
 *  - `POST /leagues/:id/archive`, `DELETE /leagues/:id`
 *  - `POST /cup/:id/archive`,     `DELETE /cup/:id`
 *
 * Vérifie sur le vrai serveur : auth gates, 403 pour un coach tiers, 404
 * pour un id inconnu, archivage idempotent et lu par les listes d'archives,
 * suppression en cascade (saison 404 ensuite), admin autorisé, et les
 * notifications internes des coachs inscrits (jamais l'auteur).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  get,
  post,
  rawGet,
  rawPost,
  rawDelete,
  resetDb,
  unwrap,
} from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface League {
  id: string;
  name: string;
  status: string;
}

interface ArchiveResult {
  id: string;
  kind: string;
  status: string;
  previousStatus: string;
  changed: boolean;
  notified: number;
}

interface NotificationRow {
  kind: string;
  body: string;
  url: string | null;
}

async function notificationsOf(token: string): Promise<NotificationRow[]> {
  const res = await get<{ success: true; data: { notifications: NotificationRow[] } }>(
    "/notifications",
    token,
  );
  return res.data.notifications;
}

/** Ligue de A avec une saison où B a inscrit une équipe. */
async function leagueWithParticipant(
  a: { token: string },
  b: { token: string; userId: string },
  name: string,
): Promise<{ leagueId: string; seasonId: string }> {
  const league = unwrap(
    await post<{ success: true; data: League }>("/leagues", a.token, { name }),
  );
  const season = unwrap(
    await post<{ success: true; data: { id: string } }>(
      `/leagues/${league.id}/seasons`,
      a.token,
      { name: "Saison 1" },
    ),
  );
  const team = await createTeam(b.userId, `${name} — Bob`, "skaven");
  const join = await rawPost(`/leagues/seasons/${season.id}/join`, b.token, {
    teamId: team.teamId,
  });
  expect(join.status).toBe(201);
  return { leagueId: league.id, seasonId: season.id };
}

describe("E2E API — cycle de vie des compétitions", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("auth gates", () => {
    it("archive / delete sans token -> 401 (ligue et coupe)", async () => {
      expect((await rawPost("/leagues/x/archive", null, {})).status).toBe(401);
      expect((await rawDelete("/leagues/x", null)).status).toBe(401);
      expect((await rawPost("/cup/x/archive", null, {})).status).toBe(401);
      expect((await rawDelete("/cup/x", null)).status).toBe(401);
    });
  });

  describe("ligue", () => {
    it("archivage : commissaire seul (ou admin), idempotent, participants notifiés", async () => {
      const alice = await seedAndLogin("lc-alice@e2e.test", "pwd", "Alice");
      const bob = await seedAndLogin("lc-bob@e2e.test", "pwd", "Bob");
      const { leagueId } = await leagueWithParticipant(alice, bob, "Ligue Archive");

      // Coach tiers (même inscrit) : 403. Inconnu : 404.
      expect((await rawPost(`/leagues/${leagueId}/archive`, bob.token, {})).status).toBe(403);
      expect((await rawPost("/leagues/nope/archive", alice.token, {})).status).toBe(404);

      const archived = unwrap(
        await post<{ success: true; data: ArchiveResult }>(
          `/leagues/${leagueId}/archive`,
          alice.token,
          {},
        ),
      );
      expect(archived).toMatchObject({
        id: leagueId,
        kind: "league",
        status: "archived",
        changed: true,
        notified: 1,
      });

      // Lu par la fiche et par la liste d'archives.
      const detail = unwrap(
        await get<{ success: true; data: { league: League } }>(
          `/leagues/${leagueId}`,
          alice.token,
        ),
      );
      expect(detail.league.status).toBe("archived");
      const archives = unwrap(
        await get<{ success: true; data: { leagues: League[] } }>(
          "/leagues?status=archived",
          alice.token,
        ),
      );
      expect(archives.leagues.map((l) => l.id)).toContain(leagueId);

      // Idempotent.
      const again = unwrap(
        await post<{ success: true; data: ArchiveResult }>(
          `/leagues/${leagueId}/archive`,
          alice.token,
          {},
        ),
      );
      expect(again.changed).toBe(false);
      expect(again.notified).toBe(0);

      // Bob (inscrit) est notifié une seule fois ; Alice (auteur) jamais.
      const bobNotifs = await notificationsOf(bob.token);
      expect(bobNotifs.filter((n) => n.kind === "league.archived")).toHaveLength(1);
      expect(bobNotifs[0].url).toBe(`/leagues/${leagueId}`);
      expect(bobNotifs[0].body).toContain("Ligue Archive");
      expect(await notificationsOf(alice.token)).toEqual([]);
    });

    it("un admin peut archiver une ligue qu'il n'a pas créée", async () => {
      const alice = await seedAndLogin("lc-alice-adm@e2e.test", "pwd", "Alice");
      const admin = await seedAndLogin("lc-admin@e2e.test", "pwd", "Admin", {
        role: "admin",
      });
      const league = unwrap(
        await post<{ success: true; data: League }>("/leagues", alice.token, {
          name: "Ligue Admin",
        }),
      );
      const res = await rawPost(`/leagues/${league.id}/archive`, admin.token, {});
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: ArchiveResult };
      expect(body.data.status).toBe("archived");
    });

    it("suppression : 403 pour un tiers, cascade, participants notifiés sans lien", async () => {
      const alice = await seedAndLogin("lc-alice-del@e2e.test", "pwd", "Alice");
      const bob = await seedAndLogin("lc-bob-del@e2e.test", "pwd", "Bob");
      const { leagueId, seasonId } = await leagueWithParticipant(alice, bob, "Ligue Delete");

      expect((await rawDelete(`/leagues/${leagueId}`, bob.token)).status).toBe(403);
      expect((await rawDelete("/leagues/nope", alice.token)).status).toBe(404);

      const res = await rawDelete(`/leagues/${leagueId}`, alice.token);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { deleted: boolean; name: string; notified: number };
      };
      expect(body.data).toMatchObject({ deleted: true, name: "Ligue Delete", notified: 1 });

      expect((await rawGet(`/leagues/${leagueId}`, alice.token)).status).toBe(404);
      expect((await rawGet(`/leagues/seasons/${seasonId}`, alice.token)).status).toBe(404);

      const bobNotifs = await notificationsOf(bob.token);
      expect(bobNotifs.map((n) => n.kind)).toEqual(["league.deleted"]);
      expect(bobNotifs[0].url).toBeNull();
      expect(bobNotifs[0].body).toContain("Ligue Delete");

      // L'équipe de Bob survit à la suppression.
      const teams = unwrap(
        await get<{ success: true; data: { teams: Array<{ name: string }> } }>(
          "/team/mine",
          bob.token,
        ),
      );
      expect(teams.teams.map((t) => t.name)).toContain("Ligue Delete — Bob");
    });
  });

  describe("coupe", () => {
    async function cupWithParticipant(
      a: { token: string },
      b: { token: string; userId: string },
      name: string,
    ): Promise<string> {
      const created = await post<{ cup: { id: string } }>("/cup", a.token, {
        name,
        ruleset: "season_3",
      });
      const team = await createTeam(b.userId, `${name} — Bob`, "skaven");
      await post(`/cup/${created.cup.id}/register`, b.token, { teamId: team.teamId });
      return created.cup.id;
    }

    it("archivage depuis « ouverte » par le créateur, coach tiers refusé, inscrits notifiés", async () => {
      const alice = await seedAndLogin("cc-alice@e2e.test", "pwd", "Alice");
      const bob = await seedAndLogin("cc-bob@e2e.test", "pwd", "Bob");
      const cupId = await cupWithParticipant(alice, bob, "Coupe Archive");

      expect((await rawPost(`/cup/${cupId}/archive`, bob.token, {})).status).toBe(403);

      const archived = unwrap(
        await post<{ success: true; data: ArchiveResult }>(
          `/cup/${cupId}/archive`,
          alice.token,
          {},
        ),
      );
      expect(archived).toMatchObject({
        kind: "cup",
        status: "archivee",
        previousStatus: "ouverte",
        changed: true,
        notified: 1,
      });
      const detail = await get<{ cup: { status: string } }>(`/cup/${cupId}`, alice.token);
      expect(detail.cup.status).toBe("archivee");

      const bobNotifs = await notificationsOf(bob.token);
      expect(bobNotifs.map((n) => n.kind)).toEqual(["cup.archived"]);
      expect(bobNotifs[0].url).toBe(`/cups/${cupId}`);
    });

    it("suppression par le créateur : 404 ensuite, inscrits notifiés", async () => {
      const alice = await seedAndLogin("cc-alice-del@e2e.test", "pwd", "Alice");
      const bob = await seedAndLogin("cc-bob-del@e2e.test", "pwd", "Bob");
      const cupId = await cupWithParticipant(alice, bob, "Coupe Delete");

      expect((await rawDelete(`/cup/${cupId}`, bob.token)).status).toBe(403);
      const res = await rawDelete(`/cup/${cupId}`, alice.token);
      expect(res.status).toBe(200);
      expect((await rawGet(`/cup/${cupId}`, alice.token)).status).toBe(404);

      const bobNotifs = await notificationsOf(bob.token);
      expect(bobNotifs.map((n) => n.kind)).toEqual(["cup.deleted"]);
      expect(bobNotifs[0].url).toBeNull();
      expect(bobNotifs[0].body).toContain("Coupe Delete");
    });
  });
});
