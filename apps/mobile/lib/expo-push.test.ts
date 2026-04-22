import { describe, it, expect } from "vitest";
import {
  isExpoPushToken,
  buildSubscribePayload,
  parseNotificationData,
  resolveNavigationRoute,
  EXPO_PUSH_API,
  type NotificationData,
} from "./expo-push";

describe("isExpoPushToken", () => {
  it("accepts ExponentPushToken format", () => {
    expect(isExpoPushToken("ExponentPushToken[abc123xyz]")).toBe(true);
  });

  it("accepts ExpoPushToken format (shorter prefix)", () => {
    expect(isExpoPushToken("ExpoPushToken[abc123xyz]")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isExpoPushToken("")).toBe(false);
  });

  it("rejects plain random string", () => {
    expect(isExpoPushToken("random-token-abc")).toBe(false);
  });

  it("rejects tokens without closing bracket", () => {
    expect(isExpoPushToken("ExponentPushToken[abc")).toBe(false);
  });

  it("rejects tokens with empty payload", () => {
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
  });

  it("rejects web-push endpoint URLs", () => {
    expect(isExpoPushToken("https://push.example.com/sub/abc")).toBe(false);
  });
});

describe("buildSubscribePayload", () => {
  it("normalises platform to ios/android/web", () => {
    expect(
      buildSubscribePayload("ExponentPushToken[abc]", "ios").platform,
    ).toBe("ios");
    expect(
      buildSubscribePayload("ExponentPushToken[abc]", "android").platform,
    ).toBe("android");
    expect(
      buildSubscribePayload("ExponentPushToken[abc]", "web").platform,
    ).toBe("web");
  });

  it("defaults unknown platforms to 'unknown'", () => {
    expect(
      buildSubscribePayload("ExponentPushToken[abc]", "symbian").platform,
    ).toBe("unknown");
  });

  it("keeps the token verbatim", () => {
    const payload = buildSubscribePayload("ExponentPushToken[abc]", "ios");
    expect(payload.token).toBe("ExponentPushToken[abc]");
  });
});

describe("parseNotificationData", () => {
  it("extracts a turn notification from {kind, matchId}", () => {
    const data: NotificationData = parseNotificationData({
      kind: "turn",
      matchId: "match-abc",
    });
    expect(data.kind).toBe("turn");
    expect(data.matchId).toBe("match-abc");
  });

  it("extracts a matchFound notification", () => {
    const data = parseNotificationData({
      kind: "matchFound",
      matchId: "match-xyz",
    });
    expect(data.kind).toBe("matchFound");
    expect(data.matchId).toBe("match-xyz");
  });

  it("falls back to 'unknown' for malformed payloads", () => {
    expect(parseNotificationData(null).kind).toBe("unknown");
    expect(parseNotificationData(undefined).kind).toBe("unknown");
    expect(parseNotificationData(42).kind).toBe("unknown");
    expect(parseNotificationData({}).kind).toBe("unknown");
  });

  it("preserves the url when provided", () => {
    const data = parseNotificationData({
      kind: "turn",
      matchId: "m1",
      url: "/play/m1",
    });
    expect(data.url).toBe("/play/m1");
  });

  it("ignores unknown 'kind' values and marks them unknown", () => {
    const data = parseNotificationData({ kind: "explosion", matchId: "m1" });
    expect(data.kind).toBe("unknown");
  });

  it("rejects non-string matchId", () => {
    const data = parseNotificationData({ kind: "turn", matchId: 42 });
    expect(data.matchId).toBeUndefined();
  });
});

describe("resolveNavigationRoute", () => {
  it("maps turn notifications to /play/[id]", () => {
    expect(
      resolveNavigationRoute({ kind: "turn", matchId: "abc" }),
    ).toBe("/play/abc");
  });

  it("maps matchFound notifications to /play/[id]", () => {
    expect(
      resolveNavigationRoute({ kind: "matchFound", matchId: "abc" }),
    ).toBe("/play/abc");
  });

  it("prefers an explicit url when valid", () => {
    expect(
      resolveNavigationRoute({
        kind: "turn",
        matchId: "abc",
        url: "/replay/abc",
      }),
    ).toBe("/replay/abc");
  });

  it("rejects external URLs to prevent open-redirect", () => {
    expect(
      resolveNavigationRoute({
        kind: "turn",
        matchId: "abc",
        url: "https://evil.example.com/phish",
      }),
    ).toBe("/play/abc");
  });

  it("returns null when no matchId and no url (unknown)", () => {
    expect(resolveNavigationRoute({ kind: "unknown" })).toBeNull();
  });

  it("returns null if matchId contains path separators", () => {
    expect(
      resolveNavigationRoute({ kind: "turn", matchId: "abc/../etc" }),
    ).toBeNull();
  });
});

describe("EXPO_PUSH_API", () => {
  it("points at the official Expo push endpoint", () => {
    expect(EXPO_PUSH_API).toBe("https://exp.host/--/api/v2/push/send");
  });
});
