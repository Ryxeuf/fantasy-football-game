/**
 * Lot P.A.2 — Tests d'integration soft-delete + restore.
 *
 * Couvre :
 *  - DELETE /admin/users/:id : set deletedAt, refuse double-delete (409),
 *    refuse self-delete (400), 404, audit log
 *  - POST /admin/users/:id/restore : clear deletedAt, refuse si actif (409),
 *    404, audit log
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

vi.mock("./auth", () => ({
  getRefreshTokenStore: () => ({
    revokeAllForUser: vi.fn(async () => {}),
  }),
}));

import express from "express";
import http from "http";
import adminRouter from "./admin";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

interface MockedPrisma {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

const mockedPrisma = prisma as unknown as MockedPrisma;
const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

async function request(
  method: "DELETE" | "POST",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const data = body !== null ? JSON.stringify(body) : "";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/admin${path}`,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
            Authorization: "Bearer dummy",
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
      if (data) req.write(data);
      req.end();
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /admin/users/:id (Lot P.A.2 soft-delete)", () => {
  it("soft-delete : set deletedAt + deletionReason, audit log", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u-99",
      email: "x@x",
      name: "Coach",
      role: "user",
      roles: ["user"],
      patreon: false,
      valid: true,
      deletedAt: null,
      deletionReason: null,
    });
    mockedPrisma.user.update.mockResolvedValueOnce({});

    const res = await request("DELETE", "/users/u-99", {
      reason: "abandon RGPD demande user",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.deletedAt).toBeDefined();
    const updateCall = mockedPrisma.user.update.mock.calls[0]![0];
    expect(updateCall.where).toEqual({ id: "u-99" });
    expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
    expect(updateCall.data.deletionReason).toBe("abandon RGPD demande user");
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "user.delete",
        entity: "User",
        entityId: "u-99",
        oldValue: expect.objectContaining({ deletedAt: null }),
        newValue: expect.objectContaining({ deletionReason: "abandon RGPD demande user" }),
      }),
    );
  });

  it("accepte raison vide (body sans reason)", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u-99",
      email: "x",
      name: "x",
      role: "user",
      roles: ["user"],
      patreon: false,
      valid: true,
      deletedAt: null,
      deletionReason: null,
    });
    mockedPrisma.user.update.mockResolvedValueOnce({});

    const res = await request("DELETE", "/users/u-99");

    expect(res.status).toBe(200);
    const updateCall = mockedPrisma.user.update.mock.calls[0]![0];
    expect(updateCall.data.deletionReason).toBeNull();
  });

  it("tronque la raison a 500 chars", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u-99",
      email: "x",
      name: "x",
      role: "user",
      roles: ["user"],
      patreon: false,
      valid: true,
      deletedAt: null,
      deletionReason: null,
    });
    mockedPrisma.user.update.mockResolvedValueOnce({});
    const long = "a".repeat(1000);

    await request("DELETE", "/users/u-99", { reason: long });

    const updateCall = mockedPrisma.user.update.mock.calls[0]![0];
    expect((updateCall.data.deletionReason as string).length).toBe(500);
  });

  it("refuse double-delete (409) si compte deja supprime", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u-99",
      email: "x",
      name: "x",
      role: "user",
      roles: ["user"],
      patreon: false,
      valid: true,
      deletedAt: new Date("2026-05-01"),
      deletionReason: "previous delete",
    });

    const res = await request("DELETE", "/users/u-99", { reason: "second" });

    expect(res.status).toBe(409);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("refuse self-delete (400)", async () => {
    const res = await request("DELETE", "/users/admin-1", { reason: "auto" });
    expect(res.status).toBe(400);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("404 si user inexistant", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request("DELETE", "/users/ghost");
    expect(res.status).toBe(404);
  });
});

describe("POST /admin/users/:id/restore (Lot P.A.2)", () => {
  it("restaure : clear deletedAt + deletionReason, audit log", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      deletedAt: new Date("2026-05-01"),
      deletionReason: "previous delete",
    });
    mockedPrisma.user.update.mockResolvedValueOnce({});

    const res = await request("POST", "/users/u-77/restore", null);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const updateCall = mockedPrisma.user.update.mock.calls[0]![0];
    expect(updateCall.data).toEqual({ deletedAt: null, deletionReason: null });
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({ action: "user.restore", entityId: "u-77" }),
    );
  });

  it("refuse 409 si compte actif (jamais supprime)", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      deletedAt: null,
      deletionReason: null,
    });

    const res = await request("POST", "/users/u-77/restore", null);

    expect(res.status).toBe(409);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("404 si user inexistant", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request("POST", "/users/ghost/restore", null);
    expect(res.status).toBe(404);
  });
});
