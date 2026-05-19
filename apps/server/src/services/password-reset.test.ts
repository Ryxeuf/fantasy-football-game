/**
 * Sprint P — Lot P.C.1 : tests du service password-reset.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Audit round 7 : consumeResetToken utilise maintenant updateMany
// conditionnel WHERE usedAt: null + $transaction(cb). Mock partage les
// mocks entre prisma top-level et le `tx` callback.
vi.mock("../prisma", () => {
  const user = { findUnique: vi.fn(), update: vi.fn() };
  const passwordResetToken = {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };
  return {
    prisma: {
      user,
      passwordResetToken,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (cb: any) => {
        if (typeof cb === "function") {
          return cb({ user, passwordResetToken });
        }
        return Promise.all(cb);
      }),
    },
  };
});

vi.mock("./refresh-token-store-singleton", () => ({
  getRefreshTokenStore: () => ({
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../utils/server-log", () => ({
  serverLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  PasswordResetError,
  consumeResetToken,
  requestPasswordReset,
} from "./password-reset";

const mocked = vi.mocked(prisma, true);

beforeEach(() => {
  vi.resetAllMocks();
  // Audit round 7 : $transaction accepte maintenant un callback. Mock
  // execute le callback avec les memes prisma mocks comme `tx`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mocked.$transaction.mockImplementation(async (cb: any) => {
    if (typeof cb === "function") {
      return cb({
        user: mocked.user,
        passwordResetToken: mocked.passwordResetToken,
      });
    }
    return Promise.all(cb as Promise<unknown>[]);
  });
  // updateMany default = count: 1 (happy path).
  mocked.passwordResetToken.updateMany.mockResolvedValue({ count: 1 } as never);
});

describe("requestPasswordReset", () => {
  it("genere un token et persist quand l'user existe", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u_1",
      email: "user@ex.com",
      deletedAt: null,
      bannedUntil: null,
    } as never);
    mocked.passwordResetToken.create.mockResolvedValue({ id: "tk_1" } as never);

    const result = await requestPasswordReset({
      email: "user@ex.com",
      origin: "https://nufflearena.fr",
    });

    expect(result.requested).toBe(true);
    expect(mocked.passwordResetToken.create).toHaveBeenCalledTimes(1);
    const createArgs = mocked.passwordResetToken.create.mock.calls[0][0] as {
      data: { userId: string; tokenHash: string; expiresAt: Date };
    };
    expect(createArgs.data.userId).toBe("u_1");
    expect(createArgs.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // expiresAt entre +23h et +25h.
    const ttlMs = createArgs.data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it("retourne 200 OK sans persister si l'user n'existe pas (anti-enumeration)", async () => {
    mocked.user.findUnique.mockResolvedValue(null as never);

    const result = await requestPasswordReset({
      email: "ghost@ex.com",
      origin: "https://x.com",
    });

    expect(result.requested).toBe(true);
    expect(result.devLink).toBeNull();
    expect(mocked.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("retourne 200 OK sans persister si l'user est soft-deleted", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u_1",
      email: "user@ex.com",
      deletedAt: new Date(),
      bannedUntil: null,
    } as never);

    const result = await requestPasswordReset({
      email: "user@ex.com",
      origin: "https://x.com",
    });

    expect(result.requested).toBe(true);
    expect(mocked.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("retourne 200 OK silencieux si l'user est banni", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u_1",
      email: "user@ex.com",
      deletedAt: null,
      bannedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } as never);

    const result = await requestPasswordReset({
      email: "user@ex.com",
      origin: "https://x.com",
    });

    expect(result.requested).toBe(true);
    expect(mocked.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("normalize l'email lowercase + trim", async () => {
    mocked.user.findUnique.mockResolvedValue(null as never);

    await requestPasswordReset({
      email: "  USER@Ex.COM  ",
      origin: "https://x.com",
    });

    expect(mocked.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "user@ex.com" },
      }),
    );
  });

  it("retourne devLink en non-production", async () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      mocked.user.findUnique.mockResolvedValue({
        id: "u_1",
        email: "user@ex.com",
        deletedAt: null,
        bannedUntil: null,
      } as never);
      mocked.passwordResetToken.create.mockResolvedValue({ id: "tk_1" } as never);

      const result = await requestPasswordReset({
        email: "user@ex.com",
        origin: "https://nufflearena.fr",
      });

      expect(result.devLink).toContain("https://nufflearena.fr/reset-password?token=");
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });

  it("retourne devLink=null en production", async () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      mocked.user.findUnique.mockResolvedValue({
        id: "u_1",
        email: "user@ex.com",
        deletedAt: null,
        bannedUntil: null,
      } as never);
      mocked.passwordResetToken.create.mockResolvedValue({ id: "tk_1" } as never);

      const result = await requestPasswordReset({
        email: "user@ex.com",
        origin: "https://nufflearena.fr",
      });

      expect(result.devLink).toBeNull();
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });
});

describe("consumeResetToken", () => {
  const validRecord = {
    id: "tk_1",
    userId: "u_1",
    expiresAt: new Date(Date.now() + 3600_000),
    usedAt: null,
    user: { id: "u_1", email: "user@ex.com", deletedAt: null },
  };

  it("rejette WEAK_PASSWORD si < 8 chars", async () => {
    await expect(
      consumeResetToken({ token: "a".repeat(43), newPassword: "short" }),
    ).rejects.toMatchObject({
      name: "PasswordResetError",
      code: "WEAK_PASSWORD",
    });
  });

  it("rejette INVALID_TOKEN si token inconnu", async () => {
    mocked.passwordResetToken.findUnique.mockResolvedValue(null as never);
    await expect(
      consumeResetToken({ token: "a".repeat(43), newPassword: "newpass123" }),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("rejette INVALID_TOKEN si user soft-deleted", async () => {
    mocked.passwordResetToken.findUnique.mockResolvedValue({
      ...validRecord,
      user: { ...validRecord.user, deletedAt: new Date() },
    } as never);
    await expect(
      consumeResetToken({ token: "a".repeat(43), newPassword: "newpass123" }),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("rejette TOKEN_USED si usedAt set", async () => {
    mocked.passwordResetToken.findUnique.mockResolvedValue({
      ...validRecord,
      usedAt: new Date(Date.now() - 60_000),
    } as never);
    await expect(
      consumeResetToken({ token: "a".repeat(43), newPassword: "newpass123" }),
    ).rejects.toMatchObject({ code: "TOKEN_USED" });
  });

  it("rejette TOKEN_EXPIRED si expiresAt depasse", async () => {
    mocked.passwordResetToken.findUnique.mockResolvedValue({
      ...validRecord,
      expiresAt: new Date(Date.now() - 60_000),
    } as never);
    await expect(
      consumeResetToken({ token: "a".repeat(43), newPassword: "newpass123" }),
    ).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
  });

  it("update passwordHash + marque usedAt si tout OK", async () => {
    mocked.passwordResetToken.findUnique.mockResolvedValue(validRecord as never);
    mocked.user.update.mockResolvedValue({} as never);
    mocked.passwordResetToken.update.mockResolvedValue({} as never);

    const result = await consumeResetToken({
      token: "a".repeat(43),
      newPassword: "newpass123",
    });

    expect(result).toEqual({ userId: "u_1", email: "user@ex.com" });
    // Audit round 7 : transaction utilise maintenant updateMany
    // conditionnel WHERE usedAt: null pour le token, suivi de user.update.
    expect(mocked.user.update).toHaveBeenCalledWith({
      where: { id: "u_1" },
      data: expect.objectContaining({ mustChangePassword: false }),
    });
    expect(mocked.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: "tk_1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("instances test : PasswordResetError detectable via instanceof", async () => {
    mocked.passwordResetToken.findUnique.mockResolvedValue(null as never);
    try {
      await consumeResetToken({
        token: "a".repeat(43),
        newPassword: "newpass123",
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PasswordResetError);
    }
  });
});
