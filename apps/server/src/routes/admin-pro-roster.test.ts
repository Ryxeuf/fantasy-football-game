/**
 * Tests integration des endpoints admin-pro-roster.
 *
 * Couvre : GET roster, POST replenish, POST regenerate (success +
 * erreurs), POST retire, audit log, mapping RosterAdminError → HTTP.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeam: { findUnique: vi.fn() },
    proTeamRoster: { findMany: vi.fn() },
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

vi.mock("../services/pro-roster-generator", () => ({
  replenishTeamRoster: vi.fn(),
}));

vi.mock("../services/pro-roster-admin", () => {
  class RosterAdminError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "RosterAdminError";
    }
  }
  return {
    regenerateRoster: vi.fn(),
    retirePlayer: vi.fn(),
    RosterAdminError,
  };
});

import express from "express";
import http from "http";
import rosterRouter from "./admin-pro-roster";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { replenishTeamRoster as replenishMock } from "../services/pro-roster-generator";
import {
  regenerateRoster as regenerateMock,
  retirePlayer as retireMock,
  RosterAdminError,
} from "../services/pro-roster-admin";

const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);
const replenish = vi.mocked(replenishMock);
const regenerate = vi.mocked(regenerateMock);
const retire = vi.mocked(retireMock);

const mockedPrisma = prisma as unknown as {
  proTeam: { findUnique: ReturnType<typeof vi.fn> };
  proTeamRoster: { findMany: ReturnType<typeof vi.fn> };
};

async function request(
  method: "GET" | "POST",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin/pro-league", rosterRouter);
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
          path: `/admin/pro-league${path}`,
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

const teamFixture = {
  id: "t1",
  slug: "pit-smashers",
  city: "Pittsburgh",
  name: "Smashers",
  race: "Orc",
};

const playerFixture = {
  id: "p1",
  teamId: "t1",
  name: "Grott Steelfist",
  position: "Lineman",
  ma: 5,
  st: 3,
  ag: 3,
  pa: 4,
  av: 10,
  skills: ["block"],
  niggling: 0,
  maReduction: 0,
  stReduction: 0,
  agReduction: 0,
  avReduction: 0,
  status: "active",
  form: 60,
  spp: 12,
  level: 2,
  tvCached: 70000,
  tdCount: 3,
  casCount: 2,
  compCount: 1,
  mvpCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /admin/pro-league/teams/:id/roster", () => {
  it("retourne le roster complet avec counters", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamFixture);
    mockedPrisma.proTeamRoster.findMany.mockResolvedValueOnce([
      playerFixture,
      { ...playerFixture, id: "p2", status: "injured" },
      { ...playerFixture, id: "p3", status: "dead" },
    ]);

    const res = await request("GET", "/teams/t1/roster");

    expect(res.status).toBe(200);
    expect(res.body.team).toMatchObject({ id: "t1", slug: "pit-smashers" });
    expect(res.body.counts).toEqual({
      total: 3,
      active: 1,
      injured: 1,
      dead: 1,
      retired: 0,
    });
    expect(res.body.players).toHaveLength(3);
    expect(res.body.players[0]).toMatchObject({
      id: "p1",
      name: "Grott Steelfist",
      level: 2,
      spp: 12,
    });
  });

  it("404 si team introuvable", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(null);
    const res = await request("GET", "/teams/missing/roster");
    expect(res.status).toBe(404);
  });

  it("parse skills depuis string sqlite", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamFixture);
    mockedPrisma.proTeamRoster.findMany.mockResolvedValueOnce([
      { ...playerFixture, skills: JSON.stringify(["block", "tackle"]) },
    ]);
    const res = await request("GET", "/teams/t1/roster");
    expect(res.body.players[0].skills).toEqual(["block", "tackle"]);
  });

  it("skills array vide si format invalide", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamFixture);
    mockedPrisma.proTeamRoster.findMany.mockResolvedValueOnce([
      { ...playerFixture, skills: "{notjson" },
    ]);
    const res = await request("GET", "/teams/t1/roster");
    expect(res.body.players[0].skills).toEqual([]);
  });
});

describe("POST /admin/pro-league/teams/:id/roster/replenish", () => {
  it("replenit jusqu'a target et trace audit", async () => {
    replenish.mockResolvedValueOnce({
      teamId: "t1",
      activeBefore: 8,
      created: 4,
      targetSize: 12,
    });

    const res = await request("POST", "/teams/t1/roster/replenish", {
      targetSize: 12,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: 4, targetSize: 12 });
    expect(replenish).toHaveBeenCalledWith("t1", 12);
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    const auditArg = mockedAudit.mock.calls[0][2];
    expect(auditArg.action).toBe("pro-roster.replenish");
  });

  it("targetSize optionnel utilise default service", async () => {
    replenish.mockResolvedValueOnce({
      teamId: "t1",
      activeBefore: 12,
      created: 0,
      targetSize: 12,
    });

    await request("POST", "/teams/t1/roster/replenish", {});

    expect(replenish).toHaveBeenCalledWith("t1", undefined);
  });

  it("rejette targetSize > 30 (validation)", async () => {
    const res = await request("POST", "/teams/t1/roster/replenish", {
      targetSize: 50,
    });
    expect(res.status).toBe(400);
  });

  it("404 si team introuvable (service throws)", async () => {
    replenish.mockRejectedValueOnce(new Error("ProTeam 'x' introuvable"));
    const res = await request("POST", "/teams/x/roster/replenish", {});
    expect(res.status).toBe(404);
  });
});

describe("POST /admin/pro-league/teams/:id/roster/regenerate", () => {
  it("regenere avec count + trace audit destructif", async () => {
    regenerate.mockResolvedValueOnce({
      teamId: "t1",
      deleted: 12,
      created: 12,
    });

    const res = await request("POST", "/teams/t1/roster/regenerate", {
      count: 12,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: 12, created: 12 });
    expect(regenerate).toHaveBeenCalledWith({ teamId: "t1", count: 12 });
    const auditArg = mockedAudit.mock.calls[0][2];
    expect(auditArg.action).toBe("pro-roster.regenerate");
    expect(auditArg.oldValue).toEqual({ deleted: 12 });
  });

  it("count default = 12 si non fourni", async () => {
    regenerate.mockResolvedValueOnce({
      teamId: "t1",
      deleted: 0,
      created: 12,
    });
    await request("POST", "/teams/t1/roster/regenerate", {});
    expect(regenerate).toHaveBeenCalledWith({ teamId: "t1", count: 12 });
  });

  it("404 quand TEAM_NOT_FOUND", async () => {
    regenerate.mockRejectedValueOnce(
      new RosterAdminError("TEAM_NOT_FOUND", "introuvable") as any,
    );
    const res = await request("POST", "/teams/x/roster/regenerate", {
      count: 12,
    });
    expect(res.status).toBe(404);
  });

  it("400 quand INVALID_INPUT", async () => {
    regenerate.mockRejectedValueOnce(
      new RosterAdminError("INVALID_INPUT", "invalide") as any,
    );
    const res = await request("POST", "/teams/t1/roster/regenerate", {
      count: 5,
    });
    expect(res.status).toBe(400);
  });

  it("rejette count > 30 a la validation", async () => {
    const res = await request("POST", "/teams/t1/roster/regenerate", {
      count: 99,
    });
    expect(res.status).toBe(400);
    expect(regenerate).not.toHaveBeenCalled();
  });
});

describe("POST /admin/pro-league/rosters/:id/retire", () => {
  it("retire un joueur active + trace audit", async () => {
    retire.mockResolvedValueOnce({ playerId: "p1", previousStatus: "active" });

    const res = await request("POST", "/rosters/p1/retire");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ playerId: "p1", previousStatus: "active" });
    const auditArg = mockedAudit.mock.calls[0][2];
    expect(auditArg).toMatchObject({
      action: "pro-roster.retire",
      entity: "ProTeamRoster",
      entityId: "p1",
      oldValue: { status: "active" },
      newValue: { status: "retired" },
    });
  });

  it("404 si joueur introuvable", async () => {
    retire.mockRejectedValueOnce(
      new RosterAdminError("ROSTER_NOT_FOUND", "introuvable") as any,
    );
    const res = await request("POST", "/rosters/missing/retire");
    expect(res.status).toBe(404);
  });
});
