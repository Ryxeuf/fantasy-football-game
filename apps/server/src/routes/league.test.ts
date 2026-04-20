/**
 * L.3 — Tests des routes API ligue (create / list / get / join /
 * schedule round / standings / withdraw).
 *
 * Les handlers sont unitaires : service et prisma mockes,
 * req/res faits a la main (comme middleware/authUser.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/league", () => ({
  createLeague: vi.fn(),
  createSeason: vi.fn(),
  addParticipant: vi.fn(),
  createRound: vi.fn(),
  listLeagues: vi.fn(),
  getLeagueById: vi.fn(),
  getSeasonById: vi.fn(),
  computeSeasonStandings: vi.fn(),
  withdrawParticipant: vi.fn(),
  parseAllowedRosters: vi.fn((raw: string | null) =>
    raw ? (JSON.parse(raw) as string[]) : null,
  ),
}));

vi.mock("../prisma", () => ({
  prisma: {
    team: { findUnique: vi.fn() },
    league: { findUnique: vi.fn() },
  },
}));

import type { Request, Response } from "express";
import {
  createLeague,
  createSeason,
  addParticipant,
  createRound,
  listLeagues,
  getLeagueById,
  getSeasonById,
  computeSeasonStandings,
  withdrawParticipant,
} from "../services/league";
import { prisma } from "../prisma";
import {
  handleCreateLeague,
  handleListLeagues,
  handleGetLeague,
  handleCreateSeason,
  handleJoinSeason,
  handleCreateRound,
  handleGetStandings,
  handleLeaveSeason,
} from "./league";
import type { AuthenticatedRequest } from "../middleware/authUser";

const mockService = {
  createLeague: createLeague as ReturnType<typeof vi.fn>,
  createSeason: createSeason as ReturnType<typeof vi.fn>,
  addParticipant: addParticipant as ReturnType<typeof vi.fn>,
  createRound: createRound as ReturnType<typeof vi.fn>,
  listLeagues: listLeagues as ReturnType<typeof vi.fn>,
  getLeagueById: getLeagueById as ReturnType<typeof vi.fn>,
  getSeasonById: getSeasonById as ReturnType<typeof vi.fn>,
  computeSeasonStandings: computeSeasonStandings as ReturnType<typeof vi.fn>,
  withdrawParticipant: withdrawParticipant as ReturnType<typeof vi.fn>,
};
const mockPrisma = prisma as unknown as {
  team: { findUnique: ReturnType<typeof vi.fn> };
  league: { findUnique: ReturnType<typeof vi.fn> };
};

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

describe("Route: POST /leagues (create)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a league with the authenticated user as creator", async () => {
    mockService.createLeague.mockResolvedValue({
      id: "league-1",
      name: "Open 5 Teams",
      creatorId: "user-1",
    });

    const req = createReq({ body: { name: "Open 5 Teams" } });
    const res = createRes();
    await handleCreateLeague(req, res);

    expect(mockService.createLeague).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: "user-1", name: "Open 5 Teams" }),
    );
    expect(res.statusCode).toBe(201);
    expect(res.payload).toMatchObject({ id: "league-1" });
  });

  it("passes allowedRosters through to the service", async () => {
    mockService.createLeague.mockResolvedValue({ id: "league-2" });
    const req = createReq({
      body: {
        name: "Open 5",
        allowedRosters: ["skaven", "gnomes"],
        maxParticipants: 8,
      },
    });
    const res = createRes();
    await handleCreateLeague(req, res);
    expect(mockService.createLeague).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedRosters: ["skaven", "gnomes"],
        maxParticipants: 8,
      }),
    );
  });

  it("returns 400 when the service throws a domain error", async () => {
    mockService.createLeague.mockRejectedValue(new Error("nom obligatoire"));
    const req = createReq({ body: { name: " " } });
    const res = createRes();
    await handleCreateLeague(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ error: expect.stringMatching(/nom/i) });
  });
});

describe("Route: GET /leagues (list)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the list of leagues with publicOnly default", async () => {
    mockService.listLeagues.mockResolvedValue([
      { id: "league-1", name: "A", isPublic: true },
    ]);
    const req = createReq({ query: {} });
    const res = createRes();
    await handleListLeagues(req, res);
    expect(mockService.listLeagues).toHaveBeenCalledWith(
      expect.objectContaining({ publicOnly: undefined }),
    );
    expect(res.payload).toMatchObject({ leagues: expect.any(Array) });
  });

  it("forwards query filters to the service (post validateQuery coercion)", async () => {
    mockService.listLeagues.mockResolvedValue([]);
    // validateQuery coerces publicOnly from "false" to boolean false before the handler
    const req = createReq({
      query: { status: "open", publicOnly: false } as unknown as Record<
        string,
        string
      >,
    });
    const res = createRes();
    await handleListLeagues(req, res);
    expect(mockService.listLeagues).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open", publicOnly: false }),
    );
  });
});

describe("Route: GET /leagues/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the league does not exist", async () => {
    mockService.getLeagueById.mockResolvedValue(null);
    const req = createReq({ params: { id: "nope" } });
    const res = createRes();
    await handleGetLeague(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("returns the league details including parsed allowedRosters", async () => {
    mockService.getLeagueById.mockResolvedValue({
      id: "league-1",
      name: "Open",
      allowedRosters: JSON.stringify(["skaven", "dwarf"]),
      seasons: [],
    });
    const req = createReq({ params: { id: "league-1" } });
    const res = createRes();
    await handleGetLeague(req, res);
    expect(res.payload).toMatchObject({
      league: expect.objectContaining({
        id: "league-1",
        allowedRosters: ["skaven", "dwarf"],
      }),
    });
  });
});

describe("Route: POST /leagues/:id/seasons (schedule a season)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-creator with 403", async () => {
    mockService.getLeagueById.mockResolvedValue({
      id: "league-1",
      creatorId: "someone-else",
    });
    const req = createReq({
      params: { id: "league-1" },
      body: { name: "Saison 1" },
    });
    const res = createRes();
    await handleCreateSeason(req, res);
    expect(res.statusCode).toBe(403);
    expect(mockService.createSeason).not.toHaveBeenCalled();
  });

  it("lets the creator create a new season", async () => {
    mockService.getLeagueById.mockResolvedValue({
      id: "league-1",
      creatorId: "user-1",
    });
    mockService.createSeason.mockResolvedValue({
      id: "season-1",
      seasonNumber: 1,
      name: "Saison 1",
    });
    const req = createReq({
      params: { id: "league-1" },
      body: { name: "Saison 1" },
    });
    const res = createRes();
    await handleCreateSeason(req, res);
    expect(mockService.createSeason).toHaveBeenCalledWith(
      expect.objectContaining({ leagueId: "league-1", name: "Saison 1" }),
    );
    expect(res.statusCode).toBe(201);
  });

  it("returns 404 when the league is not found", async () => {
    mockService.getLeagueById.mockResolvedValue(null);
    const req = createReq({
      params: { id: "unknown" },
      body: { name: "S1" },
    });
    const res = createRes();
    await handleCreateSeason(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe("Route: POST /leagues/seasons/:seasonId/join", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires the team to belong to the authenticated user", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      ownerId: "other-user",
      roster: "skaven",
    });
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      league: { allowedRosters: null },
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleJoinSeason(req, res);
    expect(res.statusCode).toBe(403);
    expect(mockService.addParticipant).not.toHaveBeenCalled();
  });

  it("rejects teams whose roster is not allowed", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "chaos",
    });
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      league: { allowedRosters: JSON.stringify(["skaven", "dwarf"]) },
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleJoinSeason(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      error: expect.stringMatching(/roster/i),
    });
  });

  it("registers the team when ownership + roster check pass", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "skaven",
    });
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      league: { allowedRosters: null },
    });
    mockService.addParticipant.mockResolvedValue({
      id: "participant-1",
      seasonId: "season-1",
      teamId: "team-1",
      seasonElo: 1000,
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleJoinSeason(req, res);
    expect(mockService.addParticipant).toHaveBeenCalledWith({
      seasonId: "season-1",
      teamId: "team-1",
    });
    expect(res.statusCode).toBe(201);
  });

  it("returns 404 when the season is missing", async () => {
    mockService.getSeasonById.mockResolvedValue(null);
    const req = createReq({
      params: { seasonId: "nope" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleJoinSeason(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe("Route: POST /leagues/seasons/:seasonId/rounds (schedule round)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-creator with 403", async () => {
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      league: { creatorId: "someone-else" },
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { roundNumber: 1 },
    });
    const res = createRes();
    await handleCreateRound(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("creates the round when the caller is the creator", async () => {
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      league: { creatorId: "user-1" },
    });
    mockService.createRound.mockResolvedValue({
      id: "round-1",
      roundNumber: 1,
      name: "J1",
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { roundNumber: 1, name: "J1" },
    });
    const res = createRes();
    await handleCreateRound(req, res);
    expect(mockService.createRound).toHaveBeenCalledWith(
      expect.objectContaining({ seasonId: "season-1", roundNumber: 1 }),
    );
    expect(res.statusCode).toBe(201);
  });
});

describe("Route: GET /leagues/seasons/:seasonId/standings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the sorted standings", async () => {
    mockService.computeSeasonStandings.mockResolvedValue([
      { teamId: "t1", points: 9, touchdownDifference: 5 },
      { teamId: "t2", points: 3, touchdownDifference: -2 },
    ]);
    const req = createReq({ params: { seasonId: "season-1" } });
    const res = createRes();
    await handleGetStandings(req, res);
    expect(mockService.computeSeasonStandings).toHaveBeenCalledWith("season-1");
    expect(res.payload).toMatchObject({
      standings: [
        expect.objectContaining({ teamId: "t1" }),
        expect.objectContaining({ teamId: "t2" }),
      ],
    });
  });

  it("returns 404 when the season does not exist", async () => {
    mockService.computeSeasonStandings.mockRejectedValue(
      new Error("Saison introuvable: X"),
    );
    const req = createReq({ params: { seasonId: "nope" } });
    const res = createRes();
    await handleGetStandings(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe("Route: POST /leagues/seasons/:seasonId/leave", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only allows the team owner to withdraw", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      ownerId: "other-user",
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleLeaveSeason(req, res);
    expect(res.statusCode).toBe(403);
    expect(mockService.withdrawParticipant).not.toHaveBeenCalled();
  });

  it("calls withdrawParticipant for the owner", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
    });
    mockService.withdrawParticipant.mockResolvedValue({
      id: "part-1",
      status: "withdrawn",
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleLeaveSeason(req, res);
    expect(mockService.withdrawParticipant).toHaveBeenCalledWith({
      seasonId: "season-1",
      teamId: "team-1",
    });
    expect(res.statusCode).toBe(200);
  });
});
