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
    },
    turn: { create: vi.fn() },
  },
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
  default: { sign: vi.fn(() => "signed-token") },
  sign: vi.fn(() => "signed-token"),
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
import {
  handleCreateMatch,
  handleJoinMatch,
  handleAcceptMatch,
  handlePracticeMatch,
  handleCancelMatch,
} from "./match";
import type { AuthenticatedRequest } from "../middleware/authUser";

const mockPrisma = prisma as unknown as {
  match: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  turn: { create: ReturnType<typeof vi.fn> };
};
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
