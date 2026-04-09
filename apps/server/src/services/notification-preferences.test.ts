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
  shouldSendNotification,
  NotificationType,
} from "./notification-preferences";

const mockPrisma = prisma as any;

describe("notification-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const userId = "user-123";

  describe("getNotificationPreferences", () => {
    it("returns stored preferences when they exist", async () => {
      const stored = {
        id: "pref-1",
        userId,
        pushEnabled: true,
        turnNotification: false,
        matchFoundNotification: true,
      };
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(stored);

      const result = await getNotificationPreferences(userId);

      expect(result).toEqual({
        pushEnabled: true,
        turnNotification: false,
        matchFoundNotification: true,
      });
      expect(mockPrisma.notificationPreference.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it("returns all-enabled defaults when no preferences exist", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);

      const result = await getNotificationPreferences(userId);

      expect(result).toEqual({
        pushEnabled: true,
        turnNotification: true,
        matchFoundNotification: true,
      });
    });
  });

  describe("updateNotificationPreferences", () => {
    it("upserts preferences for the user", async () => {
      const prefs = {
        pushEnabled: true,
        turnNotification: false,
        matchFoundNotification: true,
      };
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        id: "pref-1",
        userId,
        ...prefs,
      });

      const result = await updateNotificationPreferences(userId, prefs);

      expect(result).toEqual(prefs);
      expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: { userId, ...prefs },
        update: prefs,
      });
    });

    it("allows partial updates (only pushEnabled)", async () => {
      const partial = { pushEnabled: false };
      mockPrisma.notificationPreference.upsert.mockResolvedValue({
        id: "pref-1",
        userId,
        pushEnabled: false,
        turnNotification: true,
        matchFoundNotification: true,
      });

      const result = await updateNotificationPreferences(userId, partial);

      expect(result.pushEnabled).toBe(false);
    });
  });

  describe("shouldSendNotification", () => {
    it("returns true when pushEnabled and specific type enabled", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        userId,
        pushEnabled: true,
        turnNotification: true,
        matchFoundNotification: true,
      });

      expect(await shouldSendNotification(userId, NotificationType.Turn)).toBe(true);
      expect(await shouldSendNotification(userId, NotificationType.MatchFound)).toBe(true);
    });

    it("returns false when pushEnabled is false (master toggle off)", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        userId,
        pushEnabled: false,
        turnNotification: true,
        matchFoundNotification: true,
      });

      expect(await shouldSendNotification(userId, NotificationType.Turn)).toBe(false);
      expect(await shouldSendNotification(userId, NotificationType.MatchFound)).toBe(false);
    });

    it("returns false when specific type is disabled", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        userId,
        pushEnabled: true,
        turnNotification: false,
        matchFoundNotification: true,
      });

      expect(await shouldSendNotification(userId, NotificationType.Turn)).toBe(false);
      expect(await shouldSendNotification(userId, NotificationType.MatchFound)).toBe(true);
    });

    it("returns true (defaults) when no preferences stored", async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);

      expect(await shouldSendNotification(userId, NotificationType.Turn)).toBe(true);
      expect(await shouldSendNotification(userId, NotificationType.MatchFound)).toBe(true);
    });
  });
});
