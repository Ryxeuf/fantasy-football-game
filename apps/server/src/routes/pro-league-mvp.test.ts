/**
 * Tests integration des endpoints MVP vote (Q.B.1).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

vi.mock("../services/pro-mvp-vote", () => {
  class MvpError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "MvpError";
    }
  }
  return {
    MvpError,
    getMvpCandidates: vi.fn(),
    submitVote: vi.fn(),
    getVoteTally: vi.fn(),
    getWeeklyMvpLeaderboard: vi.fn(),
  };
});

import express from "express";
import http from "http";
import {
  handleGetMvpCandidates,
  handleGetMvpTally,
  handleSubmitMvpVote,
  handleGetWeeklyMvp,
} from "./pro-league";
import {
  MvpError,
  getMvpCandidates,
  submitVote,
  getVoteTally,
  getWeeklyMvpLeaderboard,
} from "../services/pro-mvp-vote";

const mockedCandidates = vi.mocked(getMvpCandidates);
const mockedSubmit = vi.mocked(submitVote);
const mockedTally = vi.mocked(getVoteTally);
const mockedWeekly = vi.mocked(getWeeklyMvpLeaderboard);

async function request(
  method: "GET" | "POST",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.get("/api/pro-league/matches/:id/mvp-candidates", handleGetMvpCandidates);
  app.get("/api/pro-league/matches/:id/mvp-tally", handleGetMvpTally);
  app.post(
    "/api/pro-league/matches/:id/mvp-vote",
    (req, _res, next) => {
      (req as any).user = { id: "user-1" };
      next();
    },
    handleSubmitMvpVote,
  );
  app.get("/api/pro-league/mvp/weekly", handleGetWeeklyMvp);
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
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
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

describe("GET /pro-league/matches/:id/mvp-candidates", () => {
  it("retourne la liste des candidats", async () => {
    mockedCandidates.mockResolvedValueOnce([
      {
        rosterId: "p1",
        name: "Grott",
        position: "Lineman",
        teamSlug: "tA",
        teamName: "Athletics",
        sppGained: 9,
        tdCount: 1,
        casCount: 2,
        mvpCount: 1,
      },
    ]);
    const res = await request(
      "GET",
      "/api/pro-league/matches/m1/mvp-candidates",
    );
    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.candidates[0].sppGained).toBe(9);
  });

  it("404 MATCH_NOT_FOUND", async () => {
    mockedCandidates.mockRejectedValueOnce(
      new MvpError("MATCH_NOT_FOUND", "introuvable") as any,
    );
    const res = await request(
      "GET",
      "/api/pro-league/matches/x/mvp-candidates",
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /pro-league/matches/:id/mvp-tally", () => {
  it("retourne le tally", async () => {
    mockedTally.mockResolvedValueOnce({
      matchId: "m1",
      totalVotes: 5,
      entries: [
        { rosterId: "p1", count: 3 },
        { rosterId: "p2", count: 2 },
      ],
      winnerRosterId: "p1",
      windowClosesAt: "2026-05-20T10:00:00.000Z",
    });
    const res = await request("GET", "/api/pro-league/matches/m1/mvp-tally");
    expect(res.status).toBe(200);
    expect(res.body.winnerRosterId).toBe("p1");
    expect(res.body.entries).toHaveLength(2);
  });

  it("404 MATCH_NOT_FOUND", async () => {
    mockedTally.mockRejectedValueOnce(
      new MvpError("MATCH_NOT_FOUND", "introuvable") as any,
    );
    const res = await request("GET", "/api/pro-league/matches/x/mvp-tally");
    expect(res.status).toBe(404);
  });
});

describe("POST /pro-league/matches/:id/mvp-vote", () => {
  it("201 si premier vote", async () => {
    mockedSubmit.mockResolvedValueOnce({
      voteId: "v1",
      matchId: "m1",
      votedRosterId: "p1",
      isUpdate: false,
    });
    const res = await request("POST", "/api/pro-league/matches/m1/mvp-vote", {
      votedRosterId: "p1",
    });
    expect(res.status).toBe(201);
    expect(res.body.isUpdate).toBe(false);
    expect(mockedSubmit).toHaveBeenCalledWith({
      userId: "user-1",
      matchId: "m1",
      votedRosterId: "p1",
    });
  });

  it("200 si update", async () => {
    mockedSubmit.mockResolvedValueOnce({
      voteId: "v1",
      matchId: "m1",
      votedRosterId: "p2",
      isUpdate: true,
    });
    const res = await request("POST", "/api/pro-league/matches/m1/mvp-vote", {
      votedRosterId: "p2",
    });
    expect(res.status).toBe(200);
    expect(res.body.isUpdate).toBe(true);
  });

  it("400 si votedRosterId manquant", async () => {
    const res = await request("POST", "/api/pro-league/matches/m1/mvp-vote", {});
    expect(res.status).toBe(400);
  });

  it("409 VOTE_WINDOW_CLOSED", async () => {
    mockedSubmit.mockRejectedValueOnce(
      new MvpError("VOTE_WINDOW_CLOSED", "ferme") as any,
    );
    const res = await request("POST", "/api/pro-league/matches/m1/mvp-vote", {
      votedRosterId: "p1",
    });
    expect(res.status).toBe(409);
  });

  it("422 MATCH_NOT_COMPLETED", async () => {
    mockedSubmit.mockRejectedValueOnce(
      new MvpError("MATCH_NOT_COMPLETED", "pas fini") as any,
    );
    const res = await request("POST", "/api/pro-league/matches/m1/mvp-vote", {
      votedRosterId: "p1",
    });
    expect(res.status).toBe(422);
  });

  it("409 INVALID_CANDIDATE", async () => {
    mockedSubmit.mockRejectedValueOnce(
      new MvpError("INVALID_CANDIDATE", "wrong") as any,
    );
    const res = await request("POST", "/api/pro-league/matches/m1/mvp-vote", {
      votedRosterId: "wrong",
    });
    expect(res.status).toBe(409);
  });
});

describe("GET /pro-league/mvp/weekly", () => {
  it("retourne le leaderboard", async () => {
    mockedWeekly.mockResolvedValueOnce([
      {
        rosterId: "p1",
        name: "Star Player",
        position: "Blitzer",
        teamSlug: "tA",
        teamName: "Athletics",
        voteCount: 12,
      },
    ]);
    const res = await request("GET", "/api/pro-league/mvp/weekly?limit=5");
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(mockedWeekly).toHaveBeenCalledWith(5);
  });

  it("limit default = 10", async () => {
    mockedWeekly.mockResolvedValueOnce([]);
    await request("GET", "/api/pro-league/mvp/weekly");
    expect(mockedWeekly).toHaveBeenCalledWith(10);
  });

  it("cap limit a 50", async () => {
    mockedWeekly.mockResolvedValueOnce([]);
    await request("GET", "/api/pro-league/mvp/weekly?limit=999");
    expect(mockedWeekly).toHaveBeenCalledWith(50);
  });
});
