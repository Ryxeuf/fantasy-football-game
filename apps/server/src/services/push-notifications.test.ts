import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock web-push before importing the service.
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
    generateVAPIDKeys: vi.fn().mockReturnValue({
      publicKey: "test-public-key",
      privateKey: "test-private-key",
    }),
  },
}));

// Mock notification preferences — default: all allowed.
vi.mock("./notification-preferences", () => ({
  shouldSendNotification: vi.fn().mockResolvedValue(true),
  NotificationType: {
    Turn: "turn",
    MatchFound: "matchFound",
    FriendMatchStarted: "friendMatchStarted",
  },
}));

// Persistent store is now Prisma-backed. We back the mock with a tiny
// in-memory fake so the persistence assertions (dedup by endpoint,
// cleanup on 410/404) read naturally without a real database.
interface FakeRow {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}
const store: FakeRow[] = [];

vi.mock("../prisma", () => ({
  prisma: {
    pushSubscription: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { endpoint: string };
          create: FakeRow;
          update: Partial<FakeRow>;
        }) => {
          const existing = store.find((r) => r.endpoint === where.endpoint);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          store.push({ ...create });
          return create;
        },
      ),
      deleteMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId?: string; endpoint?: string };
        }) => {
          let count = 0;
          for (let i = store.length - 1; i >= 0; i--) {
            const r = store[i];
            if (
              (where.userId === undefined || r.userId === where.userId) &&
              (where.endpoint === undefined || r.endpoint === where.endpoint)
            ) {
              store.splice(i, 1);
              count++;
            }
          }
          return { count };
        },
      ),
      findMany: vi.fn(
        async ({ where }: { where: { userId: string } }) =>
          store
            .filter((r) => r.userId === where.userId)
            .map((r) => ({
              endpoint: r.endpoint,
              p256dh: r.p256dh,
              auth: r.auth,
            })),
      ),
    },
  },
}));

import {
  addSubscription,
  removeSubscription,
  getSubscriptions,
  sendPushToUser,
  getVapidPublicKey,
  sendTurnPush,
  sendMatchFoundPush,
  sendFriendMatchStartedPush,
  clearExpoSubscriptions,
} from "./push-notifications";

describe("push-notifications", () => {
  beforeEach(() => {
    store.length = 0;
    clearExpoSubscriptions();
    vi.clearAllMocks();
  });

  const userId = "user-123";
  const subscription = {
    endpoint: "https://push.example.com/sub/abc",
    keys: {
      p256dh: "test-p256dh-key",
      auth: "test-auth-key",
    },
  };

  describe("addSubscription", () => {
    it("persists a subscription for a user", async () => {
      await addSubscription(userId, subscription);
      const subs = await getSubscriptions(userId);
      expect(subs).toHaveLength(1);
      expect(subs[0]).toEqual(subscription);
    });

    it("allows multiple subscriptions per user (different devices)", async () => {
      const sub2 = {
        endpoint: "https://push.example.com/sub/def",
        keys: { p256dh: "key2", auth: "auth2" },
      };
      await addSubscription(userId, subscription);
      await addSubscription(userId, sub2);
      expect(await getSubscriptions(userId)).toHaveLength(2);
    });

    it("replaces subscription with same endpoint (upsert dedup)", async () => {
      await addSubscription(userId, subscription);
      const updated = {
        ...subscription,
        keys: { p256dh: "new-key", auth: "new-auth" },
      };
      await addSubscription(userId, updated);
      const subs = await getSubscriptions(userId);
      expect(subs).toHaveLength(1);
      expect(subs[0].keys.p256dh).toBe("new-key");
    });

    it("re-affecte un endpoint repris à un autre user", async () => {
      await addSubscription("user-A", subscription);
      await addSubscription("user-B", subscription);
      expect(await getSubscriptions("user-A")).toHaveLength(0);
      expect(await getSubscriptions("user-B")).toHaveLength(1);
    });
  });

  describe("removeSubscription", () => {
    it("removes a subscription by endpoint", async () => {
      await addSubscription(userId, subscription);
      const removed = await removeSubscription(userId, subscription.endpoint);
      expect(removed).toBe(true);
      expect(await getSubscriptions(userId)).toHaveLength(0);
    });

    it("returns false if subscription not found", async () => {
      const removed = await removeSubscription(userId, "https://unknown.endpoint");
      expect(removed).toBe(false);
    });
  });

  describe("getSubscriptions", () => {
    it("returns empty array for unknown user", async () => {
      expect(await getSubscriptions("unknown-user")).toEqual([]);
    });
  });

  describe("sendPushToUser", () => {
    it("sends push notification to all user subscriptions", async () => {
      const webpush = (await import("web-push")).default;
      await addSubscription(userId, subscription);

      const result = await sendPushToUser(userId, {
        title: "Nuffle Arena",
        body: "C'est votre tour !",
      });

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        subscription,
        JSON.stringify({
          title: "Nuffle Arena",
          body: "C'est votre tour !",
        }),
      );
    });

    it("returns { sent: 0 } if user has no subscriptions", async () => {
      const result = await sendPushToUser(userId, {
        title: "Test",
        body: "No subs",
      });
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("removes subscription on 410 Gone (expired)", async () => {
      const webpush = (await import("web-push")).default;
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce({
        statusCode: 410,
      });
      await addSubscription(userId, subscription);

      const result = await sendPushToUser(userId, {
        title: "Test",
        body: "Expired",
      });

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(await getSubscriptions(userId)).toHaveLength(0);
    });

    it("removes subscription on 404 Not Found", async () => {
      const webpush = (await import("web-push")).default;
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce({
        statusCode: 404,
      });
      await addSubscription(userId, subscription);

      const result = await sendPushToUser(userId, {
        title: "Test",
        body: "Not found",
      });

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(await getSubscriptions(userId)).toHaveLength(0);
    });

    it("keeps subscription on transient errors", async () => {
      const webpush = (await import("web-push")).default;
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce({
        statusCode: 503,
      });
      await addSubscription(userId, subscription);

      const result = await sendPushToUser(userId, {
        title: "Test",
        body: "Server error",
      });

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      // Subscription kept for retry
      expect(await getSubscriptions(userId)).toHaveLength(1);
    });
  });

  describe("getVapidPublicKey", () => {
    it("returns a string", () => {
      const key = getVapidPublicKey();
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe("sendTurnPush", () => {
    it("sends a 'your turn' notification with match URL", async () => {
      const webpush = (await import("web-push")).default;
      await addSubscription(userId, subscription);

      sendTurnPush(userId, "match-abc");

      // sendTurnPush is fire-and-forget; wait for microtasks.
      await new Promise((r) => setTimeout(r, 20));

      expect(webpush.sendNotification).toHaveBeenCalledWith(
        subscription,
        expect.stringContaining("votre tour"),
      );
      const payload = JSON.parse(
        vi.mocked(webpush.sendNotification).mock.calls[0][1] as string,
      );
      expect(payload.url).toBe("/play/match-abc");
      expect(payload.tag).toBe("turn-match-abc");
    });

    it("does not throw if user has no subscriptions", () => {
      expect(() => sendTurnPush("no-user", "match-xyz")).not.toThrow();
    });
  });

  describe("sendMatchFoundPush", () => {
    it("sends a 'match found' notification with correct payload", async () => {
      const webpush = (await import("web-push")).default;
      await addSubscription(userId, subscription);

      sendMatchFoundPush(userId, "match-def");

      await new Promise((r) => setTimeout(r, 20));

      const payload = JSON.parse(
        vi.mocked(webpush.sendNotification).mock.calls[0][1] as string,
      );
      expect(payload).toEqual({
        title: "Nuffle Arena",
        body: "Un adversaire a ete trouve !",
        icon: "/images/favicon-optimized.png",
        url: "/play/match-def",
        tag: "match-found-match-def",
        data: {
          kind: "matchFound",
          matchId: "match-def",
          url: "/play/match-def",
        },
      });
    });

    it("does not throw if user has no subscriptions", () => {
      expect(() => sendMatchFoundPush("no-user", "match-xyz")).not.toThrow();
    });
  });

  describe("sendFriendMatchStartedPush", () => {
    it("sends a 'friend match started' notification with correct payload", async () => {
      const webpush = (await import("web-push")).default;
      await addSubscription(userId, subscription);

      sendFriendMatchStartedPush(userId, "match-fms", "Alice", "Bob");

      await new Promise((r) => setTimeout(r, 20));

      const payload = JSON.parse(
        vi.mocked(webpush.sendNotification).mock.calls[0][1] as string,
      );
      expect(payload).toEqual({
        title: "Nuffle Arena",
        body: "Alice joue contre Bob",
        icon: "/images/favicon-optimized.png",
        url: "/play/match-fms",
        tag: "friend-match-match-fms",
        data: {
          kind: "friendMatchStarted",
          matchId: "match-fms",
          friendCoachName: "Alice",
          opponentCoachName: "Bob",
          url: "/play/match-fms",
        },
      });
    });

    it("skips when user preferences disallow friend-match-started", async () => {
      const webpush = (await import("web-push")).default;
      const { shouldSendNotification } = await import(
        "./notification-preferences"
      );
      vi.mocked(shouldSendNotification).mockResolvedValueOnce(false);
      await addSubscription(userId, subscription);

      sendFriendMatchStartedPush(userId, "match-blocked", "Alice", "Bob");

      await new Promise((r) => setTimeout(r, 30));

      expect(shouldSendNotification).toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it("does not throw if user has no subscriptions", () => {
      expect(() =>
        sendFriendMatchStartedPush("no-user", "match-xyz", "Alice", "Bob"),
      ).not.toThrow();
    });
  });

  describe("preference gating", () => {
    it("skips sendTurnPush when user preferences disallow turn notifications", async () => {
      const webpush = (await import("web-push")).default;
      const { shouldSendNotification } = await import(
        "./notification-preferences"
      );
      vi.mocked(shouldSendNotification).mockResolvedValueOnce(false);
      await addSubscription(userId, subscription);

      sendTurnPush(userId, "match-gated");

      await new Promise((r) => setTimeout(r, 30));

      expect(shouldSendNotification).toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it("skips sendMatchFoundPush when user preferences disallow match-found notifications", async () => {
      const webpush = (await import("web-push")).default;
      const { shouldSendNotification } = await import(
        "./notification-preferences"
      );
      vi.mocked(shouldSendNotification).mockResolvedValueOnce(false);
      await addSubscription(userId, subscription);

      sendMatchFoundPush(userId, "match-gated");

      await new Promise((r) => setTimeout(r, 30));

      expect(shouldSendNotification).toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it("sends push when preferences allow", async () => {
      const webpush = (await import("web-push")).default;
      const { shouldSendNotification } = await import(
        "./notification-preferences"
      );
      vi.mocked(shouldSendNotification).mockResolvedValueOnce(true);
      await addSubscription(userId, subscription);

      sendTurnPush(userId, "match-allowed");

      await new Promise((r) => setTimeout(r, 30));

      expect(shouldSendNotification).toHaveBeenCalled();
      expect(webpush.sendNotification).toHaveBeenCalled();
    });
  });
});
