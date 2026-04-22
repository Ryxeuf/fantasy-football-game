import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock web-push before importing (same as push-notifications.test.ts so the
// shared module state remains consistent).
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

vi.mock("./notification-preferences", () => ({
  shouldSendNotification: vi.fn().mockResolvedValue(true),
  NotificationType: { Turn: "turn", MatchFound: "matchFound" },
}));

import {
  addExpoSubscription,
  removeExpoSubscription,
  getExpoSubscriptions,
  clearExpoSubscriptions,
  sendExpoPushToUser,
  sendTurnPush,
  sendMatchFoundPush,
  clearSubscriptions,
} from "./push-notifications";

describe("Expo push notifications", () => {
  const userId = "user-123";
  const expoToken = "ExponentPushToken[abc123xyz]";

  beforeEach(() => {
    clearSubscriptions();
    clearExpoSubscriptions();
    vi.clearAllMocks();
  });

  describe("addExpoSubscription", () => {
    it("stores an Expo push token for a user", () => {
      addExpoSubscription(userId, { token: expoToken, platform: "ios" });
      expect(getExpoSubscriptions(userId)).toHaveLength(1);
      expect(getExpoSubscriptions(userId)[0]).toEqual({
        token: expoToken,
        platform: "ios",
      });
    });

    it("keeps multiple tokens for the same user (multiple devices)", () => {
      addExpoSubscription(userId, { token: expoToken, platform: "ios" });
      addExpoSubscription(userId, {
        token: "ExponentPushToken[second]",
        platform: "android",
      });
      expect(getExpoSubscriptions(userId)).toHaveLength(2);
    });

    it("replaces entries with the same token (re-register)", () => {
      addExpoSubscription(userId, { token: expoToken, platform: "ios" });
      addExpoSubscription(userId, { token: expoToken, platform: "android" });
      const subs = getExpoSubscriptions(userId);
      expect(subs).toHaveLength(1);
      expect(subs[0].platform).toBe("android");
    });

    it("rejects malformed tokens (returns false)", () => {
      const ok = addExpoSubscription(userId, {
        token: "not-a-token",
        platform: "ios",
      });
      expect(ok).toBe(false);
      expect(getExpoSubscriptions(userId)).toHaveLength(0);
    });
  });

  describe("removeExpoSubscription", () => {
    it("removes a stored Expo token", () => {
      addExpoSubscription(userId, { token: expoToken, platform: "ios" });
      expect(removeExpoSubscription(userId, expoToken)).toBe(true);
      expect(getExpoSubscriptions(userId)).toHaveLength(0);
    });

    it("returns false when the token is unknown", () => {
      expect(
        removeExpoSubscription(userId, "ExponentPushToken[missing]"),
      ).toBe(false);
    });
  });

  describe("sendExpoPushToUser", () => {
    it("returns sent=0/failed=0 when user has no Expo subscriptions", async () => {
      const result = await sendExpoPushToUser(userId, {
        title: "Test",
        body: "No subs",
      });
      expect(result).toEqual({ sent: 0, failed: 0 });
    });

    it("POSTs to the Expo push API for each token", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: { status: "ok", id: "receipt-1" } }),
            { status: 200 },
          ),
        );

      addExpoSubscription(userId, { token: expoToken, platform: "ios" });

      const result = await sendExpoPushToUser(userId, {
        title: "Nuffle Arena",
        body: "C'est votre tour !",
        url: "/play/match-abc",
      });

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0];
      expect(call[0]).toBe("https://exp.host/--/api/v2/push/send");
      expect(call[1]?.method).toBe("POST");
      const headers = call[1]?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Accept"]).toBe("application/json");
      const body = JSON.parse((call[1]?.body as string) ?? "{}");
      expect(body.to).toBe(expoToken);
      expect(body.title).toBe("Nuffle Arena");
      expect(body.body).toBe("C'est votre tour !");
      expect(body.data?.url).toBe("/play/match-abc");
      expect(body.sound).toBe("default");
      fetchMock.mockRestore();
    });

    it("removes the token on DeviceNotRegistered error", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              status: "error",
              message:
                '"ExponentPushToken[abc123xyz]" is not a registered push notification recipient',
              details: { error: "DeviceNotRegistered" },
            },
          }),
          { status: 200 },
        ),
      );

      addExpoSubscription(userId, { token: expoToken, platform: "ios" });

      const result = await sendExpoPushToUser(userId, {
        title: "Test",
        body: "Expired",
      });

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(getExpoSubscriptions(userId)).toHaveLength(0);
      fetchMock.mockRestore();
    });

    it("keeps the token on transient network errors", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("network down"));

      addExpoSubscription(userId, { token: expoToken, platform: "ios" });

      const result = await sendExpoPushToUser(userId, {
        title: "Test",
        body: "Network",
      });

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(getExpoSubscriptions(userId)).toHaveLength(1);
      fetchMock.mockRestore();
    });
  });

  describe("sendTurnPush / sendMatchFoundPush with Expo tokens", () => {
    it("sendTurnPush also sends to Expo subscriptions", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: { status: "ok", id: "r1" } }),
            { status: 200 },
          ),
        );
      addExpoSubscription(userId, { token: expoToken, platform: "android" });

      sendTurnPush(userId, "match-xyz");

      await new Promise((r) => setTimeout(r, 20));

      expect(fetchMock).toHaveBeenCalled();
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1]?.body as string) ?? "{}",
      );
      expect(body.to).toBe(expoToken);
      expect(body.data).toMatchObject({
        kind: "turn",
        matchId: "match-xyz",
        url: "/play/match-xyz",
      });
      fetchMock.mockRestore();
    });

    it("sendMatchFoundPush also sends to Expo subscriptions", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: { status: "ok", id: "r1" } }),
            { status: 200 },
          ),
        );
      addExpoSubscription(userId, { token: expoToken, platform: "ios" });

      sendMatchFoundPush(userId, "match-found-1");

      await new Promise((r) => setTimeout(r, 20));

      expect(fetchMock).toHaveBeenCalled();
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1]?.body as string) ?? "{}",
      );
      expect(body.to).toBe(expoToken);
      expect(body.data).toMatchObject({
        kind: "matchFound",
        matchId: "match-found-1",
      });
      fetchMock.mockRestore();
    });

    it("preference gating applies to Expo pushes too", async () => {
      const { shouldSendNotification } = await import(
        "./notification-preferences"
      );
      vi.mocked(shouldSendNotification).mockResolvedValueOnce(false);
      const fetchMock = vi.spyOn(globalThis, "fetch");
      addExpoSubscription(userId, { token: expoToken, platform: "ios" });

      sendTurnPush(userId, "match-gated");

      await new Promise((r) => setTimeout(r, 20));

      expect(fetchMock).not.toHaveBeenCalled();
      fetchMock.mockRestore();
    });
  });
});
