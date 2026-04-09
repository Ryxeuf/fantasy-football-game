import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma
vi.mock("../prisma", () => ({
  prisma: {
    notificationPreference: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "./notification-preferences";

const mockPrisma = prisma as any;

describe("Rule: Push notification preferences API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const userId = "user-abc";

  describe("GET /push/preferences", () => {
    it("returns default preferences for new user", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);

      const prefs = await getNotificationPreferences(userId);

      expect(prefs).toEqual({
        pushEnabled: true,
        turnNotification: true,
        matchFoundNotification: true,
      });
    });

    it("returns saved preferences for existing user", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        id: "pref-1",
        userId,
        pushEnabled: true,
        turnNotification: false,
        matchFoundNotification: false,
      });

      const prefs = await getNotificationPreferences(userId);

      expect(prefs).toEqual({
        pushEnabled: true,
        turnNotification: false,
        matchFoundNotification: false,
      });
    });
  });

  describe("PUT /push/preferences", () => {
    it("saves all preference fields", async () => {
      const input = {
        pushEnabled: false,
        turnNotification: true,
        matchFoundNotification: false,
      };
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        id: "pref-1",
        userId,
        ...input,
      });

      const result = await updateNotificationPreferences(userId, input);

      expect(result).toEqual(input);
      expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
    });

    it("handles partial update (toggle one field)", async () => {
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        id: "pref-1",
        userId,
        pushEnabled: true,
        turnNotification: false,
        matchFoundNotification: true,
      });

      const result = await updateNotificationPreferences(userId, {
        turnNotification: false,
      });

      expect(result.turnNotification).toBe(false);
    });
  });
});
