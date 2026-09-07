/**
 * Tests des handlers `/notifications` (service mocké, req/res faits main —
 * même pattern que `league-invitation.test.ts`).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../services/in-app-notifications", () => ({
  listNotifications: vi.fn(),
  countUnreadNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import {
  handleListNotifications,
  handleUnreadCount,
  handleMarkAllRead,
  handleMarkRead,
} from "./notifications";
import {
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/in-app-notifications";
import { listNotificationsQuerySchema } from "../schemas/notifications.schemas";

const svc = {
  list: listNotifications as ReturnType<typeof vi.fn>,
  count: countUnreadNotifications as ReturnType<typeof vi.fn>,
  markRead: markNotificationRead as ReturnType<typeof vi.fn>,
  markAll: markAllNotificationsRead as ReturnType<typeof vi.fn>,
};

function createRes() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = {};
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((p: unknown) => {
    res.payload = p;
    return res;
  });
  return res;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createReq(overrides: any = {}): any {
  return {
    body: {},
    params: {},
    query: {},
    user: { id: "user-1", roles: ["user"] },
    ...overrides,
  };
}

describe("routes/notifications", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET / : 401 sans utilisateur", async () => {
    const res = createRes();
    await handleListNotifications(createReq({ user: undefined }), res);
    expect(res.statusCode).toBe(401);
    expect(svc.list).not.toHaveBeenCalled();
  });

  it("GET / : enveloppe { notifications, unreadCount } + meta de pagination", async () => {
    svc.list.mockResolvedValue({
      items: [{ id: "n-1" }],
      total: 7,
      unreadCount: 2,
      limit: 5,
      offset: 10,
    });
    const res = createRes();
    await handleListNotifications(
      createReq({ query: { limit: 5, offset: 10, unread: true } }),
      res,
    );
    expect(svc.list).toHaveBeenCalledWith("user-1", {
      limit: 5,
      offset: 10,
      unreadOnly: true,
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      success: true,
      data: { notifications: [{ id: "n-1" }], unreadCount: 2 },
      meta: { total: 7, page: 2, limit: 5 },
    });
  });

  it("GET / : 500 propre si le service échoue", async () => {
    svc.list.mockRejectedValue(new Error("boom"));
    const res = createRes();
    await handleListNotifications(createReq(), res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ success: false, error: "Erreur serveur" });
  });

  it("GET /unread-count : { count }", async () => {
    svc.count.mockResolvedValue(3);
    const res = createRes();
    await handleUnreadCount(createReq(), res);
    expect(svc.count).toHaveBeenCalledWith("user-1");
    expect(res.payload).toEqual({ success: true, data: { count: 3 } });
  });

  it("POST /read-all : { updated }", async () => {
    svc.markAll.mockResolvedValue(4);
    const res = createRes();
    await handleMarkAllRead(createReq(), res);
    expect(svc.markAll).toHaveBeenCalledWith("user-1");
    expect(res.payload).toEqual({ success: true, data: { updated: 4 } });
  });

  it("POST /:id/read : 200 changed=true quand passée lue", async () => {
    svc.markRead.mockResolvedValue("read");
    const res = createRes();
    await handleMarkRead(createReq({ params: { id: "n-1" } }), res);
    expect(svc.markRead).toHaveBeenCalledWith("user-1", "n-1");
    expect(res.payload).toEqual({
      success: true,
      data: { read: true, changed: true },
    });
  });

  it("POST /:id/read : 200 changed=false quand déjà lue (idempotent)", async () => {
    svc.markRead.mockResolvedValue("already_read");
    const res = createRes();
    await handleMarkRead(createReq({ params: { id: "n-1" } }), res);
    expect(res.payload).toEqual({
      success: true,
      data: { read: true, changed: false },
    });
  });

  it("POST /:id/read : 404 quand inconnue ou appartenant à un autre user", async () => {
    svc.markRead.mockResolvedValue("not_found");
    const res = createRes();
    await handleMarkRead(createReq({ params: { id: "n-other" } }), res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toEqual({
      success: false,
      error: "Notification introuvable",
    });
  });

  describe("listNotificationsQuerySchema", () => {
    it("coerce limit/offset et parse `unread`", () => {
      const parsed = listNotificationsQuerySchema.parse({
        limit: "20",
        offset: "40",
        unread: "1",
      });
      expect(parsed).toEqual({ limit: 20, offset: 40, unread: true });
      expect(listNotificationsQuerySchema.parse({ unread: "false" }).unread).toBe(false);
    });
    it("refuse limit hors bornes", () => {
      expect(listNotificationsQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
      expect(listNotificationsQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
      expect(listNotificationsQuerySchema.safeParse({ unread: "maybe" }).success).toBe(false);
    });
  });
});
