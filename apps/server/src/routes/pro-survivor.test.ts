/**
 * Tests integration des endpoints pro-survivor.
 *
 * Couvre : overview public, picks (auth), me, standings, mapping
 * SurvivorError → HTTP status.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueSeason: { findUnique: vi.fn() },
    proLeagueRound: { findFirst: vi.fn() },
    proLeagueMatch: { findMany: vi.fn() },
  },
}));

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = { id: "user-1", role: "user" };
    return next();
  },
}));

vi.mock("../services/pro-survivor", () => {
  class SurvivorError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "SurvivorError";
    }
  }
  return {
    SurvivorError,
    submitSurvivorPick: vi.fn(),
    getMySurvivorStatus: vi.fn(),
    getSurvivorStandings: vi.fn(),
  };
});

import express from "express";
import http from "http";
import router from "./pro-survivor";
import { prisma } from "../prisma";
import {
  submitSurvivorPick,
  getMySurvivorStatus,
  getSurvivorStandings,
  SurvivorError,
} from "../services/pro-survivor";

const submit = vi.mocked(submitSurvivorPick);
const myStatus = vi.mocked(getMySurvivorStatus);
const standings = vi.mocked(getSurvivorStandings);

const mockedPrisma = prisma as unknown as {
  proLeagueSeason: { findUnique: ReturnType<typeof vi.fn> };
  proLeagueRound: { findFirst: ReturnType<typeof vi.fn> };
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn> };
};

async function request(
  method: "GET" | "POST",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/pro-league/survivor", router);
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
          path: `/pro-league/survivor${path}`,
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
  vi.resetAllMocks();
});

describe("GET /pro-league/survivor/seasons/:id/overview", () => {
  it("retourne saison + round courant + matchs", async () => {
    mockedPrisma.proLeagueSeason.findUnique.mockResolvedValueOnce({
      id: "s1",
      year: 2026,
      status: "in_progress",
    });
    mockedPrisma.proLeagueRound.findFirst.mockResolvedValueOnce({
      id: "r1",
      roundNumber: 5,
      scheduledAt: new Date(),
    });
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        homeTeamId: "t1",
        awayTeamId: "t2",
        scheduledAt: new Date(),
      },
    ]);

    const res = await request("GET", "/seasons/s1/overview");

    expect(res.status).toBe(200);
    expect(res.body.season.id).toBe("s1");
    expect(res.body.currentRound.roundNumber).toBe(5);
    expect(res.body.currentMatches).toHaveLength(1);
  });

  it("404 si saison introuvable", async () => {
    mockedPrisma.proLeagueSeason.findUnique.mockResolvedValueOnce(null);
    const res = await request("GET", "/seasons/x/overview");
    expect(res.status).toBe(404);
  });

  it("currentRound null si aucun round pending (saison terminee)", async () => {
    mockedPrisma.proLeagueSeason.findUnique.mockResolvedValueOnce({
      id: "s1",
      year: 2026,
      status: "completed",
    });
    mockedPrisma.proLeagueRound.findFirst.mockResolvedValueOnce(null);

    const res = await request("GET", "/seasons/s1/overview");

    expect(res.status).toBe(200);
    expect(res.body.currentRound).toBeNull();
    expect(res.body.currentMatches).toEqual([]);
  });
});

describe("GET /pro-league/survivor/seasons/:id/standings", () => {
  it("retourne standings ordonnes", async () => {
    standings.mockResolvedValueOnce([
      {
        userId: "u1",
        userName: "Alice",
        userEmail: "a@x.com",
        weeksSurvived: 5,
        isAlive: true,
      },
    ]);

    const res = await request("GET", "/seasons/s1/standings");

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].weeksSurvived).toBe(5);
  });
});

describe("POST /pro-league/survivor/picks", () => {
  it("201 + entry retournee", async () => {
    submit.mockResolvedValueOnce({
      entryId: "e1",
      seasonId: "s1",
      userId: "user-1",
      roundId: "r1",
      weekN: 1,
      pickedTeamId: "team-A",
      status: "pending",
    });

    const res = await request("POST", "/picks", {
      seasonId: "s1",
      roundId: "r1",
      teamId: "team-A",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      entryId: "e1",
      status: "pending",
    });
    expect(submit).toHaveBeenCalledWith({
      seasonId: "s1",
      userId: "user-1",
      roundId: "r1",
      teamId: "team-A",
    });
  });

  it("400 validation Zod si body incomplet", async () => {
    const res = await request("POST", "/picks", { seasonId: "s1" });
    expect(res.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it("404 ROUND_NOT_FOUND", async () => {
    submit.mockRejectedValueOnce(
      new SurvivorError("ROUND_NOT_FOUND", "introuvable") as any,
    );
    const res = await request("POST", "/picks", {
      seasonId: "s1",
      roundId: "x",
      teamId: "t1",
    });
    expect(res.status).toBe(404);
  });

  it("409 TEAM_ALREADY_PICKED", async () => {
    submit.mockRejectedValueOnce(
      new SurvivorError("TEAM_ALREADY_PICKED", "deja") as any,
    );
    const res = await request("POST", "/picks", {
      seasonId: "s1",
      roundId: "r1",
      teamId: "t1",
    });
    expect(res.status).toBe(409);
  });

  it("409 ROUND_LOCKED", async () => {
    submit.mockRejectedValueOnce(
      new SurvivorError("ROUND_LOCKED", "verrou") as any,
    );
    const res = await request("POST", "/picks", {
      seasonId: "s1",
      roundId: "r1",
      teamId: "t1",
    });
    expect(res.status).toBe(409);
  });

  it("409 ALREADY_ELIMINATED", async () => {
    submit.mockRejectedValueOnce(
      new SurvivorError("ALREADY_ELIMINATED", "out") as any,
    );
    const res = await request("POST", "/picks", {
      seasonId: "s1",
      roundId: "r1",
      teamId: "t1",
    });
    expect(res.status).toBe(409);
  });
});

describe("GET /pro-league/survivor/seasons/:id/me", () => {
  it("retourne le statut personnel", async () => {
    myStatus.mockResolvedValueOnce({
      seasonId: "s1",
      isAlive: true,
      entries: [],
      pickedTeamIds: [],
    });

    const res = await request("GET", "/seasons/s1/me");

    expect(res.status).toBe(200);
    expect(res.body.isAlive).toBe(true);
    expect(myStatus).toHaveBeenCalledWith("s1", "user-1");
  });
});
