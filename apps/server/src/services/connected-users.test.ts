import { describe, it, expect, beforeEach } from "vitest";
import {
  trackUserJoin,
  trackUserLeave,
  isUserConnectedToMatch,
  resetConnectedUsers,
} from "./connected-users";

describe("connected-users", () => {
  beforeEach(() => {
    resetConnectedUsers();
  });

  describe("trackUserJoin", () => {
    it("registers a socket for a match", () => {
      trackUserJoin("match-1", "socket-1", "user-a");
      expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);
    });

    it("supports multiple sockets from the same user", () => {
      trackUserJoin("match-1", "socket-1", "user-a");
      trackUserJoin("match-1", "socket-2", "user-a");
      expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);
    });

    it("supports multiple users in the same match", () => {
      trackUserJoin("match-1", "socket-1", "user-a");
      trackUserJoin("match-1", "socket-2", "user-b");
      expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);
      expect(isUserConnectedToMatch("match-1", "user-b")).toBe(true);
    });

    it("tracks users across different matches independently", () => {
      trackUserJoin("match-1", "socket-1", "user-a");
      trackUserJoin("match-2", "socket-2", "user-b");
      expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);
      expect(isUserConnectedToMatch("match-1", "user-b")).toBe(false);
      expect(isUserConnectedToMatch("match-2", "user-b")).toBe(true);
    });
  });

  describe("trackUserLeave", () => {
    it("removes a socket from a match", () => {
      trackUserJoin("match-1", "socket-1", "user-a");
      trackUserLeave("match-1", "socket-1");
      expect(isUserConnectedToMatch("match-1", "user-a")).toBe(false);
    });

    it("keeps the user connected if they have other sockets", () => {
      trackUserJoin("match-1", "socket-1", "user-a");
      trackUserJoin("match-1", "socket-2", "user-a");
      trackUserLeave("match-1", "socket-1");
      expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);
    });

    it("does not crash when removing a non-existent socket", () => {
      expect(() => trackUserLeave("match-1", "ghost-socket")).not.toThrow();
    });

    it("does not crash when removing from a non-existent match", () => {
      expect(() => trackUserLeave("no-match", "socket-1")).not.toThrow();
    });

    it("cleans up match entry when last socket leaves", () => {
      trackUserJoin("match-1", "socket-1", "user-a");
      trackUserLeave("match-1", "socket-1");
      // Verify the match entry is cleaned up by checking the user is not connected
      expect(isUserConnectedToMatch("match-1", "user-a")).toBe(false);
    });
  });

  describe("isUserConnectedToMatch", () => {
    it("returns false for unknown match", () => {
      expect(isUserConnectedToMatch("unknown", "user-a")).toBe(false);
    });

    it("returns false for unknown user in known match", () => {
      trackUserJoin("match-1", "socket-1", "user-a");
      expect(isUserConnectedToMatch("match-1", "user-b")).toBe(false);
    });

    it("returns true when user has an active socket", () => {
      trackUserJoin("match-1", "socket-1", "user-a");
      expect(isUserConnectedToMatch("match-1", "user-a")).toBe(true);
    });
  });

  describe("resetConnectedUsers", () => {
    it("clears all tracking state", () => {
      trackUserJoin("match-1", "socket-1", "user-a");
      trackUserJoin("match-2", "socket-2", "user-b");
      resetConnectedUsers();
      expect(isUserConnectedToMatch("match-1", "user-a")).toBe(false);
      expect(isUserConnectedToMatch("match-2", "user-b")).toBe(false);
    });
  });
});
