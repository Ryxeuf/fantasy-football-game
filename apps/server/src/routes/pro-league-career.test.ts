/**
 * Tests integration du endpoint /pro-league/players/:id/career.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {},
}));

vi.mock("../services/pro-player-career-stats", () => {
  class PlayerCareerNotFoundError extends Error {
    constructor(playerId: string) {
      super(`Player ${playerId} not found`);
      this.name = "PlayerCareerNotFoundError";
    }
  }
  return {
    PlayerCareerNotFoundError,
    getCareerSnapshot: vi.fn(),
  };
});

import express from "express";
import http from "http";
import {
  handleGetPlayerCareer,
} from "./pro-league";
import {
  getCareerSnapshot,
  PlayerCareerNotFoundError,
} from "../services/pro-player-career-stats";

const mockedGetSnapshot = vi.mocked(getCareerSnapshot);

async function request(
  method: "GET",
  path: string,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.get("/pro-league/players/:id/career", handleGetPlayerCareer);
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
          path,
          method,
          headers: { "Content-Type": "application/json" },
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

describe("GET /pro-league/players/:id/career", () => {
  it("retourne le snapshot quand getCareerSnapshot resout", async () => {
    mockedGetSnapshot.mockResolvedValueOnce({
      playerId: "p1",
      matchesPlayed: 12,
      tdTotal: 5,
      casTotal: 3,
      compTotal: 2,
      mvpTotal: 1,
      sppTotal: 50,
      bestMatchId: "m-best",
      bestMatchSpp: 12,
      worstMatchId: "m-worst",
      worstMatchSpp: 0,
      topNemesisTeamId: "team-nemesis",
      topVictoryTeamId: "team-easy",
      streakKind: "win",
      streakLength: 3,
      recomputedAt: new Date("2026-05-17T10:00:00Z"),
    });

    const res = await request("GET", "/pro-league/players/p1/career");

    expect(res.status).toBe(200);
    expect(res.body.snapshot).toMatchObject({
      playerId: "p1",
      matchesPlayed: 12,
      sppTotal: 50,
      streakKind: "win",
      streakLength: 3,
      topNemesisTeamId: "team-nemesis",
      topVictoryTeamId: "team-easy",
    });
    expect(mockedGetSnapshot).toHaveBeenCalledWith("p1");
  });

  it("404 si PlayerCareerNotFoundError", async () => {
    mockedGetSnapshot.mockRejectedValueOnce(
      new PlayerCareerNotFoundError("ghost") as any,
    );
    const res = await request("GET", "/pro-league/players/ghost/career");
    expect(res.status).toBe(404);
  });

  it("500 si erreur generique", async () => {
    mockedGetSnapshot.mockRejectedValueOnce(new Error("boom"));
    const res = await request("GET", "/pro-league/players/x/career");
    expect(res.status).toBe(500);
  });
});
