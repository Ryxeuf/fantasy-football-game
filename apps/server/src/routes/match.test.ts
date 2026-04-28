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
import {
  handleCreateMatch,
  handleJoinMatch,
  handleAcceptMatch,
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
