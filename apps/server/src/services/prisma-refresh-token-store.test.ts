import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    refreshToken: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import { PrismaRefreshTokenStore } from "./prisma-refresh-token-store";

const mockPrisma = prisma as unknown as {
  refreshToken: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
};

describe("Rule: PrismaRefreshTokenStore (S24.3c)", () => {
  let store: PrismaRefreshTokenStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new PrismaRefreshTokenStore();
  });

  describe("register", () => {
    it("creates a refresh token row with the supplied jti, user, expiry", async () => {
      mockPrisma.refreshToken.create.mockResolvedValue({});
      const expiresAt = Math.floor(Date.now() / 1000) + 60;

      await store.register({ jti: "j1", sub: "user-1", expiresAt });

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const arg = mockPrisma.refreshToken.create.mock.calls[0][0];
      expect(arg.data.jti).toBe("j1");
      expect(arg.data.userId).toBe("user-1");
      expect(arg.data.expiresAt).toBeInstanceOf(Date);
      expect(Math.floor(arg.data.expiresAt.getTime() / 1000)).toBe(expiresAt);
    });
  });

  describe("revoke", () => {
    it("sets revokedAt on the row matching the jti", async () => {
      mockPrisma.refreshToken.update.mockResolvedValue({});

      await store.revoke("j1");

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledTimes(1);
      const arg = mockPrisma.refreshToken.update.mock.calls[0][0];
      expect(arg.where).toEqual({ jti: "j1" });
      expect(arg.data.revokedAt).toBeInstanceOf(Date);
    });

    it("ignores P2025 (record not found) silently", async () => {
      const err: Error & { code?: string } = new Error("not found");
      err.code = "P2025";
      mockPrisma.refreshToken.update.mockRejectedValue(err);

      await expect(store.revoke("missing")).resolves.toBeUndefined();
    });

    it("rethrows non-P2025 errors", async () => {
      mockPrisma.refreshToken.update.mockRejectedValue(new Error("db down"));

      await expect(store.revoke("j1")).rejects.toThrow(/db down/);
    });
  });

  describe("revokeAllForUser", () => {
    it("updates only active rows of that user", async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await store.revokeAllForUser("user-1");

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
      const arg = mockPrisma.refreshToken.updateMany.mock.calls[0][0];
      expect(arg.where.userId).toBe("user-1");
      expect(arg.where.revokedAt).toEqual(null);
      expect(arg.data.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe("isActive", () => {
    it("returns false when no row exists", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      expect(await store.isActive("missing")).toBe(false);
    });

    it("returns false when row is revoked", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      expect(await store.isActive("j1")).toBe(false);
    });

    it("returns false when row has expired", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1_000),
      });
      expect(await store.isActive("j1")).toBe(false);
    });

    it("returns true when row is active and not expired", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      expect(await store.isActive("j1")).toBe(true);
    });
  });

  describe("isRevoked", () => {
    it("returns false when no row exists", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      expect(await store.isRevoked("missing")).toBe(false);
    });

    it("returns false when row is active", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        revokedAt: null,
      });
      expect(await store.isRevoked("j1")).toBe(false);
    });

    it("returns true when row was revoked", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        revokedAt: new Date(),
      });
      expect(await store.isRevoked("j1")).toBe(true);
    });
  });
});
