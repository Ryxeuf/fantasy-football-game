/**
 * E2E API — notifications internes (`/notifications`).
 *
 * Sur le vrai serveur (SQLite in-memory) :
 *  - auth gates (401 sans token) et validation de query (400)
 *  - une invitation de ligue ciblant un coach crée SA notification (et
 *    pas celle du commissaire), avec le lien de la page d'acceptation
 *  - compteur de non lus, lecture unitaire idempotente, lecture globale
 *  - isolation : un utilisateur ne peut pas marquer la notification d'un autre
 *  - demande d'ami reçue / acceptée
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawGet, rawPost, resetDb, unwrap } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  meta: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface ListEnvelope {
  success: true;
  data: { notifications: NotificationRow[]; unreadCount: number };
  meta: { total: number; page: number; limit: number };
}

interface CountEnvelope {
  success: true;
  data: { count: number };
}

async function unreadCount(token: string): Promise<number> {
  return unwrap(await get<CountEnvelope>("/notifications/unread-count", token)).count;
}

async function listAll(token: string): Promise<ListEnvelope> {
  return get<ListEnvelope>("/notifications", token);
}

/** Ligue + une saison (inviter exige une saison ouverte aux inscriptions). */
async function createLeague(token: string, name: string): Promise<{ id: string }> {
  const league = unwrap(
    await post<{ success: true; data: { id: string } }>("/leagues", token, { name }),
  );
  await post(`/leagues/${league.id}/seasons`, token, { name: "Saison 1" });
  return league;
}

describe("E2E API — /notifications", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("auth gates & validation", () => {
    it("toutes les routes exigent un token", async () => {
      expect((await rawGet("/notifications", null)).status).toBe(401);
      expect((await rawGet("/notifications/unread-count", null)).status).toBe(401);
      expect((await rawPost("/notifications/read-all", null, {})).status).toBe(401);
      expect((await rawPost("/notifications/abc/read", null, {})).status).toBe(401);
    });

    it("query invalide -> 400", async () => {
      const { token } = await seedAndLogin("notif-v@e2e.test", "pwd", "V");
      expect((await rawGet("/notifications?limit=0", token)).status).toBe(400);
      expect((await rawGet("/notifications?limit=101", token)).status).toBe(400);
      expect((await rawGet("/notifications?unread=maybe", token)).status).toBe(400);
    });

    it("compte neuf : liste vide, compteur 0, meta de pagination", async () => {
      const { token } = await seedAndLogin("notif-empty@e2e.test", "pwd", "E");
      const list = await listAll(token);
      expect(list.data.notifications).toEqual([]);
      expect(list.data.unreadCount).toBe(0);
      expect(list.meta).toEqual({ total: 0, page: 0, limit: 50 });
      expect(await unreadCount(token)).toBe(0);
    });
  });

  describe("invitation de ligue → notification de l'invité", () => {
    it("crée, compte, lit (idempotent) et isole entre utilisateurs", async () => {
      const alice = await seedAndLogin("notif-alice@e2e.test", "pwd", "Alice");
      const bob = await seedAndLogin("notif-bob@e2e.test", "pwd", "Bob");
      const league = await createLeague(alice.token, "Ligue Notif");

      const invitation = unwrap(
        await post<{ success: true; data: { id: string; code: string } }>(
          `/leagues/${league.id}/invitations`,
          alice.token,
          { inviteeUserId: bob.userId },
        ),
      );
      expect(invitation.code).toBeTruthy();

      // Bob : 1 non lue, avec le lien de la page d'acceptation.
      expect(await unreadCount(bob.token)).toBe(1);
      const bobList = await listAll(bob.token);
      expect(bobList.data.unreadCount).toBe(1);
      expect(bobList.data.notifications).toHaveLength(1);
      const notif = bobList.data.notifications[0];
      expect(notif.kind).toBe("league.invitation");
      expect(notif.title).toBe("Invitation à une ligue");
      expect(notif.body).toContain("Ligue Notif");
      expect(notif.url).toBe(`/leagues/invitations/${invitation.code}`);
      expect(notif.meta).toEqual({ leagueId: league.id, code: invitation.code });
      expect(notif.readAt).toBeNull();

      // Alice (commissaire) n'a rien reçu.
      expect(await unreadCount(alice.token)).toBe(0);

      // Alice ne peut pas marquer la notification de Bob : 404, inchangée.
      const foreign = await rawPost(`/notifications/${notif.id}/read`, alice.token, {});
      expect(foreign.status).toBe(404);
      expect(await unreadCount(bob.token)).toBe(1);

      // Bob la lit : changed=true, puis changed=false (idempotent).
      const first = unwrap(
        await post<{ success: true; data: { read: boolean; changed: boolean } }>(
          `/notifications/${notif.id}/read`,
          bob.token,
          {},
        ),
      );
      expect(first).toEqual({ read: true, changed: true });
      const second = unwrap(
        await post<{ success: true; data: { read: boolean; changed: boolean } }>(
          `/notifications/${notif.id}/read`,
          bob.token,
          {},
        ),
      );
      expect(second).toEqual({ read: true, changed: false });
      expect(await unreadCount(bob.token)).toBe(0);
      const afterRead = await listAll(bob.token);
      expect(afterRead.data.notifications[0].readAt).not.toBeNull();

      // Notification inconnue -> 404.
      expect((await rawPost("/notifications/nope/read", bob.token, {})).status).toBe(404);
    });

    it("read-all marque tout lu et le filtre unread=true ne renvoie plus rien", async () => {
      const alice = await seedAndLogin("notif-alice2@e2e.test", "pwd", "Alice");
      const bob = await seedAndLogin("notif-bob2@e2e.test", "pwd", "Bob");
      const l1 = await createLeague(alice.token, "Ligue Un");
      const l2 = await createLeague(alice.token, "Ligue Deux");
      await post(`/leagues/${l1.id}/invitations`, alice.token, { inviteeUserId: bob.userId });
      await post(`/leagues/${l2.id}/invitations`, alice.token, { inviteeUserId: bob.userId });

      expect(await unreadCount(bob.token)).toBe(2);
      const unreadOnly = await get<ListEnvelope>("/notifications?unread=true&limit=1", bob.token);
      expect(unreadOnly.data.notifications).toHaveLength(1);
      expect(unreadOnly.meta.total).toBe(2);
      expect(unreadOnly.meta.limit).toBe(1);

      const readAll = unwrap(
        await post<{ success: true; data: { updated: number } }>(
          "/notifications/read-all",
          bob.token,
          {},
        ),
      );
      expect(readAll.updated).toBe(2);
      expect(await unreadCount(bob.token)).toBe(0);
      const again = unwrap(
        await post<{ success: true; data: { updated: number } }>(
          "/notifications/read-all",
          bob.token,
          {},
        ),
      );
      expect(again.updated).toBe(0);

      const stillListed = await listAll(bob.token);
      expect(stillListed.data.notifications).toHaveLength(2);
      const onlyUnread = await get<ListEnvelope>("/notifications?unread=1", bob.token);
      expect(onlyUnread.data.notifications).toEqual([]);
    });
  });

  describe("amis", () => {
    it("demande reçue puis acceptée : chacun est notifié une fois", async () => {
      const alice = await seedAndLogin("notif-fa@e2e.test", "pwd", "Alice");
      const bob = await seedAndLogin("notif-fb@e2e.test", "pwd", "Bob");

      const sent = await post<{ success: true; data: { id: string } }>(
        "/friends",
        alice.token,
        { receiverId: bob.userId },
      );

      const bobList = await listAll(bob.token);
      expect(bobList.data.notifications.map((n) => n.kind)).toEqual(["friend.request"]);
      expect(bobList.data.notifications[0].body).toBe("Alice souhaite t'ajouter en ami");
      expect(bobList.data.notifications[0].url).toBeNull();
      expect(await unreadCount(alice.token)).toBe(0);

      await post(`/friends/${sent.data.id}/respond`, bob.token, { action: "accept" });

      const aliceList = await listAll(alice.token);
      expect(aliceList.data.notifications.map((n) => n.kind)).toEqual(["friend.accepted"]);
      expect(aliceList.data.notifications[0].body).toBe("Bob a accepté ta demande d'ami");
      // Bob n'a pas de seconde notification pour sa propre acceptation.
      expect(await unreadCount(bob.token)).toBe(1);
    });
  });
});
