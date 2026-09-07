/**
 * Tests du service `in-app-notifications` (notifications internes).
 *
 * Prisma mocké. Vérifie :
 *  - création : troncature défensive, `meta` omis quand absent, JAMAIS de
 *    throw (échec journalisé → null / 0)
 *  - fan-out dédoublonné
 *  - liste : bornes limit/offset, filtre non lus, compteurs
 *  - lecture unitaire : outcomes read / already_read / not_found, WHERE
 *    porté par `userId`
 *  - lecture globale idempotente
 *  - parse tolérant de `meta` (objet PG / chaîne sqlite / invalide)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  createInAppNotification,
  createInAppNotifications,
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  parseNotificationMeta,
  serializeNotification,
  MAX_TITLE_LENGTH,
  MAX_BODY_LENGTH,
  MAX_LIST_LIMIT,
} from "./in-app-notifications";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (prisma as any).notification as Record<string, ReturnType<typeof vi.fn>>;
const logError = serverLog.error as ReturnType<typeof vi.fn>;

const NOW = new Date("2026-09-07T10:00:00.000Z");

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "n-1",
    userId: "u-1",
    kind: "league.invitation",
    title: "Invitation à une ligue",
    body: "Tu es invité",
    url: "/leagues/invitations/abc",
    meta: { leagueId: "lg-1" },
    readAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe("in-app-notifications — création", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("persiste la notification et renvoie la vue sérialisée", async () => {
    db.create.mockResolvedValue(row());
    const view = await createInAppNotification({
      userId: "u-1",
      kind: "league.invitation",
      title: "Invitation à une ligue",
      body: "Tu es invité",
      url: "/leagues/invitations/abc",
      meta: { leagueId: "lg-1" },
    });
    expect(db.create).toHaveBeenCalledTimes(1);
    const data = db.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: "u-1",
      kind: "league.invitation",
      title: "Invitation à une ligue",
      url: "/leagues/invitations/abc",
      meta: { leagueId: "lg-1" },
    });
    expect(view).toEqual({
      id: "n-1",
      kind: "league.invitation",
      title: "Invitation à une ligue",
      body: "Tu es invité",
      url: "/leagues/invitations/abc",
      meta: { leagueId: "lg-1" },
      readAt: null,
      createdAt: NOW.toISOString(),
    });
  });

  it("omet `meta` (undefined) et met `url` à null quand absents", async () => {
    db.create.mockResolvedValue(row({ url: null, meta: null }));
    await createInAppNotification({
      userId: "u-1",
      kind: "friend.request",
      title: "Demande d'ami",
      body: "Bob souhaite t'ajouter",
    });
    const data = db.create.mock.calls[0][0].data;
    expect(data.url).toBeNull();
    expect("meta" in data && data.meta === undefined).toBe(true);
  });

  it("tronque un titre et un corps hors gabarit au lieu de les refuser", async () => {
    db.create.mockResolvedValue(row());
    await createInAppNotification({
      userId: "u-1",
      kind: "friend.request",
      title: "x".repeat(MAX_TITLE_LENGTH + 50),
      body: "y".repeat(MAX_BODY_LENGTH + 50),
    });
    const data = db.create.mock.calls[0][0].data;
    expect(data.title.length).toBe(MAX_TITLE_LENGTH);
    expect(data.body.length).toBe(MAX_BODY_LENGTH);
    expect(data.title.endsWith("…")).toBe(true);
  });

  it("ne throw JAMAIS : un échec Prisma est journalisé et renvoie null", async () => {
    db.create.mockRejectedValue(new Error("db down"));
    const view = await createInAppNotification({
      userId: "u-1",
      kind: "friend.request",
      title: "t",
      body: "b",
    });
    expect(view).toBeNull();
    expect(logError).toHaveBeenCalledTimes(1);
    expect(String(logError.mock.calls[0][0])).toContain("u-1");
  });

  it("fan-out : dédoublonne les destinataires, ignore les ids vides", async () => {
    db.createMany.mockResolvedValue({ count: 2 });
    const count = await createInAppNotifications(["u-1", "u-2", "u-1", ""], {
      kind: "league.archived",
      title: "Ligue archivée",
      body: "La ligue « X » a été archivée",
      url: "/leagues/lg-1",
    });
    expect(count).toBe(2);
    const data = db.createMany.mock.calls[0][0].data;
    expect(data.map((d: { userId: string }) => d.userId)).toEqual(["u-1", "u-2"]);
    expect(data[0].kind).toBe("league.archived");
  });

  it("fan-out : aucun destinataire → aucune écriture", async () => {
    const count = await createInAppNotifications([], {
      kind: "league.archived",
      title: "t",
      body: "b",
    });
    expect(count).toBe(0);
    expect(db.createMany).not.toHaveBeenCalled();
  });

  it("fan-out : un échec Prisma renvoie 0 sans throw", async () => {
    db.createMany.mockRejectedValue(new Error("db down"));
    const count = await createInAppNotifications(["u-1"], {
      kind: "cup.deleted",
      title: "t",
      body: "b",
    });
    expect(count).toBe(0);
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

describe("in-app-notifications — lecture", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("liste : plus récentes d'abord, limit/offset par défaut, compteurs", async () => {
    db.findMany.mockResolvedValue([row(), row({ id: "n-2", readAt: NOW })]);
    db.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    const result = await listNotifications("u-1");
    expect(db.findMany).toHaveBeenCalledWith({
      where: { userId: "u-1" },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
    });
    expect(result.total).toBe(2);
    expect(result.unreadCount).toBe(1);
    expect(result.items.map((i) => i.id)).toEqual(["n-1", "n-2"]);
    expect(result.items[1].readAt).toBe(NOW.toISOString());
  });

  it("liste : borne limit à MAX_LIST_LIMIT, offset négatif → 0, filtre non lus", async () => {
    db.findMany.mockResolvedValue([]);
    db.count.mockResolvedValue(0);
    const result = await listNotifications("u-1", {
      limit: 10_000,
      offset: -5,
      unreadOnly: true,
    });
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u-1", readAt: null },
        take: MAX_LIST_LIMIT,
        skip: 0,
      }),
    );
    expect(result.limit).toBe(MAX_LIST_LIMIT);
    expect(result.offset).toBe(0);
  });

  it("compteur de non lus filtré par userId + readAt null", async () => {
    db.count.mockResolvedValue(3);
    await expect(countUnreadNotifications("u-1")).resolves.toBe(3);
    expect(db.count).toHaveBeenCalledWith({
      where: { userId: "u-1", readAt: null },
    });
  });

  it("markNotificationRead : `read` quand une ligne non lue de CE user est mise à jour", async () => {
    db.updateMany.mockResolvedValue({ count: 1 });
    await expect(markNotificationRead("u-1", "n-1")).resolves.toBe("read");
    const where = db.updateMany.mock.calls[0][0].where;
    expect(where).toEqual({ id: "n-1", userId: "u-1", readAt: null });
    expect(db.findFirst).not.toHaveBeenCalled();
  });

  it("markNotificationRead : `already_read` sans nouvelle écriture", async () => {
    db.updateMany.mockResolvedValue({ count: 0 });
    db.findFirst.mockResolvedValue({ id: "n-1" });
    await expect(markNotificationRead("u-1", "n-1")).resolves.toBe("already_read");
    expect(db.findFirst).toHaveBeenCalledWith({
      where: { id: "n-1", userId: "u-1" },
      select: { id: true },
    });
  });

  it("markNotificationRead : la notification d'un AUTRE user est `not_found`", async () => {
    db.updateMany.mockResolvedValue({ count: 0 });
    db.findFirst.mockResolvedValue(null);
    await expect(markNotificationRead("u-2", "n-1")).resolves.toBe("not_found");
  });

  it("markAllNotificationsRead : renvoie le nombre de lignes passées lues", async () => {
    db.updateMany.mockResolvedValue({ count: 4 });
    await expect(markAllNotificationsRead("u-1")).resolves.toBe(4);
    expect(db.updateMany.mock.calls[0][0].where).toEqual({
      userId: "u-1",
      readAt: null,
    });
  });
});

describe("in-app-notifications — parse tolérant de meta", () => {
  it("objet natif (PG) conservé tel quel", () => {
    expect(parseNotificationMeta({ a: 1 })).toEqual({ a: 1 });
  });
  it("chaîne sérialisée (miroir sqlite) parsée", () => {
    expect(parseNotificationMeta('{"leagueId":"lg-1"}')).toEqual({
      leagueId: "lg-1",
    });
  });
  it("null / undefined / chaîne invalide / tableau → null", () => {
    expect(parseNotificationMeta(null)).toBeNull();
    expect(parseNotificationMeta(undefined)).toBeNull();
    expect(parseNotificationMeta("{oops")).toBeNull();
    expect(parseNotificationMeta([1, 2])).toBeNull();
    expect(parseNotificationMeta("[1]")).toBeNull();
  });
  it("serializeNotification : dates ISO, url null par défaut", () => {
    const view = serializeNotification({
      ...row({ url: null, meta: '{"x":1}' }),
      readAt: NOW,
    });
    expect(view.url).toBeNull();
    expect(view.meta).toEqual({ x: 1 });
    expect(view.readAt).toBe(NOW.toISOString());
    expect(view.createdAt).toBe(NOW.toISOString());
  });
});
