import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock web-push before importing
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

// Mock notification preferences — default: all allowed
vi.mock("./notification-preferences", () => ({
  shouldSendNotification: vi.fn().mockResolvedValue(true),
  NotificationType: { Turn: "turn", MatchFound: "matchFound" },
}));

import {
  addSubscription,
  removeSubscription,
  getSubscriptions,
  sendPushToUser,
  clearSubscriptions,
  getVapidPublicKey,
  sendTurnPush,
  sendMatchFoundPush,
} from "./push-notifications";

describe("push-notifications", () => {
  beforeEach(() => {
    clearSubscriptions();
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
    it("stores a subscription for a user", () => {
      addSubscription(userId, subscription);
      expect(getSubscriptions(userId)).toHaveLength(1);
      expect(getSubscriptions(userId)[0]).toEqual(subscription);
    });

    it("allows multiple subscriptions per user (different devices)", () => {
      const sub2 = {
        endpoint: "https://push.example.com/sub/def",
        keys: { p256dh: "key2", auth: "auth2" },
      };
      addSubscription(userId, subscription);
      addSubscription(userId, sub2);
      expect(getSubscriptions(userId)).toHaveLength(2);
    });

    it("replaces subscription with same endpoint", () => {
      addSubscription(userId, subscription);
      const updated = {
        ...subscription,
        keys: { p256dh: "new-key", auth: "new-auth" },
      };
      addSubscription(userId, updated);
      expect(getSubscriptions(userId)).toHaveLength(1);
      expect(getSubscriptions(userId)[0].keys.p256dh).toBe("new-key");
    });
  });

  describe("removeSubscription", () => {
    it("removes a subscription by endpoint", () => {
      addSubscription(userId, subscription);
      const removed = removeSubscription(userId, subscription.endpoint);
      expect(removed).toBe(true);
      expect(getSubscriptions(userId)).toHaveLength(0);
    });

    it("returns false if subscription not found", () => {
      const removed = removeSubscription(userId, "https://unknown.endpoint");
      expect(removed).toBe(false);
    });
  });

  describe("getSubscriptions", () => {
    it("returns empty array for unknown user", () => {
      expect(getSubscriptions("unknown-user")).toEqual([]);
    });
  });

  describe("sendPushToUser", () => {
    it("sends push notification to all user subscriptions", async () => {
      const webpush = (await import("web-push")).default;
      addSubscription(userId, subscription);

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
      addSubscription(userId, subscription);

      const result = await sendPushToUser(userId, {
        title: "Test",
        body: "Expired",
      });

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(getSubscriptions(userId)).toHaveLength(0);
    });

    it("removes subscription on 404 Not Found", async () => {
      const webpush = (await import("web-push")).default;
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce({
        statusCode: 404,
      });
      addSubscription(userId, subscription);

      const result = await sendPushToUser(userId, {
        title: "Test",
        body: "Not found",
      });

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(getSubscriptions(userId)).toHaveLength(0);
    });

    it("keeps subscription on transient errors", async () => {
      const webpush = (await import("web-push")).default;
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce({
        statusCode: 503,
      });
      addSubscription(userId, subscription);

      const result = await sendPushToUser(userId, {
        title: "Test",
        body: "Server error",
      });

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      // Subscription kept for retry
      expect(getSubscriptions(userId)).toHaveLength(1);
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
      addSubscription(userId, subscription);

      sendTurnPush(userId, "match-abc");

      // sendTurnPush is fire-and-forget; wait for microtask
      await new Promise((r) => setTimeout(r, 10));

      expect(webpush.sendNotification).toHaveBeenCalledWith(
        subscription,
        expect.stringContaining("votre tour"),
      );
      const payload = JSON.parse(
        vi.mocked(webpush.sendNotification).mock.calls[0][1] as string,
      );
      expect(payload.url).toBe("/play-hidden/match-abc");
      expect(payload.tag).toBe("turn-match-abc");
    });

    it("does not throw if user has no subscriptions", () => {
      expect(() => sendTurnPush("no-user", "match-xyz")).not.toThrow();
    });
  });

  describe("sendMatchFoundPush", () => {
    it("sends a 'match found' notification with correct payload", async () => {
      const webpush = (await import("web-push")).default;
      addSubscription(userId, subscription);

      sendMatchFoundPush(userId, "match-def");

      await new Promise((r) => setTimeout(r, 10));

      expect(webpush.sendNotification).toHaveBeenCalledWith(
        subscription,
        expect.any(String),
      );
      const payload = JSON.parse(
        vi.mocked(webpush.sendNotification).mock.calls[0][1] as string,
      );
      expect(payload).toEqual({
        title: "Nuffle Arena",
        body: "Un adversaire a ete trouve !",
        icon: "/images/favicon-optimized.png",
        url: "/play-hidden/match-def",
        tag: "match-found-match-def",
      });
    });

    it("does not throw if user has no subscriptions", () => {
      expect(() => sendMatchFoundPush("no-user", "match-xyz")).not.toThrow();
    });
  });

  describe("preference gating", () => {
    it("skips sendTurnPush when user preferences disallow turn notifications", async () => {
      const webpush = (await import("web-push")).default;
      const { shouldSendNotification } = await import("./notification-preferences");
      vi.mocked(shouldSendNotification).mockResolvedValueOnce(false);
      addSubscription(userId, subscription);

      sendTurnPush(userId, "match-gated");

      await new Promise((r) => setTimeout(r, 20));

      expect(shouldSendNotification).toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it("skips sendMatchFoundPush when user preferences disallow match-found notifications", async () => {
      const webpush = (await import("web-push")).default;
      const { shouldSendNotification } = await import("./notification-preferences");
      vi.mocked(shouldSendNotification).mockResolvedValueOnce(false);
      addSubscription(userId, subscription);

      sendMatchFoundPush(userId, "match-gated");

      await new Promise((r) => setTimeout(r, 20));

      expect(shouldSendNotification).toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it("sends push when preferences allow", async () => {
      const webpush = (await import("web-push")).default;
      const { shouldSendNotification } = await import("./notification-preferences");
      vi.mocked(shouldSendNotification).mockResolvedValueOnce(true);
      addSubscription(userId, subscription);

      sendTurnPush(userId, "match-allowed");

      await new Promise((r) => setTimeout(r, 20));

      expect(shouldSendNotification).toHaveBeenCalled();
      expect(webpush.sendNotification).toHaveBeenCalled();
    });
  });
});
