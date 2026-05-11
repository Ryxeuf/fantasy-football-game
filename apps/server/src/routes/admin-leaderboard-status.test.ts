/**
 * Tests pour PATCH /admin/users/:id/leaderboard-status.
 *
 * Verifie le bypass admin, la validation Zod, l'update prisma, l'audit
 * log, le 404 sur user inconnu et l'effacement de la `reason` quand on
 * passe a `visible`.
 *
 * Pattern : mock authUser / adminOnly + prisma + safeRecordAdminAction.
 * Le router est expose via http.createServer (supertest absent — cf. CLAUDE.md).
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

async function requestAdmin(
  method: "PATCH",
  path: string,
  body: Record<string, unknown> | null,
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
      const data = body ? JSON.stringify(body) : "";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/admin${path}`,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
            Authorization: "Bearer dummy-token",
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

describe("PATCH /admin/users/:id/leaderboard-status", () => {
  it("hides a user from the leaderboard, persists reason + admin id, and writes an audit log", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      leaderboardStatus: "visible",
      leaderboardStatusReason: null,
      leaderboardStatusUpdatedAt: null,
      leaderboardStatusUpdatedBy: null,
    });
    mockedPrisma.user.update.mockResolvedValue({
      id: "u-1",
      email: "u@x",
      coachName: "Foo",
      leaderboardStatus: "hidden_admin",
      leaderboardStatusReason: "test abuse",
      leaderboardStatusUpdatedAt: new Date(),
      leaderboardStatusUpdatedBy: "admin-1",
    });

    const { status, body } = await requestAdmin(
      "PATCH",
      "/users/u-1/leaderboard-status",
      { status: "hidden_admin", reason: "test abuse" },
    );

    expect(status).toBe(200);
    expect(body.user.leaderboardStatus).toBe("hidden_admin");
    expect(body.user.leaderboardStatusReason).toBe("test abuse");

    const updateArg = mockedPrisma.user.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "u-1" });
    expect(updateArg.data.leaderboardStatus).toBe("hidden_admin");
    expect(updateArg.data.leaderboardStatusReason).toBe("test abuse");
    expect(updateArg.data.leaderboardStatusUpdatedBy).toBe("admin-1");
    expect(updateArg.data.leaderboardStatusUpdatedAt).toBeInstanceOf(Date);

    expect(mockedAudit).toHaveBeenCalledTimes(1);
    const auditPayload = mockedAudit.mock.calls[0][2];
    expect(auditPayload.action).toBe("user.leaderboardStatus.update");
    expect(auditPayload.entity).toBe("User");
    expect(auditPayload.entityId).toBe("u-1");
    expect(auditPayload.newValue).toMatchObject({
      leaderboardStatus: "hidden_admin",
      leaderboardStatusReason: "test abuse",
    });
  });

  it("clears the reason when switching back to visible", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      leaderboardStatus: "hidden_admin",
      leaderboardStatusReason: "old reason",
      leaderboardStatusUpdatedAt: new Date(),
      leaderboardStatusUpdatedBy: "admin-1",
    });
    mockedPrisma.user.update.mockResolvedValue({
      id: "u-1",
      email: "u@x",
      coachName: "Foo",
      leaderboardStatus: "visible",
      leaderboardStatusReason: null,
      leaderboardStatusUpdatedAt: new Date(),
      leaderboardStatusUpdatedBy: "admin-1",
    });

    const { status } = await requestAdmin(
      "PATCH",
      "/users/u-1/leaderboard-status",
      { status: "visible", reason: "ignored when visible" },
    );

    expect(status).toBe(200);
    const updateArg = mockedPrisma.user.update.mock.calls[0][0];
    expect(updateArg.data.leaderboardStatus).toBe("visible");
    expect(updateArg.data.leaderboardStatusReason).toBeNull();
  });

  it("returns 404 when the user does not exist", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const { status, body } = await requestAdmin(
      "PATCH",
      "/users/ghost/leaderboard-status",
      { status: "hidden_admin" },
    );

    expect(status).toBe(404);
    expect(body.error).toMatch(/non trouv/i);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid status value (Zod validation)", async () => {
    const { status, body } = await requestAdmin(
      "PATCH",
      "/users/u-1/leaderboard-status",
      { status: "banned" },
    );

    expect(status).toBe(400);
    expect(body).toBeDefined();
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 when reason exceeds 500 chars", async () => {
    const { status } = await requestAdmin(
      "PATCH",
      "/users/u-1/leaderboard-status",
      { status: "hidden_admin", reason: "x".repeat(501) },
    );
    expect(status).toBe(400);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });
});
