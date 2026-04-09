import { describe, it, expect, beforeEach } from "vitest";
import {
  isUserConnectedToMatch,
  trackUserJoin,
  trackUserLeave,
  resetConnectedUsers,
} from "./connected-users";

describe("isUserConnectedToMatch", () => {
  beforeEach(() => {
    resetConnectedUsers();
  });

  it("returns false when no one is connected to the match", () => {
    expect(isUserConnectedToMatch("match-1", "user-a")).toBe(false);
  });

  it("returns true when user has a socket in the match room", () => {
    trackUserJoin("match-1", "socket-1", "user-a");
    expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);
  });

  it("returns false when a different user is connected", () => {
    trackUserJoin("match-1", "socket-1", "user-b");
    expect(isUserConnectedToMatch("match-1", "user-a")).toBe(false);
  });

  it("returns false when user is connected to a different match", () => {
    trackUserJoin("match-2", "socket-1", "user-a");
    expect(isUserConnectedToMatch("match-1", "user-a")).toBe(false);
  });

  it("returns true when user has multiple sockets in the match (multi-tab)", () => {
    trackUserJoin("match-1", "socket-1", "user-a");
    trackUserJoin("match-1", "socket-2", "user-a");
    expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);
  });

  it("distinguishes between users in the same match", () => {
    trackUserJoin("match-1", "socket-1", "user-a");
    trackUserJoin("match-1", "socket-2", "user-b");
    expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);
    expect(isUserConnectedToMatch("match-1", "user-b")).toBe(true);
    expect(isUserConnectedToMatch("match-1", "user-c")).toBe(false);
  });

  it("returns false after user disconnects from match", () => {
    trackUserJoin("match-1", "socket-1", "user-a");
    expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);

    trackUserLeave("match-1", "socket-1");
    expect(isUserConnectedToMatch("match-1", "user-a")).toBe(false);
  });

  it("remains true if user still has another socket connected", () => {
    trackUserJoin("match-1", "socket-1", "user-a");
    trackUserJoin("match-1", "socket-2", "user-a");

    trackUserLeave("match-1", "socket-1");
    expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);
  });
});

describe("Rule: Smart turn push delivery", () => {
  beforeEach(() => {
    resetConnectedUsers();
  });

  it("should send push when user is NOT connected to the match via WebSocket", () => {
    const connected = isUserConnectedToMatch("match-abc", "user-opponent");
    expect(connected).toBe(false);
    // → move-processor will call sendTurnPush
  });

  it("should skip push when user IS already connected to the match", () => {
    trackUserJoin("match-abc", "socket-opp", "user-opponent");
    const connected = isUserConnectedToMatch("match-abc", "user-opponent");
    expect(connected).toBe(true);
    // → move-processor will NOT call sendTurnPush
  });
});
