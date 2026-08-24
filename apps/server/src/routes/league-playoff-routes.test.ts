/**
 * Tests des routes de lancement des playoffs :
 *  - POST /leagues/seasons/:seasonId/playoff/start (createur only,
 *    `force`, messages de refus par `skippedReason`)
 *  - PATCH /leagues/seasons/:seasonId/config (playoffSize reglable
 *    tant que le bracket n'existe pas)
 *
 * Handlers unitaires : services et prisma mockes, req/res faits a la
 * main (meme pattern que `routes/league.test.ts`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/league-playoffs", () => ({
  startPlayoffs: vi.fn(),
  overridePlayoffParticipants: vi.fn(),
  // Class d'erreur DANS la factory (cf. CLAUDE.md).
  PlayoffOverrideError: class PlayoffOverrideError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "PlayoffOverrideError";
    }
  },
}));

vi.mock("../services/league-scheduler", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-scheduler")>();
  return { ...actual, requireLeagueCreator: vi.fn() };
});

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn(), update: vi.fn() },
    leagueRound: { count: vi.fn(), findMany: vi.fn() },
    leaguePool: { findMany: vi.fn() },
  },
}));

import type { Response } from "express";
import { startPlayoffs } from "../services/league-playoffs";
import { requireLeagueCreator } from "../services/league-scheduler";
import { prisma } from "../prisma";
import {
  handleStartPlayoffs,
  handleUpdateSeasonConfig,
  handleGetPlayoffBracket,
} from "./league";
import type { AuthenticatedRequest } from "../middleware/authUser";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  startPlayoffs: startPlayoffs as unknown as MockFn,
  requireCreator: requireLeagueCreator as unknown as MockFn,
  seasonFind: prisma.leagueSeason.findUnique as unknown as MockFn,
  seasonUpdate: prisma.leagueSeason.update as unknown as MockFn,
  roundCount: prisma.leagueRound.count as unknown as MockFn,
  roundFindMany: prisma.leagueRound.findMany as unknown as MockFn,
  poolFindMany: prisma.leaguePool.findMany as unknown as MockFn,
};

function createRes() {
  const res: Partial<Response> & { statusCode?: number; payload?: unknown } =
    {};
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

beforeEach(() => {
  vi.resetAllMocks();
  mocked.requireCreator.mockResolvedValue({
    seasonId: "s1",
    leagueId: "l1",
    status: "in_progress",
    creatorId: "user-1",
  });
});

describe("Route: POST /leagues/seasons/:seasonId/playoff/start", () => {
  it("demarre les playoffs et renvoie 201", async () => {
    mocked.startPlayoffs.mockResolvedValue({
      created: true,
      roundsCreated: 2,
      pairingsCreated: 2,
    });
    const req = createReq({ params: { seasonId: "s1" } as never, body: {} });
    const res = createRes();
    await handleStartPlayoffs(req, res);

    expect(mocked.startPlayoffs).toHaveBeenCalledWith("s1", {
      force: false,
      byUserId: "user-1",
    });
    expect(res.statusCode).toBe(201);
  });

  it("propage force=true au service", async () => {
    mocked.startPlayoffs.mockResolvedValue({
      created: true,
      roundsCreated: 1,
      pairingsCreated: 1,
      cancelledPairings: 3,
    });
    const req = createReq({
      params: { seasonId: "s1" } as never,
      body: { force: true },
    });
    const res = createRes();
    await handleStartPlayoffs(req, res);

    expect(mocked.startPlayoffs).toHaveBeenCalledWith("s1", {
      force: true,
      byUserId: "user-1",
    });
    expect(res.statusCode).toBe(201);
  });

  it("refuse un utilisateur non createur (403)", async () => {
    mocked.requireCreator.mockRejectedValue(new Error("forbidden"));
    const req = createReq({ params: { seasonId: "s1" } as never });
    const res = createRes();
    await handleStartPlayoffs(req, res);

    expect(res.statusCode).toBe(403);
    expect(mocked.startPlayoffs).not.toHaveBeenCalled();
  });

  it.each([
    ["playoffs-disabled", /taille de bracket/i],
    ["playoffs-already-started", /deja ete genere/i],
    ["insufficient-participants", /pas assez d'equipes/i],
    ["regular-season-incomplete", /phase reguliere n'est pas terminee/i],
    ["pool-qualification-mismatch", /qualifies par poule/i],
  ])("restitue un message explicite pour %s (400)", async (reason, re) => {
    mocked.startPlayoffs.mockResolvedValue({
      created: false,
      roundsCreated: 0,
      pairingsCreated: 0,
      skippedReason: reason,
    });
    const req = createReq({ params: { seasonId: "s1" } as never });
    const res = createRes();
    await handleStartPlayoffs(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ error: expect.stringMatching(re) });
  });
});

describe("Route: PATCH /leagues/seasons/:seasonId/config (playoffSize)", () => {
  it("enregistre la nouvelle taille de bracket", async () => {
    mocked.seasonFind.mockResolvedValue({ status: "in_progress" });
    mocked.roundCount.mockResolvedValue(0);
    mocked.seasonUpdate.mockResolvedValue({
      id: "s1",
      meceneEnabled: false,
      playoffSize: 4,
    });
    const req = createReq({
      params: { seasonId: "s1" } as never,
      body: { playoffSize: 4 },
    });
    const res = createRes();
    await handleUpdateSeasonConfig(req, res);

    expect(mocked.seasonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { playoffSize: 4 } }),
    );
    expect(res.payload).toMatchObject({
      success: true,
      data: { season: { playoffSize: 4 } },
    });
  });

  it("refuse (409) quand le bracket est deja genere", async () => {
    mocked.seasonFind.mockResolvedValue({ status: "in_progress" });
    mocked.roundCount.mockResolvedValue(2);
    const req = createReq({
      params: { seasonId: "s1" } as never,
      body: { playoffSize: 8 },
    });
    const res = createRes();
    await handleUpdateSeasonConfig(req, res);

    expect(res.statusCode).toBe(409);
    expect(mocked.seasonUpdate).not.toHaveBeenCalled();
  });

  it("refuse (409) quand la saison est cloturee", async () => {
    mocked.seasonFind.mockResolvedValue({ status: "completed" });
    const req = createReq({
      params: { seasonId: "s1" } as never,
      body: { playoffSize: 2 },
    });
    const res = createRes();
    await handleUpdateSeasonConfig(req, res);

    expect(res.statusCode).toBe(409);
    expect(mocked.seasonUpdate).not.toHaveBeenCalled();
  });

  it("ne verifie rien de plus quand playoffSize n'est pas fourni", async () => {
    mocked.seasonUpdate.mockResolvedValue({
      id: "s1",
      meceneEnabled: true,
      playoffSize: 0,
    });
    const req = createReq({
      params: { seasonId: "s1" } as never,
      body: { meceneEnabled: true },
    });
    const res = createRes();
    await handleUpdateSeasonConfig(req, res);

    expect(mocked.roundCount).not.toHaveBeenCalled();
    expect(mocked.seasonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { meceneEnabled: true } }),
    );
  });
});

describe("Route: GET /leagues/seasons/:seasonId/playoff-bracket", () => {
  it("expose l'etat necessaire au panneau commissaire", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      playoffSize: 4,
      status: "in_progress",
    });
    mocked.roundFindMany.mockResolvedValue([]);
    mocked.roundCount.mockResolvedValue(0);
    mocked.poolFindMany.mockResolvedValue([
      { qualifiesForPlayoffs: 2 },
      { qualifiesForPlayoffs: 2 },
    ]);

    const req = createReq({ params: { seasonId: "s1" } as never });
    const res = createRes();
    await handleGetPlayoffBracket(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        playoffSize: 4,
        regularSeasonComplete: true,
        poolQualification: {
          totalQualified: 4,
          playoffSize: 4,
          consistent: true,
        },
      },
    });
  });

  it("signale une config de poules incoherente", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      playoffSize: 4,
      status: "in_progress",
    });
    mocked.roundFindMany.mockResolvedValue([]);
    mocked.roundCount.mockResolvedValue(3);
    mocked.poolFindMany.mockResolvedValue([
      { qualifiesForPlayoffs: 3 },
      { qualifiesForPlayoffs: 3 },
    ]);

    const req = createReq({ params: { seasonId: "s1" } as never });
    const res = createRes();
    await handleGetPlayoffBracket(req, res);

    expect(res.payload).toMatchObject({
      data: {
        regularSeasonComplete: false,
        poolQualification: { totalQualified: 6, consistent: false },
      },
    });
  });
});
