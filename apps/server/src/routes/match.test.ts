/**
 * S25.5 — Tests des handlers `handleCreateMatch`, `handleJoinMatch`,
 * `handleAcceptMatch` migres vers l'enveloppe `ApiResponse<T>`.
 *
 * Pattern aligne sur `league.test.ts` : services et prisma mockes,
 * req/res faits a la main.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    match: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    turn: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    teamSelection: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../game-spectator", () => ({
  getSpectatorCount: vi.fn(() => 0),
}));

vi.mock("../services/match-start", () => ({
  acceptAndMaybeStartMatch: vi.fn(),
}));

vi.mock("../services/practice-match", () => ({
  createOnlinePracticeMatch: vi.fn(),
}));

vi.mock("../services/match-cancel", () => ({
  cancelMatch: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "signed-token"),
    verify: vi.fn(() => ({ matchId: "m1", userId: "user-1" })),
  },
  sign: vi.fn(() => "signed-token"),
  verify: vi.fn(() => ({ matchId: "m1", userId: "user-1" })),
}));

vi.mock("../utils/server-log", () => ({
  serverLog: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import type { Response } from "express";
import { prisma } from "../prisma";
import { acceptAndMaybeStartMatch } from "../services/match-start";
import { createOnlinePracticeMatch } from "../services/practice-match";
import { cancelMatch } from "../services/match-cancel";
import jwt from "jsonwebtoken";
import {
  handleCreateMatch,
  handleJoinMatch,
  handleAcceptMatch,
  handlePracticeMatch,
  handleCancelMatch,
  handleListMyMatches,
  handleListLiveMatches,
  handleListMatchTurns,
  handleGetMatchResults,
  handleSpectateMatch,
  handleReplayMatch,
  handleGetMatchSummary,
  handleGetMatchDetailsByToken,
  handleGetMatchDetails,
  handleGetMatchTeams,
} from "./match";
import { getSpectatorCount } from "../game-spectator";
import type { AuthenticatedRequest } from "../middleware/authUser";

const mockPrisma = prisma as unknown as {
  match: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  turn: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  teamSelection: {
    findMany: ReturnType<typeof vi.fn>;
  };
};
const mockGetSpectatorCount = getSpectatorCount as ReturnType<typeof vi.fn>;
const mockAcceptAndMaybeStart = acceptAndMaybeStartMatch as ReturnType<
  typeof vi.fn
>;
const mockCreatePractice = createOnlinePracticeMatch as ReturnType<
  typeof vi.fn
>;
const mockCancelMatch = cancelMatch as ReturnType<typeof vi.fn>;

function createRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    payload?: unknown;
  } = {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((payload: unknown) => {
    res.payload = payload;
    return res as Response;
  });
  return res as Response & { statusCode?: number; payload?: unknown };
}

function createReq(
  overrides: Partial<AuthenticatedRequest> = {},
): AuthenticatedRequest {
  return {
    body: {},
    params: {},
    query: {},
    user: { id: "user-1", roles: ["user"] },
    ...overrides,
  } as AuthenticatedRequest;
}

describe("Route: POST /match/create (S25.5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a match and returns ApiSuccess with match + matchToken", async () => {
    mockPrisma.match.create.mockResolvedValue({ id: "match-1", status: "pending" });

    const req = createReq({ body: {} });
    const res = createRes();
    await handleCreateMatch(req, res);

    expect(mockPrisma.match.create).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        match: expect.objectContaining({ id: "match-1" }),
        matchToken: "signed-token",
      },
    });
  });

  it("persists rulesMode/turnTimerEnabled/terrainSkin in turn options", async () => {
    mockPrisma.match.create.mockResolvedValue({ id: "match-2" });
    const req = createReq({
      body: {
        terrainSkin: "stadium",
        turnTimerEnabled: false,
        rulesMode: "simplified",
      },
    });
    const res = createRes();
    await handleCreateMatch(req, res);

    expect(mockPrisma.turn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          number: 0,
          payload: expect.objectContaining({
            type: "match-options",
            terrainSkin: "stadium",
            turnTimerEnabled: false,
            rulesMode: "simplified",
          }),
        }),
      }),
    );
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.create.mockRejectedValue(new Error("db down"));
    const req = createReq({ body: {} });
    const res = createRes();
    await handleCreateMatch(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "db down" });
  });
});

describe("Route: POST /match/join (S25.5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("joins the user to the match and returns ApiSuccess", async () => {
    mockPrisma.match.update.mockResolvedValue({ id: "match-3", status: "pending" });
    const req = createReq({ body: { matchId: "match-3" } });
    const res = createRes();
    await handleJoinMatch(req, res);

    expect(mockPrisma.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "match-3" },
        data: expect.objectContaining({
          players: { connect: { id: "user-1" } },
        }),
      }),
    );
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        match: expect.objectContaining({ id: "match-3" }),
        matchToken: "signed-token",
      },
    });
  });

  it("returns 500 ApiError when prisma throws (e.g., match not found)", async () => {
    mockPrisma.match.update.mockRejectedValue(new Error("Record to update not found"));
    const req = createReq({ body: { matchId: "missing" } });
    const res = createRes();
    await handleJoinMatch(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: POST /match/accept (S25.5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards to acceptAndMaybeStartMatch and wraps result", async () => {
    mockAcceptAndMaybeStart.mockResolvedValue({ ok: true, started: false });
    const req = createReq({ body: { matchId: "m-1" } });
    const res = createRes();
    await handleAcceptMatch(req, res);

    expect(mockAcceptAndMaybeStart).toHaveBeenCalledWith(
      expect.anything(),
      { matchId: "m-1", userId: "user-1" },
    );
    expect(res.payload).toMatchObject({
      success: true,
      data: { ok: true, started: false },
    });
  });

  it("returns mapped status when service returns { ok:false, status }", async () => {
    mockAcceptAndMaybeStart.mockResolvedValue({
      ok: false,
      error: "Partie introuvable",
      status: 404,
    });
    const req = createReq({ body: { matchId: "missing" } });
    const res = createRes();
    await handleAcceptMatch(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({
      success: false,
      error: "Partie introuvable",
    });
  });

  it("returns 500 ApiError when service throws", async () => {
    mockAcceptAndMaybeStart.mockRejectedValue(new Error("boom"));
    const req = createReq({ body: { matchId: "m-1" } });
    const res = createRes();
    await handleAcceptMatch(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "boom" });
  });
});

describe("Route: POST /match/practice (S25.5g)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a practice match and returns ApiSuccess with match + matchToken + ai", async () => {
    mockCreatePractice.mockResolvedValue({
      matchId: "match-prac-1",
      aiUserId: "ai-user",
      aiTeamId: "ai-team",
      aiTeamSide: "B",
      aiRoster: "skaven",
    });
    const req = createReq({
      body: { userTeamId: "team-1", difficulty: "medium" },
    });
    const res = createRes();
    await handlePracticeMatch(req, res);

    expect(mockCreatePractice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        creatorId: "user-1",
        userTeamId: "team-1",
        difficulty: "medium",
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        match: { id: "match-prac-1" },
        matchToken: "signed-token",
        ai: {
          roster: "skaven",
          teamId: "ai-team",
          teamSide: "B",
          userId: "ai-user",
          difficulty: "medium",
        },
      },
    });
  });

  it("maps 'introuvable' errors to 404 ApiError", async () => {
    mockCreatePractice.mockRejectedValue(new Error("Equipe introuvable"));
    const req = createReq({
      body: { userTeamId: "missing", difficulty: "medium" },
    });
    const res = createRes();
    await handlePracticeMatch(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({
      success: false,
      error: "Equipe introuvable",
    });
  });

  it("maps 'proprietaire' errors to 403 ApiError", async () => {
    mockCreatePractice.mockRejectedValue(
      new Error("Vous n'etes pas proprietaire de cette equipe"),
    );
    const req = createReq({
      body: { userTeamId: "other-team", difficulty: "medium" },
    });
    const res = createRes();
    await handlePracticeMatch(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("maps 'non autorise' errors to 400 ApiError", async () => {
    mockCreatePractice.mockRejectedValue(
      new Error("Roster non autorise dans cette ligue"),
    );
    const req = createReq({ body: { userTeamId: "t", difficulty: "easy" } });
    const res = createRes();
    await handlePracticeMatch(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("falls back to 500 for unmapped errors", async () => {
    mockCreatePractice.mockRejectedValue(new Error("boom"));
    const req = createReq({ body: { userTeamId: "t", difficulty: "easy" } });
    const res = createRes();
    await handlePracticeMatch(req, res);
    expect(res.statusCode).toBe(500);
  });
});

describe("Route: POST /match/:id/cancel (S25.5g)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancels and returns ApiSuccess with the service result", async () => {
    mockCancelMatch.mockResolvedValue({ ok: true, status: "cancelled" });
    const req = createReq({ params: { id: "match-1" } });
    const res = createRes();
    await handleCancelMatch(req, res);

    expect(mockCancelMatch).toHaveBeenCalledWith(
      expect.anything(),
      { matchId: "match-1", userId: "user-1" },
    );
    expect(res.payload).toMatchObject({
      success: true,
      data: { ok: true, status: "cancelled" },
    });
  });

  it("forwards service status when ok=false (e.g., 404)", async () => {
    mockCancelMatch.mockResolvedValue({
      ok: false,
      error: "Partie introuvable",
      status: 404,
    });
    const req = createReq({ params: { id: "missing" } });
    const res = createRes();
    await handleCancelMatch(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({
      success: false,
      error: "Partie introuvable",
    });
  });

  it("returns 500 ApiError when service throws", async () => {
    mockCancelMatch.mockRejectedValue(new Error("boom"));
    const req = createReq({ params: { id: "m" } });
    const res = createRes();
    await handleCancelMatch(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "boom" });
  });
});

describe("Route: GET /match/my-matches (S25.5h)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with matches enriched with score/turn/sides", async () => {
    const now = new Date("2026-04-28T10:00:00Z");
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "match-mm-1",
        status: "active",
        createdAt: now,
        lastMoveAt: now,
        currentTurnUserId: "user-1",
        teamSelections: [
          {
            userId: "user-1",
            createdAt: new Date("2026-04-28T09:59:00Z"),
            user: { id: "user-1", coachName: "Me", eloRating: 1200 },
            teamRef: { id: "t1", name: "Reds", roster: "skaven" },
            team: "skaven",
          },
          {
            userId: "user-2",
            createdAt: new Date("2026-04-28T09:59:30Z"),
            user: { id: "user-2", coachName: "Foe", eloRating: 1100 },
            teamRef: { id: "t2", name: "Blues", roster: "lizardmen" },
            team: "lizardmen",
          },
        ],
        turns: [
          {
            payload: {
              gameState: { score: { teamA: 2, teamB: 1 }, half: 2, turn: 5 },
            },
          },
        ],
      },
    ]);

    const req = createReq();
    const res = createRes();
    await handleListMyMatches(req, res);

    expect(mockPrisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { players: { some: { id: "user-1" } } },
        take: 50,
      }),
    );
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        matches: [
          expect.objectContaining({
            id: "match-mm-1",
            status: "active",
            isMyTurn: true,
            myScore: 2,
            opponentScore: 1,
            half: 2,
            turn: 5,
            myTeam: expect.objectContaining({
              coachName: "Me",
              teamName: "Reds",
              eloRating: 1200,
            }),
            opponent: expect.objectContaining({
              coachName: "Foe",
              teamName: "Blues",
              eloRating: 1100,
            }),
          }),
        ],
      },
    });
  });

  it("returns ApiSuccess with empty matches array when none found", async () => {
    mockPrisma.match.findMany.mockResolvedValue([]);
    const req = createReq();
    const res = createRes();
    await handleListMyMatches(req, res);
    expect(res.payload).toMatchObject({
      success: true,
      data: { matches: [] },
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.findMany.mockRejectedValue(new Error("db down"));
    const req = createReq();
    const res = createRes();
    await handleListMyMatches(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "Erreur serveur" });
  });
});

describe("Route: GET /match/live (S25.5h)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with live matches and spectator count", async () => {
    mockGetSpectatorCount.mockReturnValue(7);
    const now = new Date("2026-04-28T10:00:00Z");
    mockPrisma.match.findMany.mockResolvedValue([
      {
        id: "live-1",
        status: "active",
        createdAt: now,
        lastMoveAt: now,
        teamSelections: [
          {
            createdAt: new Date("2026-04-28T09:59:00Z"),
            user: { id: "u1", coachName: "Alice" },
            teamRef: { name: "AA", roster: "skaven" },
          },
          {
            createdAt: new Date("2026-04-28T09:59:30Z"),
            user: { id: "u2", coachName: "Bob" },
            teamRef: { name: "BB", roster: "lizardmen" },
          },
        ],
        turns: [
          {
            payload: {
              gameState: { score: { teamA: 1, teamB: 0 }, half: 1, turn: 3 },
            },
          },
        ],
      },
    ]);

    const req = createReq();
    const res = createRes();
    await handleListLiveMatches(req, res);

    expect(mockPrisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["active", "prematch-setup"] } },
        take: 20,
      }),
    );
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        matches: [
          expect.objectContaining({
            id: "live-1",
            status: "active",
            spectatorCount: 7,
            score: { teamA: 1, teamB: 0 },
            half: 1,
            turn: 3,
            teamA: expect.objectContaining({ coachName: "Alice", teamName: "AA" }),
            teamB: expect.objectContaining({ coachName: "Bob", teamName: "BB" }),
          }),
        ],
      },
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.findMany.mockRejectedValue(new Error("boom"));
    const req = createReq();
    const res = createRes();
    await handleListLiveMatches(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "Erreur serveur" });
  });
});

describe("Route: GET /match/:id/turns (S25.5i)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with turn summaries for a match player", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      status: "active",
      players: [{ id: "user-1" }, { id: "user-2" }],
    });
    mockPrisma.turn.findMany.mockResolvedValue([
      {
        id: "t1",
        number: 1,
        createdAt: new Date("2026-04-28T10:00:00Z"),
        payload: {
          type: "move",
          userId: "user-1",
          gameState: { half: 1, turn: 2, score: { teamA: 0, teamB: 0 } },
          move: { type: "MOVE" },
        },
      },
    ]);

    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleListMatchTurns(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        matchId: "m1",
        turns: [
          expect.objectContaining({
            id: "t1",
            number: 1,
            type: "move",
            userId: "user-1",
            half: 1,
            turn: 2,
            moveType: "MOVE",
          }),
        ],
      },
    });
  });

  it("returns 404 ApiError when match is not found", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(null);
    const req = createReq({ params: { id: "missing" } });
    const res = createRes();
    await handleListMatchTurns(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false, error: "Partie introuvable" });
  });

  it("returns 403 ApiError when user is not a player", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      status: "active",
      players: [{ id: "other" }],
    });
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleListMatchTurns(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.findUnique.mockRejectedValue(new Error("db down"));
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleListMatchTurns(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "Erreur serveur" });
  });
});

describe("Route: GET /match/:id/results (S25.5i)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with final score, winner and team stats", async () => {
    const createdAt = new Date("2026-04-28T09:00:00Z");
    const endedAt = new Date("2026-04-28T10:00:00Z");
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      status: "ended",
      createdAt,
    });
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      {
        user: { id: "u1", name: "Alice", email: "a@x", eloRating: 1200 },
        teamRef: { name: "Reds", roster: "skaven" },
      },
      {
        user: { id: "u2", name: "Bob", email: "b@x", eloRating: 1100 },
        teamRef: { name: "Blues", roster: "lizardmen" },
      },
    ]);
    mockPrisma.turn.findFirst.mockResolvedValue({
      createdAt: endedAt,
      payload: {
        gameState: {
          score: { teamA: 2, teamB: 1 },
          matchStats: { p1: { touchdowns: 2 }, p2: { touchdowns: 1 } },
          players: [
            { id: "p1", team: "A", name: "Skitter", number: 1, position: "Lineman" },
            { id: "p2", team: "B", name: "Krox", number: 1, position: "Lineman" },
          ],
          matchResult: { winnings: 50000, dedicatedFansChange: { A: 1, B: 0 } },
          fanAttendance: { A: 12000, B: 10000 },
        },
      },
    });

    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleGetMatchResults(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        matchId: "m1",
        status: "ended",
        score: { teamA: 2, teamB: 1 },
        winner: "A",
        teams: {
          A: expect.objectContaining({
            name: "Reds",
            coach: "Alice",
            eloRating: 1200,
            stats: expect.objectContaining({ touchdowns: 2 }),
          }),
          B: expect.objectContaining({
            name: "Blues",
            coach: "Bob",
            eloRating: 1100,
            stats: expect.objectContaining({ touchdowns: 1 }),
          }),
        },
        winnings: 50000,
      },
    });
  });

  it("returns 404 ApiError when match is not found", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(null);
    const req = createReq({ params: { id: "missing" } });
    const res = createRes();
    await handleGetMatchResults(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false, error: "Partie introuvable" });
  });

  it("returns 400 ApiError when match is not ended", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      status: "active",
      createdAt: new Date(),
    });
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleGetMatchResults(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.findUnique.mockRejectedValue(new Error("db down"));
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleGetMatchResults(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "Erreur serveur" });
  });
});

describe("Route: GET /match/:id/spectate (S25.5i)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with gameState and team metadata", async () => {
    mockGetSpectatorCount.mockReturnValue(3);
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      status: "active",
      turns: [
        {
          number: 1,
          payload: {
            gameState: { score: { teamA: 0, teamB: 0 }, half: 1, turn: 1 },
          },
        },
      ],
    });
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      { user: { coachName: "Alice" }, teamRef: { name: "Reds" } },
      { user: { coachName: "Bob" }, teamRef: { name: "Blues" } },
    ]);

    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleSpectateMatch(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        matchStatus: "active",
        spectatorCount: 3,
        teamA: { coachName: "Alice", teamName: "Reds" },
        teamB: { coachName: "Bob", teamName: "Blues" },
      },
    });
  });

  it("returns 404 ApiError when match is not found", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(null);
    const req = createReq({ params: { id: "missing" } });
    const res = createRes();
    await handleSpectateMatch(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false, error: "Partie introuvable" });
  });

  it("returns 400 ApiError when match status disallows spectate", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      status: "ended",
      turns: [],
    });
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleSpectateMatch(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when no game state turn is found", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      status: "active",
      turns: [{ payload: {} }],
    });
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleSpectateMatch(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false, error: "Etat de jeu introuvable" });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.findUnique.mockRejectedValue(new Error("db down"));
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleSpectateMatch(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "Erreur serveur" });
  });
});

describe("Route: GET /match/:id/replay (S25.5i)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with all turns and team metadata for ended match", async () => {
    const createdAt = new Date("2026-04-28T09:00:00Z");
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      status: "ended",
      createdAt,
      turns: [
        {
          number: 0,
          payload: { type: "init", gameState: { turn: 0 }, timestamp: "2026-04-28T09:00:00Z" },
          createdAt,
        },
        {
          number: 1,
          payload: { type: "move", gameState: { turn: 1 }, move: { type: "MOVE" } },
          createdAt,
        },
        { number: 2, payload: {}, createdAt },
      ],
      teamSelections: [
        {
          user: { id: "u1", coachName: "Alice" },
          teamRef: { id: "t1", name: "Reds", roster: "skaven" },
        },
        {
          user: { id: "u2", coachName: "Bob" },
          teamRef: { id: "t2", name: "Blues", roster: "lizardmen" },
        },
      ],
    });

    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleReplayMatch(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        matchId: "m1",
        status: "ended",
        turns: [
          expect.objectContaining({ type: "init" }),
          expect.objectContaining({ type: "move" }),
        ],
        teams: {
          teamA: { coachName: "Alice", teamName: "Reds", roster: "skaven" },
          teamB: { coachName: "Bob", teamName: "Blues", roster: "lizardmen" },
        },
      },
    });
    // The turn without gameState must be filtered out.
    const data = (res.payload as { data: { turns: unknown[] } }).data;
    expect(data.turns.length).toBe(2);
  });

  it("returns 404 ApiError when match is not found", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(null);
    const req = createReq({ params: { id: "missing" } });
    const res = createRes();
    await handleReplayMatch(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false, error: "Partie introuvable" });
  });

  it("returns 400 ApiError when match is not ended", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      status: "active",
      turns: [],
      teamSelections: [],
      createdAt: new Date(),
    });
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleReplayMatch(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.findUnique.mockRejectedValue(new Error("db down"));
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleReplayMatch(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "Erreur serveur" });
  });
});

describe("Route: GET /match/details (S25.5j)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      matchId: "m1",
      userId: "user-1",
    });
  });

  function createTokenReq(token: string | null = "valid-token"): AuthenticatedRequest {
    const headers: Record<string, string> = {};
    if (token) headers["x-match-token"] = token;
    return { headers, body: {}, params: {}, query: {} } as unknown as AuthenticatedRequest;
  }

  it("returns ApiSuccess with local/visitor team and coach names", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({ id: "m1", creatorId: "user-1" });
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      {
        userId: "user-1",
        user: { id: "user-1", name: "Alice", email: "a@x" },
        teamRef: { name: "Reds", roster: "skaven" },
      },
      {
        userId: "user-2",
        user: { id: "user-2", name: "Bob", email: "b@x" },
        teamRef: { name: "Blues", roster: "lizardmen" },
      },
    ]);

    const req = createTokenReq();
    const res = createRes();
    await handleGetMatchDetailsByToken(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        matchId: "m1",
        local: { teamName: "Reds", coachName: "Alice", userId: "user-1" },
        visitor: { teamName: "Blues", coachName: "Bob", userId: "user-2" },
      },
    });
  });

  it("returns 401 ApiError when x-match-token is missing", async () => {
    const req = createTokenReq(null);
    const res = createRes();
    await handleGetMatchDetailsByToken(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.payload).toMatchObject({ success: false, error: "x-match-token requis" });
  });

  it("returns 401 ApiError when x-match-token is invalid", async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("invalid");
    });
    const req = createTokenReq("bad-token");
    const res = createRes();
    await handleGetMatchDetailsByToken(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.payload).toMatchObject({ success: false, error: "x-match-token invalide" });
  });

  it("returns 400 ApiError when matchId is missing from token payload", async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({});
    const req = createTokenReq();
    const res = createRes();
    await handleGetMatchDetailsByToken(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.findUnique.mockRejectedValue(new Error("db down"));
    const req = createTokenReq();
    const res = createRes();
    await handleGetMatchDetailsByToken(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "Erreur serveur" });
  });
});

describe("Route: GET /match/:id/details (S25.5j)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with local/visitor team, coach and elo for current user", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({ id: "m1", creatorId: "user-1" });
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      {
        userId: "user-1",
        user: { id: "user-1", name: "Alice", email: "a@x", eloRating: 1200 },
        teamRef: { name: "Reds", roster: "skaven" },
      },
      {
        userId: "user-2",
        user: { id: "user-2", name: "Bob", email: "b@x", eloRating: 1100 },
        teamRef: { name: "Blues", roster: "lizardmen" },
      },
    ]);

    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleGetMatchDetails(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        matchId: "m1",
        local: { teamName: "Reds", coachName: "Alice", eloRating: 1200 },
        visitor: { teamName: "Blues", coachName: "Bob", eloRating: 1100 },
      },
    });
  });

  it("returns 404 ApiError when match is not found", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(null);
    mockPrisma.teamSelection.findMany.mockResolvedValue([]);
    const req = createReq({ params: { id: "missing" } });
    const res = createRes();
    await handleGetMatchDetails(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false, error: "Partie introuvable" });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.findUnique.mockRejectedValue(new Error("db down"));
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleGetMatchDetails(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "Erreur serveur" });
  });
});

describe("Route: GET /match/:id/teams (S25.5j)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with absolute teamA/teamB views including players", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({ id: "m1" });
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      {
        teamRef: {
          name: "Reds",
          players: [
            { id: "p1", name: "Skitter", position: "Lineman", number: 1, ma: 7, st: 3, ag: 3, pa: 4, av: 7, skills: "" },
          ],
        },
      },
      {
        teamRef: {
          name: "Blues",
          players: [
            { id: "p2", name: "Krox", position: "Lineman", number: 1, ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: "" },
          ],
        },
      },
    ]);

    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleGetMatchTeams(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        teamA: expect.objectContaining({
          teamName: "Reds",
          players: [expect.objectContaining({ id: "p1", name: "Skitter", ma: 7 })],
        }),
        teamB: expect.objectContaining({
          teamName: "Blues",
          players: [expect.objectContaining({ id: "p2", name: "Krox", av: 8 })],
        }),
      },
    });
  });

  it("returns 404 ApiError when match is not found", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(null);
    const req = createReq({ params: { id: "missing" } });
    const res = createRes();
    await handleGetMatchTeams(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false, error: "Partie introuvable" });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.findUnique.mockRejectedValue(new Error("db down"));
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleGetMatchTeams(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "Erreur serveur" });
  });
});

describe("Route: GET /match/:id/summary (S25.5k)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with teams, score, half, turn and acceptances", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m1",
      status: "active",
      seed: "seed-1",
      creatorId: "user-1",
      createdAt: new Date("2026-04-28T09:00:00Z"),
    });
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      {
        userId: "user-1",
        user: { id: "user-1", name: "Alice", email: "a@x", eloRating: 1200 },
        teamRef: { id: "t1", name: "Reds", roster: "skaven" },
      },
      {
        userId: "user-2",
        user: { id: "user-2", name: "Bob", email: "b@x", eloRating: 1100 },
        teamRef: { id: "t2", name: "Blues", roster: "lizardmen" },
      },
    ]);
    mockPrisma.turn.findMany.mockResolvedValue([
      { payload: { type: "accept", userId: "user-1" } },
      { payload: { type: "init" } },
    ]);
    mockPrisma.turn.count.mockResolvedValue(3);

    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleGetMatchSummary(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        id: "m1",
        status: "active",
        teams: {
          local: { name: "Reds", coach: "Alice", eloRating: 1200 },
          visitor: { name: "Blues", coach: "Bob", eloRating: 1100 },
        },
        score: { teamA: 0, teamB: 0 },
        half: 1,
        turn: 4,
        acceptances: { local: true, visitor: false },
      },
    });
  });

  it("returns 404 ApiError when match is not found", async () => {
    mockPrisma.match.findUnique.mockResolvedValue(null);
    const req = createReq({ params: { id: "missing" } });
    const res = createRes();
    await handleGetMatchSummary(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false, error: "Partie introuvable" });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    mockPrisma.match.findUnique.mockRejectedValue(new Error("db down"));
    const req = createReq({ params: { id: "m1" } });
    const res = createRes();
    await handleGetMatchSummary(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false, error: "Erreur serveur" });
  });

  it("falls back to selection order when creatorId is missing", async () => {
    mockPrisma.match.findUnique.mockResolvedValue({
      id: "m2",
      status: "pending",
      seed: "seed-2",
      creatorId: null,
      createdAt: new Date("2026-04-28T09:00:00Z"),
    });
    mockPrisma.teamSelection.findMany.mockResolvedValue([
      {
        userId: "user-3",
        user: { id: "user-3", name: "Carla", email: "c@x", eloRating: 950 },
        teamRef: { id: "t3", name: "Greens", roster: "orc" },
      },
      {
        userId: "user-4",
        user: { id: "user-4", name: "Dan", email: "d@x", eloRating: 1050 },
        teamRef: { id: "t4", name: "Yellows", roster: "human" },
      },
    ]);
    mockPrisma.turn.findMany.mockResolvedValue([]);
    mockPrisma.turn.count.mockResolvedValue(0);

    const req = createReq({ params: { id: "m2" } });
    const res = createRes();
    await handleGetMatchSummary(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        teams: {
          local: { name: "Greens", coach: "Carla" },
          visitor: { name: "Yellows", coach: "Dan" },
        },
        acceptances: { local: false, visitor: false },
      },
    });
  });
});
