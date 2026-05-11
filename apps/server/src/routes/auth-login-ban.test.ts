/**
 * Lot P.B.4 — Test que POST /auth/login refuse les comptes bannis
 * (User.bannedUntil > now()).
 *
 * Le check intervient AVANT bcrypt.compare pour eviter de signaler "password
 * ok" a un user banni. Le message est neutre.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
    },
    refreshToken: { create: vi.fn() },
  },
}));

vi.mock("../services/featureFlags", async () => {
  const actual =
    await vi.importActual<typeof import("../services/featureFlags")>(
      "../services/featureFlags",
    );
  return {
    ...actual,
    isEnabled: vi.fn(async () => false),
  };
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

describe("POST /auth/login — Lot P.B.4 ban gate", () => {
  it("refuse 403 si User.bannedUntil > now()", async () => {
    const futureBan = new Date(Date.now() + 24 * 60 * 60 * 1000); // +1j
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-banned",
      email: "banned@example.com",
      passwordHash: await bcrypt.hash("good-pass", 4),
      valid: true,
      bannedUntil: futureBan,
      role: "user",
      roles: ["user"],
    });

    const res = await postLogin({
      email: "banned@example.com",
      password: "good-pass",
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/suspendu/i);
    expect(res.body.bannedUntil).toBe(futureBan.toISOString());
    // Verifie qu'on n'a PAS appele update (donc lastLoginAt pas touche).
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("autorise si bannedUntil est passe (ban expire)", async () => {
    const pastBan = new Date(Date.now() - 60 * 60 * 1000); // -1h
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "ok@example.com",
      passwordHash: await bcrypt.hash("good-pass", 4),
      valid: true,
      bannedUntil: pastBan,
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

  it("autorise si bannedUntil est null (jamais banni)", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "ok2@example.com",
      passwordHash: await bcrypt.hash("good-pass", 4),
      valid: true,
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
      email: "ok2@example.com",
      password: "good-pass",
    });

    expect(res.status).toBe(200);
  });
});
