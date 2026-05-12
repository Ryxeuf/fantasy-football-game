/**
 * Tests integration des endpoints rivalry.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

vi.mock("../services/pro-league-rivalry", () => {
  class TeamNotFoundError extends Error {
    constructor(slug: string) {
      super(`ProTeam '${slug}' introuvable`);
      this.name = "TeamNotFoundError";
    }
  }
  return {
    TeamNotFoundError,
    getHeadToHead: vi.fn(),
    getTopRivals: vi.fn(),
  };
});

import express from "express";
import http from "http";
import {
  handleGetTeamRivalries,
  handleGetHeadToHead,
} from "./pro-league";
import {
  getTopRivals,
  getHeadToHead,
  TeamNotFoundError,
} from "../services/pro-league-rivalry";

const mockedTopRivals = vi.mocked(getTopRivals);
const mockedHeadToHead = vi.mocked(getHeadToHead);

async function request(
  method: "GET",
  path: string,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.get("/api/pro-league/teams/:slug/rivalries", handleGetTeamRivalries);
  app.get(
    "/api/pro-league/teams/:slug/head-to-head/:opponentSlug",
    handleGetHeadToHead,
  );
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

describe("GET /pro-league/teams/:slug/rivalries", () => {
  it("retourne la liste des rivaux", async () => {
    mockedTopRivals.mockResolvedValueOnce([
      {
        team: {
          id: "tB",
          slug: "team-b",
          city: "City B",
          name: "Beasts",
          race: "Orc",
          primaryColor: null,
          secondaryColor: null,
        },
        totalMatches: 5,
        winsFor: 3,
        winsAgainst: 1,
        draws: 1,
        lastMatch: null,
      },
    ]);

    const res = await request(
      "GET",
      "/api/pro-league/teams/team-a/rivalries",
    );

    expect(res.status).toBe(200);
    expect(res.body.rivals).toHaveLength(1);
    expect(res.body.rivals[0].team.slug).toBe("team-b");
    expect(res.body.rivals[0].totalMatches).toBe(5);
    expect(mockedTopRivals).toHaveBeenCalledWith("team-a", 3);
  });

  it("respecte le query param limit", async () => {
    mockedTopRivals.mockResolvedValueOnce([]);
    await request("GET", "/api/pro-league/teams/team-a/rivalries?limit=5");
    expect(mockedTopRivals).toHaveBeenCalledWith("team-a", 5);
  });

  it("cap limit a 10", async () => {
    mockedTopRivals.mockResolvedValueOnce([]);
    await request("GET", "/api/pro-league/teams/team-a/rivalries?limit=99");
    expect(mockedTopRivals).toHaveBeenCalledWith("team-a", 10);
  });

  it("404 si team introuvable", async () => {
    mockedTopRivals.mockRejectedValueOnce(
      new TeamNotFoundError("ghost") as any,
    );
    const res = await request(
      "GET",
      "/api/pro-league/teams/ghost/rivalries",
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /pro-league/teams/:slug/head-to-head/:opponentSlug", () => {
  it("retourne le summary", async () => {
    mockedHeadToHead.mockResolvedValueOnce({
      teamA: {
        id: "tA",
        slug: "team-a",
        city: "X",
        name: "Y",
        race: "Z",
        primaryColor: null,
        secondaryColor: null,
      },
      teamB: {
        id: "tB",
        slug: "team-b",
        city: "X",
        name: "Y",
        race: "Z",
        primaryColor: null,
        secondaryColor: null,
      },
      record: {
        totalMatches: 3,
        winsA: 1,
        winsB: 1,
        draws: 1,
        totalTdA: 5,
        totalTdB: 4,
      },
      lastMatch: null,
      streakA: { kind: "win", length: 1 },
      recentMatches: [],
    });

    const res = await request(
      "GET",
      "/api/pro-league/teams/team-a/head-to-head/team-b",
    );

    expect(res.status).toBe(200);
    expect(res.body.summary.record.winsA).toBe(1);
    expect(mockedHeadToHead).toHaveBeenCalledWith("team-a", "team-b");
  });

  it("400 si meme slug", async () => {
    const res = await request(
      "GET",
      "/api/pro-league/teams/team-a/head-to-head/team-a",
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("same-team");
    expect(mockedHeadToHead).not.toHaveBeenCalled();
  });

  it("404 si une team introuvable", async () => {
    mockedHeadToHead.mockRejectedValueOnce(
      new TeamNotFoundError("ghost") as any,
    );
    const res = await request(
      "GET",
      "/api/pro-league/teams/team-a/head-to-head/ghost",
    );
    expect(res.status).toBe(404);
  });
});
