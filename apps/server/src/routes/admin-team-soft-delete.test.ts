/**
 * `DELETE /admin/teams/:id` (soft delete) + `POST /admin/teams/:id/restore`.
 *
 * Le point vérifié ici est la BASCULE : la route hard-deletait joueurs, Star
 * Players puis l'équipe. Elle ne doit plus rien supprimer — seulement poser
 * `deletedAt` — et la restauration doit rendre l'équipe visible à nouveau.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/team-delete", () => {
  class TeamDeleteError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "TeamDeleteError";
    }
  }
  return {
    TeamDeleteError,
    adminSoftDeleteTeam: vi.fn(),
    restoreTeam: vi.fn(),
  };
});

vi.mock("../prisma", () => ({
  prisma: {
    team: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    teamPlayer: { deleteMany: vi.fn() },
    teamStarPlayer: { deleteMany: vi.fn() },
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
  getRefreshTokenStore: () => ({ revokeAllForUser: vi.fn(async () => {}) }),
}));

import express from "express";
import http from "http";
import adminRouter from "./admin";
import { prisma } from "../prisma";
import {
  adminSoftDeleteTeam,
  restoreTeam,
  TeamDeleteError,
} from "../services/team-delete";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

const mockedPrisma = prisma as any;
const mockedSoftDelete = vi.mocked(adminSoftDeleteTeam);
const mockedRestore = vi.mocked(restoreTeam);
const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

async function request(
  method: "DELETE" | "POST",
  path: string,
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
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/admin${path}`,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": "0",
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
      req.end();
    });
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DELETE /admin/teams/:id", () => {
  it("soft-delete : renvoie deletedAt et ne supprime AUCUNE ligne", async () => {
    const deletedAt = new Date("2026-08-01T12:00:00.000Z");
    mockedSoftDelete.mockResolvedValueOnce({
      deletedAt,
      teamName: "Les Rats",
      ownerId: "u-1",
      warnings: [],
    });

    const res = await request("DELETE", "/teams/team-1");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.deletedAt).toBe(deletedAt.toISOString());
    expect(mockedSoftDelete).toHaveBeenCalledWith({ teamId: "team-1" });
    // La régression à ne jamais réintroduire : plus aucun hard delete.
    expect(mockedPrisma.teamPlayer.deleteMany).not.toHaveBeenCalled();
    expect(mockedPrisma.teamStarPlayer.deleteMany).not.toHaveBeenCalled();
  });

  it("remonte les avertissements de compétition en cours", async () => {
    mockedSoftDelete.mockResolvedValueOnce({
      deletedAt: new Date(),
      teamName: "Les Rats",
      ownerId: "u-1",
      warnings: ["L'équipe était engagée dans la ligue « Chaos Cup »."],
    });

    const res = await request("DELETE", "/teams/team-1");

    expect(res.status).toBe(200);
    expect(res.body.warnings).toHaveLength(1);
    expect(res.body.warnings[0]).toContain("Chaos Cup");
  });

  it("journalise l'action admin team.delete", async () => {
    mockedSoftDelete.mockResolvedValueOnce({
      deletedAt: new Date(),
      teamName: "Les Rats",
      ownerId: "u-1",
      warnings: [],
    });

    await request("DELETE", "/teams/team-1");

    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "team.delete",
        entity: "Team",
        entityId: "team-1",
      }),
    );
  });

  it("404 si l'équipe n'existe pas", async () => {
    mockedSoftDelete.mockRejectedValueOnce(
      new TeamDeleteError("not_found", "Équipe non trouvée"),
    );

    const res = await request("DELETE", "/teams/ghost");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Équipe non trouvée");
  });

  it("409 si l'équipe est déjà supprimée", async () => {
    mockedSoftDelete.mockRejectedValueOnce(
      new TeamDeleteError("already_deleted", "Cette équipe est déjà supprimée"),
    );

    const res = await request("DELETE", "/teams/team-1");

    expect(res.status).toBe(409);
  });
});

describe("POST /admin/teams/:id/restore", () => {
  it("restaure et journalise team.restore", async () => {
    const previousDeletedAt = new Date("2026-05-01T10:00:00.000Z");
    mockedRestore.mockResolvedValueOnce({
      teamName: "Les Rats",
      ownerId: "u-1",
      previousDeletedAt,
    });

    const res = await request("POST", "/teams/team-1/restore");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockedRestore).toHaveBeenCalledWith({ teamId: "team-1" });
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "team.restore",
        entity: "Team",
        entityId: "team-1",
        newValue: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it("409 si l'équipe n'est pas supprimée", async () => {
    mockedRestore.mockRejectedValueOnce(
      new TeamDeleteError("not_deleted", "Cette équipe n'est pas supprimée"),
    );

    const res = await request("POST", "/teams/team-1/restore");

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Cette équipe n'est pas supprimée");
  });

  it("404 si l'équipe n'existe pas", async () => {
    mockedRestore.mockRejectedValueOnce(
      new TeamDeleteError("not_found", "Équipe non trouvée"),
    );

    const res = await request("POST", "/teams/ghost/restore");

    expect(res.status).toBe(404);
  });
});
