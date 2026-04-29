import { describe, it, expect } from "vitest";
import {
  sendFriendRequestSchema,
  respondFriendRequestSchema,
  listFriendshipsQuerySchema,
} from "./friendship.schemas";

describe("Rule: friendship schemas", () => {
  describe("sendFriendRequestSchema", () => {
    it("accepts a non-empty receiverId", () => {
      expect(
        sendFriendRequestSchema.safeParse({ receiverId: "user-1" }).success,
      ).toBe(true);
    });

    it("rejects an empty receiverId", () => {
      expect(sendFriendRequestSchema.safeParse({ receiverId: "" }).success).toBe(
        false,
      );
    });

    it("rejects missing receiverId AND missing username (S26.4b)", () => {
      expect(sendFriendRequestSchema.safeParse({}).success).toBe(false);
    });

    it("accepts a non-empty username (S26.4b)", () => {
      expect(
        sendFriendRequestSchema.safeParse({ username: "@alice" }).success,
      ).toBe(true);
    });

    it("rejects an empty username (S26.4b)", () => {
      expect(
        sendFriendRequestSchema.safeParse({ username: "" }).success,
      ).toBe(false);
    });

    it("rejects providing BOTH receiverId AND username (S26.4b — exclusive)", () => {
      expect(
        sendFriendRequestSchema.safeParse({
          receiverId: "user-1",
          username: "@alice",
        }).success,
      ).toBe(false);
    });
  });

  describe("respondFriendRequestSchema", () => {
    it("accepts action=accept", () => {
      expect(
        respondFriendRequestSchema.safeParse({ action: "accept" }).success,
      ).toBe(true);
    });

    it("accepts action=decline", () => {
      expect(
        respondFriendRequestSchema.safeParse({ action: "decline" }).success,
      ).toBe(true);
    });

    it("rejects unknown action", () => {
      expect(
        respondFriendRequestSchema.safeParse({ action: "block" }).success,
      ).toBe(false);
    });

    it("rejects missing action", () => {
      expect(respondFriendRequestSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("listFriendshipsQuerySchema", () => {
    it("accepts an empty query", () => {
      expect(listFriendshipsQuerySchema.safeParse({}).success).toBe(true);
    });

    it("accepts a valid status filter", () => {
      expect(
        listFriendshipsQuerySchema.safeParse({ status: "pending" }).success,
      ).toBe(true);
      expect(
        listFriendshipsQuerySchema.safeParse({ status: "accepted" }).success,
      ).toBe(true);
    });

    it("rejects an unknown status filter", () => {
      expect(
        listFriendshipsQuerySchema.safeParse({ status: "unknown" }).success,
      ).toBe(false);
    });
  });
});
