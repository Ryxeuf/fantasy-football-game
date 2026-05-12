/**
 * Tests integration du router pro-prediction-leagues.
 *
 * Couvre : create, list me, join, detail, leaderboard, pick + mapping
 * PredictionLeagueError → HTTP status + authorization (NOT_MEMBER 403).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proPredictionLeague: { findUnique: vi.fn() },
    proPredictionLeagueMember: { findUnique: vi.fn(), findMany: vi.fn() },
    proPredictionPick: { findMany: vi.fn() },
  },
}));

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = { id: "user-1", role: "user" };
    return next();
  },
}));

vi.mock("../services/pro-prediction-leagues", () => {
  class PredictionLeagueError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "PredictionLeagueError";
    }
  }
  return {
    PredictionLeagueError,
    createLeague: vi.fn(),
    joinLeagueByCode: vi.fn(),
    submitPick: vi.fn(),
    getLeagueLeaderboard: vi.fn(),
    assertMember: vi.fn(),
  };
});

import express from "express";
import http from "http";
import router from "./pro-prediction-leagues";
import { prisma } from "../prisma";
import {
  createLeague,
  joinLeagueByCode,
  submitPick,
  getLeagueLeaderboard,
  assertMember,
  PredictionLeagueError,
} from "../services/pro-prediction-leagues";

const create = vi.mocked(createLeague);
const join = vi.mocked(joinLeagueByCode);
const pick = vi.mocked(submitPick);
const lb = vi.mocked(getLeagueLeaderboard);
const assertM = vi.mocked(assertMember);

const mockedPrisma = prisma as unknown as {
  proPredictionLeague: { findUnique: ReturnType<typeof vi.fn> };
  proPredictionLeagueMember: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  proPredictionPick: { findMany: ReturnType<typeof vi.fn> };
};

async function request(
  method: "GET" | "POST",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/pro-league/prediction-leagues", router);
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
          path: `/pro-league/prediction-leagues${path}`,
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

describe("POST /pro-league/prediction-leagues", () => {
  it("cree une ligue avec auth user comme owner", async () => {
    create.mockResolvedValueOnce({ leagueId: "l1", joinCode: "ABCDEFGH" });

    const res = await request("POST", "/", { name: "Mon Bureau" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ leagueId: "l1", joinCode: "ABCDEFGH" });
    expect(create).toHaveBeenCalledWith({
      name: "Mon Bureau",
      ownerId: "user-1",
      isPrivate: undefined,
    });
  });

  it("rejette nom trop court (400 validation)", async () => {
    const res = await request("POST", "/", { name: "ab" });
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("mappe INVALID_INPUT en 400", async () => {
    create.mockRejectedValueOnce(
      new PredictionLeagueError("INVALID_INPUT", "invalide") as any,
    );
    const res = await request("POST", "/", { name: "Test" });
    expect(res.status).toBe(400);
  });
});

describe("GET /pro-league/prediction-leagues/me", () => {
  it("liste les ligues du user avec isOwner correctement set", async () => {
    mockedPrisma.proPredictionLeagueMember.findMany.mockResolvedValueOnce([
      {
        joinedAt: new Date("2026-05-01"),
        league: {
          id: "l1",
          name: "Owner of this",
          joinCode: "AAA11111",
          ownerId: "user-1",
          isPrivate: true,
          createdAt: new Date("2026-04-01"),
          _count: { members: 5 },
        },
      },
      {
        joinedAt: new Date("2026-05-10"),
        league: {
          id: "l2",
          name: "Just a member",
          joinCode: "BBB22222",
          ownerId: "other-user",
          isPrivate: true,
          createdAt: new Date("2026-04-15"),
          _count: { members: 3 },
        },
      },
    ]);

    const res = await request("GET", "/me");

    expect(res.status).toBe(200);
    expect(res.body.leagues).toHaveLength(2);
    expect(res.body.leagues[0].isOwner).toBe(true);
    expect(res.body.leagues[1].isOwner).toBe(false);
    expect(res.body.leagues[0].memberCount).toBe(5);
  });

  it("retourne liste vide si aucune membership", async () => {
    mockedPrisma.proPredictionLeagueMember.findMany.mockResolvedValueOnce([]);
    const res = await request("GET", "/me");
    expect(res.body.leagues).toEqual([]);
  });
});

describe("POST /pro-league/prediction-leagues/join", () => {
  it("join via code (200)", async () => {
    join.mockResolvedValueOnce({ leagueId: "l1", leagueName: "Test" });

    const res = await request("POST", "/join", { joinCode: "ABCDEFGH" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ leagueId: "l1", leagueName: "Test" });
    expect(join).toHaveBeenCalledWith("ABCDEFGH", "user-1");
  });

  it("mappe JOIN_CODE_INVALID en 404", async () => {
    join.mockRejectedValueOnce(
      new PredictionLeagueError("JOIN_CODE_INVALID", "introuvable") as any,
    );
    const res = await request("POST", "/join", { joinCode: "ZZZZZZZZ" });
    expect(res.status).toBe(404);
  });
});

describe("GET /pro-league/prediction-leagues/:id", () => {
  it("retourne detail + members si membre", async () => {
    assertM.mockResolvedValueOnce(undefined);
    mockedPrisma.proPredictionLeague.findUnique.mockResolvedValueOnce({
      id: "l1",
      name: "Test",
      joinCode: "ABCDEFGH",
      ownerId: "user-1",
      isPrivate: true,
      createdAt: new Date("2026-04-01"),
      members: [
        {
          userId: "user-1",
          joinedAt: new Date("2026-04-01"),
          user: { name: "Alice", email: "a@x.com" },
        },
        {
          userId: "user-2",
          joinedAt: new Date("2026-04-02"),
          user: { name: "Bob", email: "b@x.com" },
        },
      ],
    });

    const res = await request("GET", "/l1");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("l1");
    expect(res.body.isOwner).toBe(true);
    expect(res.body.members).toHaveLength(2);
    expect(res.body.members[0]).toMatchObject({
      userId: "user-1",
      isOwner: true,
    });
  });

  it("403 NOT_MEMBER mappe correctement", async () => {
    assertM.mockRejectedValueOnce(
      new PredictionLeagueError("NOT_MEMBER", "pas membre") as any,
    );
    const res = await request("GET", "/l1");
    expect(res.status).toBe(403);
  });

  it("404 si ligue introuvable", async () => {
    assertM.mockResolvedValueOnce(undefined);
    mockedPrisma.proPredictionLeague.findUnique.mockResolvedValueOnce(null);
    const res = await request("GET", "/l1");
    expect(res.status).toBe(404);
  });
});

describe("GET /pro-league/prediction-leagues/:id/leaderboard", () => {
  it("retourne entries du leaderboard", async () => {
    assertM.mockResolvedValueOnce(undefined);
    lb.mockResolvedValueOnce([
      {
        userId: "user-1",
        userName: "Alice",
        userEmail: "a@x.com",
        totalPicks: 5,
        correctPicks: 3,
        accuracy: 0.6,
      },
    ]);

    const res = await request("GET", "/l1/leaderboard");

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0]).toMatchObject({
      correctPicks: 3,
      totalPicks: 5,
    });
  });

  it("403 NOT_MEMBER", async () => {
    assertM.mockRejectedValueOnce(
      new PredictionLeagueError("NOT_MEMBER", "pas membre") as any,
    );
    const res = await request("GET", "/l1/leaderboard");
    expect(res.status).toBe(403);
  });
});

describe("POST /pro-league/prediction-leagues/:id/picks", () => {
  it("201 si premier pick", async () => {
    pick.mockResolvedValueOnce({
      pickId: "p1",
      selection: "home",
      isUpdate: false,
    });

    const res = await request("POST", "/l1/picks", {
      matchId: "m1",
      selection: "home",
    });

    expect(res.status).toBe(201);
    expect(res.body.isUpdate).toBe(false);
  });

  it("200 si update", async () => {
    pick.mockResolvedValueOnce({
      pickId: "p1",
      selection: "away",
      isUpdate: true,
    });

    const res = await request("POST", "/l1/picks", {
      matchId: "m1",
      selection: "away",
    });

    expect(res.status).toBe(200);
    expect(res.body.isUpdate).toBe(true);
  });

  it("400 selection invalide (validation)", async () => {
    const res = await request("POST", "/l1/picks", {
      matchId: "m1",
      selection: "tie",
    });
    expect(res.status).toBe(400);
    expect(pick).not.toHaveBeenCalled();
  });

  it("409 MATCH_LOCKED", async () => {
    pick.mockRejectedValueOnce(
      new PredictionLeagueError("MATCH_LOCKED", "ferme") as any,
    );
    const res = await request("POST", "/l1/picks", {
      matchId: "m1",
      selection: "home",
    });
    expect(res.status).toBe(409);
  });

  it("403 NOT_MEMBER", async () => {
    pick.mockRejectedValueOnce(
      new PredictionLeagueError("NOT_MEMBER", "pas membre") as any,
    );
    const res = await request("POST", "/l1/picks", {
      matchId: "m1",
      selection: "home",
    });
    expect(res.status).toBe(403);
  });

  it("404 MATCH_NOT_FOUND", async () => {
    pick.mockRejectedValueOnce(
      new PredictionLeagueError("MATCH_NOT_FOUND", "introuvable") as any,
    );
    const res = await request("POST", "/l1/picks", {
      matchId: "x",
      selection: "home",
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /pro-league/prediction-leagues/:id/picks/me", () => {
  it("liste mes picks dans la ligue", async () => {
    assertM.mockResolvedValueOnce(undefined);
    mockedPrisma.proPredictionPick.findMany.mockResolvedValueOnce([
      {
        id: "p1",
        matchId: "m1",
        selection: "home",
        result: "home",
        correct: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        match: {
          id: "m1",
          status: "completed",
          scheduledAt: new Date(),
          homeTeamId: "t1",
          awayTeamId: "t2",
          scoreHome: 3,
          scoreAway: 1,
        },
      },
    ]);

    const res = await request("GET", "/l1/picks/me");

    expect(res.status).toBe(200);
    expect(res.body.picks).toHaveLength(1);
    expect(res.body.picks[0]).toMatchObject({
      selection: "home",
      correct: true,
    });
  });

  it("403 NOT_MEMBER", async () => {
    assertM.mockRejectedValueOnce(
      new PredictionLeagueError("NOT_MEMBER", "pas membre") as any,
    );
    const res = await request("GET", "/l1/picks/me");
    expect(res.status).toBe(403);
  });
});
