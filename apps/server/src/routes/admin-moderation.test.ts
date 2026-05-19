/**
 * Lot P.B.4 — Tests d'integration des endpoints de moderation admin :
 *  - POST /admin/matches/:id/forfeit
 *  - POST /admin/matches/:id/cancel
 *  - POST /admin/users/:id/ban
 *  - POST /admin/users/:id/unban
 *
 * Pattern : mock authUser / adminOnly pour bypasser l'authent, mock prisma
 * et `safeRecordAdminActionFromRequest` pour assert l'audit log. On expose
 * le router via http.createServer (supertest n'est pas dans les deps —
 * cf. CLAUDE.md).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    match: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      // Audit round 8 : admin ban utilise maintenant updateMany
      // conditionnel WHERE bannedUntil = previous.bannedUntil
      // (optimistic-lock).
      updateMany: vi.fn(async () => ({ count: 1 })),
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
  match: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

const mockedPrisma = prisma as unknown as MockedPrisma;
const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

async function requestAdmin(
  method: "POST",
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

describe("POST /admin/matches/:id/forfeit", () => {
  it("force le forfeit, set status=ended + champs forfeit + audit log", async () => {
    mockedPrisma.match.findUnique.mockResolvedValueOnce({
      status: "active",
      forfeitedAt: null,
      forfeitWinnerSide: null,
      forfeitReason: null,
      cancelledAt: null,
    });
    mockedPrisma.match.update.mockResolvedValueOnce({
      id: "match-1",
      status: "ended",
      forfeitedAt: new Date("2026-05-13T10:00:00Z"),
      forfeitWinnerSide: "A",
      forfeitReason: "no-show 30min",
    });

    const res = await requestAdmin("POST", "/matches/match-1/forfeit", {
      winnerSide: "A",
      reason: "no-show 30min",
    });

    expect(res.status).toBe(200);
    expect(res.body.match.status).toBe("ended");
    expect(res.body.match.forfeitWinnerSide).toBe("A");
    expect(mockedPrisma.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "match-1" },
        data: expect.objectContaining({
          status: "ended",
          forfeitWinnerSide: "A",
          forfeitReason: "no-show 30min",
        }),
      }),
    );
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "match.forfeit",
        entity: "Match",
        entityId: "match-1",
      }),
    );
  });

  it("refuse si le match est deja cancelled (409)", async () => {
    mockedPrisma.match.findUnique.mockResolvedValueOnce({
      status: "cancelled",
      forfeitedAt: null,
      forfeitWinnerSide: null,
      forfeitReason: null,
      cancelledAt: new Date("2026-05-13T09:00:00Z"),
    });

    const res = await requestAdmin("POST", "/matches/match-1/forfeit", {
      winnerSide: "B",
      reason: "no-show",
    });

    expect(res.status).toBe(409);
    expect(mockedPrisma.match.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("refuse si deja forfeite (409, idempotence stricte)", async () => {
    mockedPrisma.match.findUnique.mockResolvedValueOnce({
      status: "ended",
      forfeitedAt: new Date("2026-05-13T08:00:00Z"),
      forfeitWinnerSide: "A",
      forfeitReason: "prior forfeit",
      cancelledAt: null,
    });

    const res = await requestAdmin("POST", "/matches/match-1/forfeit", {
      winnerSide: "B",
      reason: "second attempt",
    });

    expect(res.status).toBe(409);
    expect(mockedPrisma.match.update).not.toHaveBeenCalled();
  });

  it("404 si le match n'existe pas", async () => {
    mockedPrisma.match.findUnique.mockResolvedValueOnce(null);

    const res = await requestAdmin("POST", "/matches/missing/forfeit", {
      winnerSide: "A",
      reason: "any",
    });

    expect(res.status).toBe(404);
  });

  it("400 si raison manquante / winnerSide invalide", async () => {
    const r1 = await requestAdmin("POST", "/matches/m/forfeit", {
      winnerSide: "C",
      reason: "ok",
    });
    expect(r1.status).toBe(400);
    const r2 = await requestAdmin("POST", "/matches/m/forfeit", {
      winnerSide: "A",
      reason: "ab",
    });
    expect(r2.status).toBe(400);
  });
});

describe("POST /admin/matches/:id/cancel", () => {
  it("annule le match et trace audit log", async () => {
    mockedPrisma.match.findUnique.mockResolvedValueOnce({
      status: "active",
      forfeitedAt: null,
      cancelledAt: null,
      cancelReason: null,
    });
    mockedPrisma.match.update.mockResolvedValueOnce({
      id: "match-2",
      status: "cancelled",
      cancelledAt: new Date("2026-05-13T11:00:00Z"),
      cancelReason: "exploit-bug",
    });

    const res = await requestAdmin("POST", "/matches/match-2/cancel", {
      reason: "exploit-bug",
    });

    expect(res.status).toBe(200);
    expect(res.body.match.status).toBe("cancelled");
    expect(res.body.match.cancelReason).toBe("exploit-bug");
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({ action: "match.cancel" }),
    );
  });

  it("refuse si deja forfeite", async () => {
    mockedPrisma.match.findUnique.mockResolvedValueOnce({
      status: "ended",
      forfeitedAt: new Date("2026-05-13T08:00:00Z"),
      cancelledAt: null,
      cancelReason: null,
    });

    const res = await requestAdmin("POST", "/matches/match-2/cancel", {
      reason: "after-forfeit",
    });
    expect(res.status).toBe(409);
  });

  it("refuse si deja annule", async () => {
    mockedPrisma.match.findUnique.mockResolvedValueOnce({
      status: "cancelled",
      forfeitedAt: null,
      cancelledAt: new Date("2026-05-13T08:00:00Z"),
      cancelReason: "first",
    });

    const res = await requestAdmin("POST", "/matches/match-2/cancel", {
      reason: "second",
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /admin/users/:id/ban", () => {
  // Audit round 8 : admin ban utilise updateMany conditionnel +
  // re-fetch. Le `user.update` est remplace par `user.updateMany` +
  // `user.findUnique` post-update.
  it("ban temporaire : bannedUntil = now + durationDays", async () => {
    mockedPrisma.user.findUnique
      .mockResolvedValueOnce({
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
        role: "user",
        roles: ["user"],
      })
      .mockResolvedValueOnce({
        id: "user-99",
        email: "toxic@example.com",
        coachName: "toxic",
        bannedAt: new Date("2026-05-13T10:00:00Z"),
        bannedUntil: new Date("2026-05-20T10:00:00Z"),
        banReason: "comportement toxique",
      });

    const res = await requestAdmin("POST", "/users/user-99/ban", {
      reason: "comportement toxique",
      durationDays: 7,
    });

    expect(res.status).toBe(200);
    expect(res.body.user.banReason).toBe("comportement toxique");
    expect(res.body.user.bannedUntil).toBeDefined();
    // Verifie updateMany conditionnel : WHERE bannedUntil=null (initial).
    const updateCall = mockedPrisma.user.updateMany.mock.calls[0]![0];
    expect(updateCall.data.banReason).toBe("comportement toxique");
    expect(updateCall.data.bannedUntil).toBeInstanceOf(Date);
    expect(updateCall.where).toMatchObject({ id: "user-99", bannedUntil: null });
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "user.ban",
        entity: "User",
        entityId: "user-99",
      }),
    );
  });

  it("ban permanent : durationDays omis → bannedUntil = year 9999", async () => {
    mockedPrisma.user.findUnique
      .mockResolvedValueOnce({
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
        role: "user",
        roles: ["user"],
      })
      .mockResolvedValueOnce({
        id: "user-99",
        email: "x@x",
        coachName: "x",
        bannedAt: new Date(),
        bannedUntil: new Date("9999-12-31T23:59:59.999Z"),
        banReason: "fraude grave",
      });

    const res = await requestAdmin("POST", "/users/user-99/ban", {
      reason: "fraude grave",
    });

    expect(res.status).toBe(200);
    const updateCall = mockedPrisma.user.updateMany.mock.calls[0]![0];
    const bUntil = updateCall.data.bannedUntil as Date;
    expect(bUntil.getFullYear()).toBeGreaterThan(9000);
  });

  it("etend la duree existante si plus longue (idempotence preserve la fin la plus tardive)", async () => {
    const longerFuture = new Date("2027-01-01T00:00:00Z");
    mockedPrisma.user.findUnique
      .mockResolvedValueOnce({
        bannedAt: new Date("2026-05-01T00:00:00Z"),
        bannedUntil: longerFuture,
        banReason: "ban initial 1 an",
        role: "user",
        roles: ["user"],
      })
      .mockResolvedValueOnce({
        id: "user-99",
        email: "x@x",
        coachName: "x",
        bannedAt: new Date("2026-05-01T00:00:00Z"),
        bannedUntil: longerFuture,
        banReason: "raison mise a jour",
      });

    const res = await requestAdmin("POST", "/users/user-99/ban", {
      reason: "raison mise a jour",
      durationDays: 1,
    });

    expect(res.status).toBe(200);
    const updateCall = mockedPrisma.user.updateMany.mock.calls[0]![0];
    expect((updateCall.data.bannedUntil as Date).getTime()).toBe(
      longerFuture.getTime(),
    );
    expect(updateCall.data.banReason).toBe("raison mise a jour");
  });

  it("refuse de se bannir soi-meme (400)", async () => {
    const res = await requestAdmin("POST", "/users/admin-1/ban", {
      reason: "auto-test",
      durationDays: 1,
    });
    expect(res.status).toBe(400);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("404 si user inexistant", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await requestAdmin("POST", "/users/ghost/ban", {
      reason: "no body to ban",
    });
    expect(res.status).toBe(404);
  });

  it("400 si raison trop courte", async () => {
    const res = await requestAdmin("POST", "/users/x/ban", {
      reason: "ab",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /admin/users/:id/unban", () => {
  it("clear bannedAt/bannedUntil/banReason et trace audit", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      bannedAt: new Date("2026-05-01T00:00:00Z"),
      bannedUntil: new Date("2026-06-01T00:00:00Z"),
      banReason: "ancienne raison",
    });
    mockedPrisma.user.update.mockResolvedValueOnce({
      id: "user-77",
      email: "u@u",
      coachName: "u",
      bannedAt: null,
      bannedUntil: null,
      banReason: null,
    });

    const res = await requestAdmin("POST", "/users/user-77/unban", null);

    expect(res.status).toBe(200);
    expect(res.body.user.bannedAt).toBe(null);
    expect(res.body.user.bannedUntil).toBe(null);
    expect(res.body.user.banReason).toBe(null);
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({ action: "user.unban" }),
    );
  });

  it("404 si user inexistant", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await requestAdmin("POST", "/users/ghost/unban", null);
    expect(res.status).toBe(404);
  });
});
