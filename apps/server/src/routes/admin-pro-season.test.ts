/**
 * Lot P.B.3 — Tests integration des endpoints admin-pro-season.
 *
 * Couvre les 6 endpoints : GET list, clone, regenerate-schedule,
 * reset-standings, cancel, force-forfeit. Verifie audit log + mapping
 * SeasonFactoryError → HTTP status.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueSeason: { findMany: vi.fn() },
    proLeagueMatch: { groupBy: vi.fn() },
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

vi.mock("../services/pro-season-factory", () => {
  class SeasonFactoryError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "SeasonFactoryError";
    }
  }
  return {
    cloneSeason: vi.fn(),
    resetStandings: vi.fn(),
    cancelSeason: vi.fn(),
    forceForfeit: vi.fn(),
    SeasonFactoryError,
  };
});

vi.mock("../services/pro-league-scheduler", () => ({
  regenerateProLeagueSchedule: vi.fn(),
}));

import express from "express";
import http from "http";
import seasonRouter from "./admin-pro-season";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import {
  cloneSeason as cloneSeasonMock,
  resetStandings as resetStandingsMock,
  cancelSeason as cancelSeasonMock,
  forceForfeit as forceForfeitMock,
  SeasonFactoryError,
} from "../services/pro-season-factory";
import { regenerateProLeagueSchedule as regenerateMock } from "../services/pro-league-scheduler";

const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);
const cloneSeason = vi.mocked(cloneSeasonMock);
const resetStandings = vi.mocked(resetStandingsMock);
const cancelSeason = vi.mocked(cancelSeasonMock);
const forceForfeit = vi.mocked(forceForfeitMock);
const regenerate = vi.mocked(regenerateMock);

interface MockedPrisma {
  proLeagueSeason: { findMany: ReturnType<typeof vi.fn> };
  proLeagueMatch: { groupBy: ReturnType<typeof vi.fn> };
}

const mockedPrisma = prisma as unknown as MockedPrisma;

async function request(
  method: "GET" | "POST",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin/pro-league", seasonRouter);
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

describe("GET /admin/pro-league/seasons", () => {
  it("liste les saisons avec counters", async () => {
    mockedPrisma.proLeagueSeason.findMany.mockResolvedValueOnce([
      {
        id: "s1",
        leagueId: "l1",
        year: 2026,
        status: "in_progress",
        driverKind: "hybrid",
        engineVer: "0.16.0",
        startsAt: null,
        endsAt: null,
        createdAt: new Date("2026-01-01"),
        _count: { rounds: 15, matches: 120 },
      },
    ]);
    mockedPrisma.proLeagueMatch.groupBy.mockResolvedValueOnce([
      { seasonId: "s1", _count: { _all: 80 } },
    ]);

    const res = await request("GET", "/seasons");

    expect(res.status).toBe(200);
    expect(res.body.seasons).toHaveLength(1);
    expect(res.body.seasons[0]).toMatchObject({
      id: "s1",
      year: 2026,
      roundCount: 15,
      matchCount: 120,
      playedCount: 80,
    });
  });

  it("liste vide si aucune saison (pas de groupBy inutile)", async () => {
    mockedPrisma.proLeagueSeason.findMany.mockResolvedValueOnce([]);

    const res = await request("GET", "/seasons");

    expect(res.status).toBe(200);
    expect(res.body.seasons).toEqual([]);
    expect(mockedPrisma.proLeagueMatch.groupBy).not.toHaveBeenCalled();
  });
});

describe("POST /admin/pro-league/seasons/clone", () => {
  it("clone OK : audit log + result", async () => {
    cloneSeason.mockResolvedValueOnce({
      newSeasonId: "new-s",
      fromSeasonId: "s1",
      year: 2027,
    });

    const res = await request("POST", "/seasons/clone", {
      fromSeasonId: "s1",
      year: 2027,
    });

    expect(res.status).toBe(200);
    expect(res.body.newSeasonId).toBe("new-s");
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({ action: "pro-season.clone" }),
    );
  });

  it("400 si schema invalide (year manquant)", async () => {
    const res = await request("POST", "/seasons/clone", { fromSeasonId: "s1" });
    expect(res.status).toBe(400);
    expect(cloneSeason).not.toHaveBeenCalled();
  });

  it("409 si DUPLICATE_YEAR", async () => {
    cloneSeason.mockRejectedValueOnce(
      new SeasonFactoryError("DUPLICATE_YEAR", "year deja pris"),
    );
    const res = await request("POST", "/seasons/clone", {
      fromSeasonId: "s1",
      year: 2026,
    });
    expect(res.status).toBe(409);
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("404 si SEASON_NOT_FOUND", async () => {
    cloneSeason.mockRejectedValueOnce(
      new SeasonFactoryError("SEASON_NOT_FOUND", "introuvable"),
    );
    const res = await request("POST", "/seasons/clone", {
      fromSeasonId: "ghost",
      year: 2027,
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /admin/pro-league/seasons/:id/regenerate-schedule", () => {
  it("regenere OK", async () => {
    regenerate.mockResolvedValueOnce({
      seasonId: "s1",
      roundsCreated: 15,
      matchesCreated: 120,
      idempotentSkip: false,
    });
    const res = await request("POST", "/seasons/s1/regenerate-schedule");
    expect(res.status).toBe(200);
    expect(res.body.roundsCreated).toBe(15);
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "pro-season.regenerate-schedule",
        newValue: expect.objectContaining({ roundsCreated: 15 }),
      }),
    );
  });

  it("404 si saison introuvable (message contient 'introuvable')", async () => {
    regenerate.mockRejectedValueOnce(new Error("Saison 'ghost' introuvable"));
    const res = await request("POST", "/seasons/ghost/regenerate-schedule");
    expect(res.status).toBe(404);
  });

  it("409 si match deja simule", async () => {
    regenerate.mockRejectedValueOnce(
      new Error("Impossible de régénérer : 1 match(s) déjà simulé(s)"),
    );
    const res = await request("POST", "/seasons/s1/regenerate-schedule");
    expect(res.status).toBe(409);
  });
});

describe("POST /admin/pro-league/seasons/:id/reset-standings", () => {
  it("reset OK + audit", async () => {
    resetStandings.mockResolvedValueOnce({ seasonId: "s1", resetCount: 16 });
    const res = await request("POST", "/seasons/s1/reset-standings");
    expect(res.status).toBe(200);
    expect(res.body.resetCount).toBe(16);
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({ action: "pro-season.reset-standings" }),
    );
  });

  it("404 si SEASON_NOT_FOUND", async () => {
    resetStandings.mockRejectedValueOnce(
      new SeasonFactoryError("SEASON_NOT_FOUND", "x"),
    );
    const res = await request("POST", "/seasons/ghost/reset-standings");
    expect(res.status).toBe(404);
  });

  it("409 si SEASON_HAS_RESULTS (archived)", async () => {
    resetStandings.mockRejectedValueOnce(
      new SeasonFactoryError("SEASON_HAS_RESULTS", "archived"),
    );
    const res = await request("POST", "/seasons/s1/reset-standings");
    expect(res.status).toBe(409);
  });
});

describe("POST /admin/pro-league/seasons/:id/cancel", () => {
  it("cancel OK", async () => {
    cancelSeason.mockResolvedValueOnce({
      seasonId: "s1",
      previousStatus: "in_progress",
    });
    const res = await request("POST", "/seasons/s1/cancel");
    expect(res.status).toBe(200);
    expect(res.body.previousStatus).toBe("in_progress");
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "pro-season.cancel",
        newValue: { status: "cancelled" },
      }),
    );
  });
});

describe("POST /admin/pro-league/matches/:id/force-forfeit", () => {
  it("forfait home OK + audit", async () => {
    forceForfeit.mockResolvedValueOnce({
      matchId: "m1",
      winnerSide: "home",
      previousStatus: "scheduled",
    });
    const res = await request("POST", "/matches/m1/force-forfeit", {
      winnerSide: "home",
    });
    expect(res.status).toBe(200);
    expect(res.body.winnerSide).toBe("home");
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "pro-season.force-forfeit",
        newValue: expect.objectContaining({ winnerSide: "home" }),
      }),
    );
  });

  it("400 si winnerSide invalide", async () => {
    const res = await request("POST", "/matches/m1/force-forfeit", {
      winnerSide: "neutral",
    });
    expect(res.status).toBe(400);
    expect(forceForfeit).not.toHaveBeenCalled();
  });

  it("409 si MATCH_ALREADY_COMPLETED", async () => {
    forceForfeit.mockRejectedValueOnce(
      new SeasonFactoryError("MATCH_ALREADY_COMPLETED", "deja"),
    );
    const res = await request("POST", "/matches/m1/force-forfeit", {
      winnerSide: "away",
    });
    expect(res.status).toBe(409);
  });

  it("404 si MATCH_NOT_FOUND", async () => {
    forceForfeit.mockRejectedValueOnce(
      new SeasonFactoryError("MATCH_NOT_FOUND", "introuvable"),
    );
    const res = await request("POST", "/matches/ghost/force-forfeit", {
      winnerSide: "home",
    });
    expect(res.status).toBe(404);
  });
});
