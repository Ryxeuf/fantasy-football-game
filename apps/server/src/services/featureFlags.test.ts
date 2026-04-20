import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    featureFlag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    featureFlagUser: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  isEnabled,
  listEnabledKeysForUser,
  listAll,
  createFlag,
  updateFlag,
  deleteFlag,
  addUserOverride,
  removeUserOverride,
  invalidateFeatureFlagsCache,
  ONLINE_PLAY_FLAG,
  AI_TRAINING_FLAG,
} from "./featureFlags";

const mockPrisma = prisma as any;

const now = new Date("2026-04-17T10:00:00Z");

function flag(
  id: string,
  key: string,
  enabled: boolean,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    key,
    description: null,
    enabled,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

describe("featureFlags service", () => {
  // La CI peut exporter FEATURE_FLAGS_FORCE_ENABLED=true ; on la neutralise
  // dans les tests unitaires pour pouvoir observer le comportement par défaut.
  const savedForceEnv = process.env.FEATURE_FLAGS_FORCE_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateFeatureFlagsCache();
    delete process.env.FEATURE_FLAGS_FORCE_ENABLED;
  });

  afterEach(() => {
    if (savedForceEnv === undefined) {
      delete process.env.FEATURE_FLAGS_FORCE_ENABLED;
    } else {
      process.env.FEATURE_FLAGS_FORCE_ENABLED = savedForceEnv;
    }
  });

  describe("isEnabled", () => {
    it("returns false when flag does not exist", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);
      expect(await isEnabled("missing")).toBe(false);
    });

    it("returns true when the flag is globally enabled", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "beta", true),
      ]);
      expect(await isEnabled("beta")).toBe(true);
      expect(await isEnabled("beta", "user-1")).toBe(true);
    });

    it("returns false when flag is globally disabled and no userId provided", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "beta", false),
      ]);
      expect(await isEnabled("beta")).toBe(false);
    });

    it("returns true for a user with an override when flag is disabled", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "beta", false),
      ]);
      mockPrisma.featureFlagUser.findUnique.mockResolvedValue({
        id: "o1",
        flagId: "f1",
        userId: "user-1",
      });
      expect(await isEnabled("beta", "user-1")).toBe(true);
    });

    it("returns false when user has no override and flag is disabled", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "beta", false),
      ]);
      mockPrisma.featureFlagUser.findUnique.mockResolvedValue(null);
      expect(await isEnabled("beta", "user-1")).toBe(false);
    });

    it("reuses the cache across calls within TTL", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "beta", true),
      ]);
      await isEnabled("beta");
      await isEnabled("beta");
      await isEnabled("beta");
      expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledTimes(1);
    });

    it("returns true when FEATURE_FLAGS_FORCE_ENABLED=true (CI/tests)", async () => {
      process.env.FEATURE_FLAGS_FORCE_ENABLED = "true";
      // Pas de mock : le bypass doit court-circuiter l'accès DB.
      expect(await isEnabled("never_created_anywhere")).toBe(true);
      expect(mockPrisma.featureFlag.findMany).not.toHaveBeenCalled();
    });

    it('accepts "1" as a truthy value for FEATURE_FLAGS_FORCE_ENABLED', async () => {
      process.env.FEATURE_FLAGS_FORCE_ENABLED = "1";
      expect(await isEnabled("anything")).toBe(true);
    });

    it("does not bypass when FEATURE_FLAGS_FORCE_ENABLED=false", async () => {
      process.env.FEATURE_FLAGS_FORCE_ENABLED = "false";
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);
      expect(await isEnabled("missing")).toBe(false);
    });

    it("returns true for admin role regardless of flag state", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "beta", false),
      ]);
      expect(
        await isEnabled("beta", "user-1", { roles: ["user", "admin"] }),
      ).toBe(true);
      expect(await isEnabled("beta", undefined, { roles: ["admin"] })).toBe(
        true,
      );
      // Le bypass admin ne doit pas déclencher la lookup d'override.
      expect(mockPrisma.featureFlagUser.findUnique).not.toHaveBeenCalled();
    });

    it("does not grant bypass to non-admin roles", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "beta", false),
      ]);
      mockPrisma.featureFlagUser.findUnique.mockResolvedValue(null);
      expect(
        await isEnabled("beta", "user-1", { roles: ["user", "moderator"] }),
      ).toBe(false);
    });
  });

  describe("listEnabledKeysForUser", () => {
    it("combines globally-enabled flags with user overrides", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "global_on", true),
        flag("f2", "global_off", false),
        flag("f3", "other_off", false),
      ]);
      mockPrisma.featureFlagUser.findMany.mockResolvedValue([
        {
          id: "o1",
          userId: "user-1",
          flagId: "f2",
          flag: { key: "global_off", enabled: false },
        },
      ]);
      const keys = await listEnabledKeysForUser("user-1");
      expect(keys).toEqual(["global_off", "global_on"]);
    });

    it("deduplicates flags enabled globally and via override", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "beta", true),
      ]);
      mockPrisma.featureFlagUser.findMany.mockResolvedValue([
        {
          id: "o1",
          userId: "user-1",
          flagId: "f1",
          flag: { key: "beta", enabled: true },
        },
      ]);
      expect(await listEnabledKeysForUser("user-1")).toEqual(["beta"]);
    });

    it("returns all flag keys for admin regardless of state", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "alpha", false),
        flag("f2", "beta", false),
        flag("f3", "gamma", true),
      ]);
      const keys = await listEnabledKeysForUser("admin-id", {
        roles: ["admin"],
      });
      expect(keys).toEqual(["alpha", "beta", "gamma"]);
      // Ne doit pas aller chercher les overrides si admin.
      expect(mockPrisma.featureFlagUser.findMany).not.toHaveBeenCalled();
    });

    it("returns all flag keys when FEATURE_FLAGS_FORCE_ENABLED=true", async () => {
      process.env.FEATURE_FLAGS_FORCE_ENABLED = "true";
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flag("f1", "alpha", false),
        flag("f2", "beta", false),
      ]);
      const keys = await listEnabledKeysForUser("anybody");
      expect(keys).toEqual(["alpha", "beta"]);
    });
  });

  describe("listAll", () => {
    it("returns flags with userOverrideCount", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        { ...flag("f1", "beta", true), _count: { userOverrides: 3 } },
      ]);
      const result = await listAll();
      expect(result).toEqual([
        {
          id: "f1",
          key: "beta",
          description: null,
          enabled: true,
          createdAt: now,
          updatedAt: now,
          userOverrideCount: 3,
        },
      ]);
    });
  });

  describe("mutation invalidates cache", () => {
    it("createFlag refreshes the cached list on next read", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValueOnce([
        flag("f1", "old", false),
      ]);
      await isEnabled("old");

      mockPrisma.featureFlag.create.mockResolvedValue(flag("f2", "fresh", true));
      await createFlag({ key: "fresh", enabled: true });

      mockPrisma.featureFlag.findMany.mockResolvedValueOnce([
        flag("f1", "old", false),
        flag("f2", "fresh", true),
      ]);
      expect(await isEnabled("fresh")).toBe(true);
      expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledTimes(2);
    });

    it("updateFlag invalidates cache", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValueOnce([
        flag("f1", "beta", false),
      ]);
      expect(await isEnabled("beta")).toBe(false);

      mockPrisma.featureFlag.update.mockResolvedValue(
        flag("f1", "beta", true),
      );
      await updateFlag("f1", { enabled: true });

      mockPrisma.featureFlag.findMany.mockResolvedValueOnce([
        flag("f1", "beta", true),
      ]);
      expect(await isEnabled("beta")).toBe(true);
    });

    it("deleteFlag invalidates cache", async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValueOnce([
        flag("f1", "beta", true),
      ]);
      expect(await isEnabled("beta")).toBe(true);

      mockPrisma.featureFlag.delete.mockResolvedValue(undefined);
      await deleteFlag("f1");

      mockPrisma.featureFlag.findMany.mockResolvedValueOnce([]);
      expect(await isEnabled("beta")).toBe(false);
    });
  });

  describe("addUserOverride / removeUserOverride", () => {
    it("upserts the override to stay idempotent", async () => {
      mockPrisma.featureFlagUser.upsert.mockResolvedValue({
        id: "o1",
        flagId: "f1",
        userId: "user-1",
      });
      await addUserOverride("f1", "user-1");
      expect(mockPrisma.featureFlagUser.upsert).toHaveBeenCalledWith({
        where: { flagId_userId: { flagId: "f1", userId: "user-1" } },
        create: { flagId: "f1", userId: "user-1" },
        update: {},
      });
    });

    it("removeUserOverride ignores missing records", async () => {
      mockPrisma.featureFlagUser.delete.mockRejectedValue(
        new Error("not found"),
      );
      await expect(removeUserOverride("f1", "user-1")).resolves.toBeUndefined();
    });
  });

  describe("ONLINE_PLAY_FLAG constant", () => {
    it('exports the canonical "online_play" key', () => {
      expect(ONLINE_PLAY_FLAG).toBe("online_play");
    });
  });

  describe("AI_TRAINING_FLAG constant", () => {
    it('exports the canonical "ai_training" key', () => {
      expect(AI_TRAINING_FLAG).toBe("ai_training");
    });
  });
});
