/**
 * Sprint O — Lot O.B.2 : tests du service email-verification.
 *
 * Mock du client Prisma + serverLog. Tests purs : pas de DB reelle.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  },
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
  EmailVerificationError,
  consumeEmailVerificationToken,
  requestEmailVerification,
} from "./email-verification";

const mocked = vi.mocked(prisma, true);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.$transaction.mockImplementation(async (ops: unknown[]) =>
    Promise.all(ops as Promise<unknown>[]),
  );
});

describe("requestEmailVerification", () => {
  it("genere un token et persist quand l'user existe et n'est pas verifie", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u_1",
      email: "user@ex.com",
      deletedAt: null,
      emailVerifiedAt: null,
    } as never);
    mocked.emailVerificationToken.create.mockResolvedValue({
      id: "tk_1",
    } as never);

    const result = await requestEmailVerification({
      userId: "u_1",
      origin: "https://nufflearena.fr",
    });

    expect(result.requested).toBe(true);
    expect(result.alreadyVerified).toBe(false);
    expect(mocked.emailVerificationToken.create).toHaveBeenCalledTimes(1);
    const createArgs = mocked.emailVerificationToken.create.mock.calls[0][0] as {
      data: { userId: string; tokenHash: string; expiresAt: Date };
    };
    expect(createArgs.data.userId).toBe("u_1");
    // SHA-256 hex = 64 chars.
    expect(createArgs.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // expiresAt entre +23h et +25h.
    const ttlMs = createArgs.data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it("retourne alreadyVerified=true et ne cree pas de token si deja verifie", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u_1",
      email: "user@ex.com",
      deletedAt: null,
      emailVerifiedAt: new Date("2026-01-01"),
    } as never);

    const result = await requestEmailVerification({
      userId: "u_1",
      origin: "https://nufflearena.fr",
    });

    expect(result.requested).toBe(true);
    expect(result.alreadyVerified).toBe(true);
    expect(result.devLink).toBeNull();
    expect(mocked.emailVerificationToken.create).not.toHaveBeenCalled();
  });

  it("throw USER_DELETED si l'user est soft-deleted", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u_1",
      email: "user@ex.com",
      deletedAt: new Date("2026-01-01"),
      emailVerifiedAt: null,
    } as never);

    await expect(
      requestEmailVerification({
        userId: "u_1",
        origin: "https://nufflearena.fr",
      }),
    ).rejects.toThrow(EmailVerificationError);
    expect(mocked.emailVerificationToken.create).not.toHaveBeenCalled();
  });

  it("throw USER_DELETED si l'user n'existe pas", async () => {
    mocked.user.findUnique.mockResolvedValue(null as never);

    await expect(
      requestEmailVerification({
        userId: "u_unknown",
        origin: "https://nufflearena.fr",
      }),
    ).rejects.toThrow(EmailVerificationError);
  });

  it("expose devLink en non-prod, null en prod", async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: "u_1",
      email: "user@ex.com",
      deletedAt: null,
      emailVerifiedAt: null,
    } as never);
    mocked.emailVerificationToken.create.mockResolvedValue({
      id: "tk_1",
    } as never);

    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      const prodResult = await requestEmailVerification({
        userId: "u_1",
        origin: "https://nufflearena.fr",
      });
      expect(prodResult.devLink).toBeNull();

      process.env.NODE_ENV = "test";
      const devResult = await requestEmailVerification({
        userId: "u_1",
        origin: "https://nufflearena.fr",
      });
      expect(devResult.devLink).toMatch(
        /^https:\/\/nufflearena\.fr\/verify-email\?token=[A-Za-z0-9_-]+$/,
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe("consumeEmailVerificationToken", () => {
  it("set emailVerifiedAt et marque le token used quand valide", async () => {
    mocked.emailVerificationToken.findUnique.mockResolvedValue({
      id: "tk_1",
      userId: "u_1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // +1h
      usedAt: null,
      user: {
        id: "u_1",
        email: "user@ex.com",
        deletedAt: null,
        emailVerifiedAt: null,
      },
    } as never);

    const result = await consumeEmailVerificationToken({ token: "plain_token" });

    expect(result.userId).toBe("u_1");
    expect(result.email).toBe("user@ex.com");
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(mocked.user.update).toHaveBeenCalledTimes(1);
    expect(mocked.emailVerificationToken.update).toHaveBeenCalledTimes(1);
    const userArgs = mocked.user.update.mock.calls[0][0] as {
      where: { id: string };
      data: { emailVerifiedAt: Date };
    };
    expect(userArgs.where.id).toBe("u_1");
    expect(userArgs.data.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("throw INVALID_TOKEN si le token n'existe pas", async () => {
    mocked.emailVerificationToken.findUnique.mockResolvedValue(null as never);

    await expect(
      consumeEmailVerificationToken({ token: "bogus" }),
    ).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });

  it("throw INVALID_TOKEN si l'user est soft-deleted", async () => {
    mocked.emailVerificationToken.findUnique.mockResolvedValue({
      id: "tk_1",
      userId: "u_1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
      user: {
        id: "u_1",
        email: "user@ex.com",
        deletedAt: new Date(),
        emailVerifiedAt: null,
      },
    } as never);

    await expect(
      consumeEmailVerificationToken({ token: "plain" }),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("throw TOKEN_EXPIRED si expiresAt est dans le passe", async () => {
    mocked.emailVerificationToken.findUnique.mockResolvedValue({
      id: "tk_1",
      userId: "u_1",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      user: {
        id: "u_1",
        email: "user@ex.com",
        deletedAt: null,
        emailVerifiedAt: null,
      },
    } as never);

    await expect(
      consumeEmailVerificationToken({ token: "plain" }),
    ).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("throw TOKEN_USED si le token a deja ete consomme (et user pas verifie)", async () => {
    mocked.emailVerificationToken.findUnique.mockResolvedValue({
      id: "tk_1",
      userId: "u_1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: new Date(Date.now() - 60 * 1000),
      user: {
        id: "u_1",
        email: "user@ex.com",
        deletedAt: null,
        emailVerifiedAt: null,
      },
    } as never);

    await expect(
      consumeEmailVerificationToken({ token: "plain" }),
    ).rejects.toMatchObject({ code: "TOKEN_USED" });
  });

  it("est idempotent : 2eme click sur le meme lien apres verification retourne le verifiedAt existant", async () => {
    const existingVerifiedAt = new Date("2026-05-01");
    mocked.emailVerificationToken.findUnique.mockResolvedValue({
      id: "tk_1",
      userId: "u_1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: new Date(Date.now() - 60 * 1000),
      user: {
        id: "u_1",
        email: "user@ex.com",
        deletedAt: null,
        emailVerifiedAt: existingVerifiedAt,
      },
    } as never);

    const result = await consumeEmailVerificationToken({ token: "plain" });
    expect(result.verifiedAt).toEqual(existingVerifiedAt);
    // Pas de re-update si deja verifie.
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("hash du token est deterministe (meme token → meme hash)", async () => {
    mocked.emailVerificationToken.findUnique.mockResolvedValue(null as never);

    // 2 calls avec le meme token plain.
    try {
      await consumeEmailVerificationToken({ token: "same_token" });
    } catch {
      // Ignoré, on veut juste capturer les args.
    }
    try {
      await consumeEmailVerificationToken({ token: "same_token" });
    } catch {
      // Ignoré.
    }

    const calls = mocked.emailVerificationToken.findUnique.mock.calls;
    expect(calls.length).toBe(2);
    const hash1 = (calls[0][0] as { where: { tokenHash: string } }).where
      .tokenHash;
    const hash2 = (calls[1][0] as { where: { tokenHash: string } }).where
      .tokenHash;
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });
});
