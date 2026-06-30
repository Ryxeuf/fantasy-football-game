/**
 * Endpoint admin POST /admin/users/:id/impersonate (« se connecter en tant que »).
 *
 * - Emet un access token signe pour la CIBLE (sub) avec act=admin, imp=true.
 * - Aucun refresh token : la session usurpee expire d'elle-meme.
 * - Refuse de s'impersonner soi-meme (400), un compte supprime (400) ou banni (400).
 * - 404 si la cible n'existe pas.
 * - Trace l'audit log sans jamais exposer le token en clair.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = { id: "admin-1", role: "admin", roles: ["admin"] };
    return next();
  },
}));

vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

vi.mock("./auth", async () => ({
  getRefreshTokenStore: () => ({ revokeAllForUser: vi.fn(async () => {}) }),
}));

import express from "express";
import http from "http";
import adminRouter from "./admin";
import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

interface MockedPrisma {
  user: { findUnique: ReturnType<typeof vi.fn> };
}

const mockedPrisma = prisma as unknown as MockedPrisma;
const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

async function postImpersonate(userId: string) {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  const server = http.createServer(app);
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/admin/users/${userId}/impersonate`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer dummy",
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            try {
              resolve({ status: res.statusCode ?? 0, body: buf ? JSON.parse(buf) : {} });
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
      req.end();
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /admin/users/:id/impersonate", () => {
  it("emet un token signe pour la cible avec act=admin et imp=true", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-99",
      email: "target@coach.com",
      coachName: "TargetCoach",
      role: "user",
      roles: ["user"],
      deletedAt: null,
      bannedUntil: null,
    });

    const res = await postImpersonate("user-99");

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.expiresIn).toBe(60 * 60);
    expect(res.body.impersonatedUser).toEqual({
      id: "user-99",
      email: "target@coach.com",
      coachName: "TargetCoach",
      roles: ["user"],
    });

    const payload = jwt.verify(res.body.token, JWT_SECRET) as Record<string, unknown>;
    expect(payload.sub).toBe("user-99");
    expect(payload.act).toBe("admin-1");
    expect(payload.imp).toBe(true);
    expect(payload.roles).toEqual(["user"]);
  });

  it("trace l'audit log sans exposer le token", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-99",
      email: "x@x",
      coachName: "x",
      role: "user",
      roles: ["user"],
      deletedAt: null,
      bannedUntil: null,
    });

    const res = await postImpersonate("user-99");

    expect(res.status).toBe(200);
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    const auditCall = mockedAudit.mock.calls[0]![2];
    expect(auditCall.action).toBe("user.impersonate");
    expect(auditCall.entity).toBe("User");
    expect(auditCall.entityId).toBe("user-99");
    expect(auditCall.newValue).toEqual({ impersonatorId: "admin-1" });
    // Le token ne doit jamais apparaitre dans l'audit.
    expect(JSON.stringify(auditCall)).not.toContain(res.body.token);
  });

  it("refuse 400 si l'admin tente de s'impersonner lui-meme", async () => {
    const res = await postImpersonate("admin-1");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/vous-même/i);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("404 si la cible n'existe pas", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await postImpersonate("ghost");
    expect(res.status).toBe(404);
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("refuse 400 d'impersonner un compte supprime", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-99",
      email: "x@x",
      coachName: "x",
      role: "user",
      roles: ["user"],
      deletedAt: new Date(),
      bannedUntil: null,
    });
    const res = await postImpersonate("user-99");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/supprimé/i);
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("refuse 400 d'impersonner un compte banni (ban actif)", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-99",
      email: "x@x",
      coachName: "x",
      role: "user",
      roles: ["user"],
      deletedAt: null,
      bannedUntil: new Date(Date.now() + 60_000),
    });
    const res = await postImpersonate("user-99");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/banni/i);
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});
