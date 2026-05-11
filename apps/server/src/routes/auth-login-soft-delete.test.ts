/**
 * Lot P.A.2 — Test que POST /auth/login refuse les comptes soft-deleted
 * (User.deletedAt != null). Message neutre, pas de leak.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
    refreshToken: { create: vi.fn() },
  },
}));

vi.mock("../services/featureFlags", async () => {
  const actual =
    await vi.importActual<typeof import("../services/featureFlags")>(
      "../services/featureFlags",
    );
  return { ...actual, isEnabled: vi.fn(async () => false) };
});

vi.mock("../services/kofi-claim", () => ({
  ensureKofiLinkCode: vi.fn(async () => {}),
  claimOrphanKofiTransactions: vi.fn(async () => {}),
}));

vi.mock("../services/auth-tokens", async () => {
  const actual =
    await vi.importActual<typeof import("../services/auth-tokens")>(
      "../services/auth-tokens",
    );
  return {
    ...actual,
    signAccessToken: vi.fn(() => "signed-access-token"),
    signRefreshToken: vi.fn(() => "signed-refresh-token"),
    verifyRefreshToken: vi.fn(() => ({
      jti: "jti-1",
      sub: "user-1",
      typ: "refresh",
      iat: 0,
      exp: 0,
    })),
  };
});

vi.mock("../services/prisma-refresh-token-store", () => ({
  PrismaRefreshTokenStore: class {
    async register() {}
    async rotate() {}
    async revoke() {}
  },
}));

import bcrypt from "bcryptjs";
import express from "express";
import http from "http";
import authRouter from "./auth";
import { prisma } from "../prisma";

interface MockedPrisma {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

const mockedPrisma = prisma as unknown as MockedPrisma;

async function postLogin(body: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  const server = http.createServer(app);
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const data = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/auth/login",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            try {
              resolve({
                status: res.statusCode ?? 0,
                body: buf ? JSON.parse(buf) : {},
              });
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      req.write(data);
      req.end();
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /auth/login — Lot P.A.2 soft-delete gate", () => {
  it("refuse 403 avec message neutre si User.deletedAt != null", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-deleted",
      email: "deleted@example.com",
      passwordHash: await bcrypt.hash("good-pass", 4),
      valid: true,
      deletedAt: new Date("2026-04-01"),
      bannedUntil: null,
      role: "user",
      roles: ["user"],
    });

    const res = await postLogin({
      email: "deleted@example.com",
      password: "good-pass",
    });

    expect(res.status).toBe(403);
    // Message neutre : pas de leak "compte supprime".
    expect(res.body.error).toMatch(/identifiants/i);
    // Pas d'update lastLoginAt sur un compte refuse.
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("autorise si deletedAt est null", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "ok@example.com",
      passwordHash: await bcrypt.hash("good-pass", 4),
      valid: true,
      deletedAt: null,
      bannedUntil: null,
      role: "user",
      roles: ["user"],
      name: null,
      coachName: "Coach",
      firstName: null,
      lastName: null,
      dateOfBirth: null,
      createdAt: new Date("2026-01-01"),
    });

    const res = await postLogin({
      email: "ok@example.com",
      password: "good-pass",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe("signed-access-token");
  });
});
