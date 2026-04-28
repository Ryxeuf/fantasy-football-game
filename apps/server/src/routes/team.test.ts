/**
 * S25.5n — Tests des handlers team migres vers `ApiResponse<T>`.
 *
 * Premiere tranche : `handleGenerateTeamName` (GET /team/name-generator),
 * `handleGetRoster` (GET /team/rosters/:id). Pattern aligne sur
 * `match.test.ts` : services et prisma mockes, req/res faits a la main.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    match: {
      findUnique: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    teamSelection: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    teamPlayer: {
      delete: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    teamStarPlayer: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    localMatch: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../utils/roster-helpers", () => ({
  getRosterFromDb: vi.fn(),
}));

vi.mock("../utils/team-values", () => ({
  updateTeamValues: vi.fn(),
}));

vi.mock("../utils/star-player-validation", () => ({
  requiresPair: vi.fn(),
  // Other exports kept undefined; tests only invoke routes that need requiresPair.
  validateStarPlayerHire: vi.fn(),
  validateStarPlayerPairs: vi.fn(),
  validateStarPlayersForTeam: vi.fn(),
  getTeamAvailableStarPlayers: vi.fn(),
  calculateStarPlayersCost: vi.fn(),
}));

vi.mock("../services/team-name-generator", () => ({
  generateTeamName: vi.fn((roster: string, _opts: unknown) => `Generated ${roster}`),
}));

vi.mock("../utils/server-log", () => ({
  serverLog: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import type { Response } from "express";
import { getRosterFromDb } from "../utils/roster-helpers";
import { generateTeamName } from "../services/team-name-generator";
import {
  handleGenerateTeamName,
  handleGetRoster,
  handleListAvailableTeams,
  handleListMyTeams,
  handleListTeamStarPlayers,
  handleRecalculateTeam,
  handleListAvailablePositions,
  handleDeleteTeamPlayer,
  handlePutTeamInfo,
  handleDeleteTeamStarPlayer,
  handlePurchase,
  handleChooseTeam,
  handleUpdateTeam,
  handleAddTeamPlayer,
  handleListAvailableStarPlayers,
  handleHireStarPlayer,
  handleUpdatePlayerSkills,
  handleBuildTeam,
  handleGetTeamDetail,
} from "./team";
import {
  requiresPair,
  getTeamAvailableStarPlayers,
  validateStarPlayerHire,
} from "../utils/star-player-validation";
import { updateTeamValues } from "../utils/team-values";
import type { AuthenticatedRequest } from "../middleware/authUser";

const mockGetRosterFromDb = getRosterFromDb as ReturnType<typeof vi.fn>;
const mockGenerateTeamName = generateTeamName as ReturnType<typeof vi.fn>;

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

describe("Route: GET /team/name-generator (S25.5n)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateTeamName.mockImplementation(
      (roster: string) => `Generated ${roster}`,
    );
  });

  it("returns ApiSuccess with name + roster when roster query param present", () => {
    const req = createReq({ query: { roster: "skaven" } });
    const res = createRes();
    handleGenerateTeamName(req, res);

    expect(mockGenerateTeamName).toHaveBeenCalledWith("skaven", {});
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: { name: "Generated skaven", roster: "skaven" },
    });
  });

  it("falls back to roster=generic when query param missing", () => {
    const req = createReq({ query: {} });
    const res = createRes();
    handleGenerateTeamName(req, res);

    expect(mockGenerateTeamName).toHaveBeenCalledWith("generic", {});
    expect(res.payload).toMatchObject({
      success: true,
      data: { name: "Generated generic", roster: "generic" },
    });
  });

  it("forwards seed option when seed query param present", () => {
    const req = createReq({ query: { roster: "lizardmen", seed: "abc-123" } });
    const res = createRes();
    handleGenerateTeamName(req, res);

    expect(mockGenerateTeamName).toHaveBeenCalledWith("lizardmen", {
      seed: "abc-123",
    });
  });
});

describe("Route: GET /team/rosters/:id (S25.5n)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with roster + ruleset when roster found", async () => {
    const fakeRoster = {
      name: "Skaven",
      budget: 1000,
      tier: "B",
      naf: true,
      positions: [],
    };
    mockGetRosterFromDb.mockResolvedValue(fakeRoster);

    const req = createReq({
      params: { id: "skaven" },
      query: { ruleset: "season_3" },
    });
    const res = createRes();
    await handleGetRoster(req, res);

    expect(mockGetRosterFromDb).toHaveBeenCalledWith(
      "skaven",
      "fr",
      "season_3",
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: { roster: fakeRoster, ruleset: "season_3" },
    });
  });

  it("returns 404 ApiError when roster slug not in ALLOWED_TEAMS", async () => {
    const req = createReq({ params: { id: "definitely-not-a-roster" } });
    const res = createRes();
    await handleGetRoster(req, res);

    expect(mockGetRosterFromDb).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({
      success: false,
      error: "Roster inconnu",
    });
  });

  it("returns 404 ApiError when roster not in DB", async () => {
    mockGetRosterFromDb.mockResolvedValue(null);

    const req = createReq({ params: { id: "skaven" } });
    const res = createRes();
    await handleGetRoster(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({
      success: false,
      error: "Roster non trouve en base de donnees",
    });
  });

  it("falls back to default ruleset when query param missing", async () => {
    mockGetRosterFromDb.mockResolvedValue({
      name: "Lizardmen",
      budget: 1000,
      tier: "A",
      naf: true,
      positions: [],
    });

    const req = createReq({ params: { id: "lizardmen" }, query: {} });
    const res = createRes();
    await handleGetRoster(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: { ruleset: expect.any(String) },
    });
  });
});

describe("Route: GET /team/available (S25.5o)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ApiSuccess with empty list for new user", async () => {
    const findMany = (
      vi.mocked(await import("../prisma")).prisma.team.findMany as ReturnType<
        typeof vi.fn
      >
    );
    findMany.mockResolvedValue([]);

    const req = createReq({ query: {} });
    const res = createRes();
    await handleListAvailableTeams(req, res);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: "user-1",
          selections: {
            none: {
              match: { status: { in: ["pending", "active"] } },
            },
          },
        }),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ success: true, data: { teams: [] } });
  });

  it("returns ApiSuccess with team list when prisma returns rows", async () => {
    const findMany = (
      vi.mocked(await import("../prisma")).prisma.team.findMany as ReturnType<
        typeof vi.fn
      >
    );
    const fakeTeams = [
      {
        id: "t-1",
        name: "Skavens A",
        roster: "skaven",
        ruleset: "season_3",
        createdAt: new Date("2026-01-01"),
      },
    ];
    findMany.mockResolvedValue(fakeTeams);

    const req = createReq({ query: {} });
    const res = createRes();
    await handleListAvailableTeams(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: { teams: fakeTeams },
    });
  });

  it("filters by ruleset when query param provided and valid", async () => {
    const findMany = (
      vi.mocked(await import("../prisma")).prisma.team.findMany as ReturnType<
        typeof vi.fn
      >
    );
    findMany.mockResolvedValue([]);

    const req = createReq({ query: { ruleset: "season_2" } });
    const res = createRes();
    await handleListAvailableTeams(req, res);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: "user-1",
          ruleset: "season_2",
        }),
      }),
    );
  });

  it("ignores invalid ruleset and returns all rulesets", async () => {
    const findMany = (
      vi.mocked(await import("../prisma")).prisma.team.findMany as ReturnType<
        typeof vi.fn
      >
    );
    findMany.mockResolvedValue([]);

    const req = createReq({ query: { ruleset: "definitely-not-valid" } });
    const res = createRes();
    await handleListAvailableTeams(req, res);

    const callArgs = findMany.mock.calls[0]![0];
    expect(callArgs.where).not.toHaveProperty("ruleset");
  });
});

describe("Route: GET /team/mine (S25.5p)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const mod = vi.mocked(await import("../prisma")).prisma;
    return {
      findMany: mod.team.findMany as ReturnType<typeof vi.fn>,
      count: mod.team.count as ReturnType<typeof vi.fn>,
    };
  }

  it("returns ApiSuccess with paginated teams + meta when query empty", async () => {
    const { findMany, count } = await getMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const req = createReq({ query: {} });
    const res = createRes();
    await handleListMyTeams(req, res);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: "user-1" },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        teams: [],
        meta: expect.objectContaining({
          total: 0,
          page: expect.any(Number),
          limit: expect.any(Number),
        }),
      },
    });
  });

  it("returns ApiSuccess with team list and total count when prisma returns rows", async () => {
    const { findMany, count } = await getMocks();
    const fakeTeams = [
      {
        id: "t-1",
        name: "Skavens A",
        roster: "skaven",
        ruleset: "season_3",
        createdAt: new Date("2026-01-01"),
        currentValue: 1000,
      },
      {
        id: "t-2",
        name: "Lizardmen B",
        roster: "lizardmen",
        ruleset: "season_3",
        createdAt: new Date("2026-01-02"),
        currentValue: 950,
      },
    ];
    findMany.mockResolvedValue(fakeTeams);
    count.mockResolvedValue(2);

    const req = createReq({ query: {} });
    const res = createRes();
    await handleListMyTeams(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: {
        teams: fakeTeams,
        meta: expect.objectContaining({ total: 2 }),
      },
    });
  });

  it("filters by ruleset when query param provided and valid", async () => {
    const { findMany, count } = await getMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const req = createReq({ query: { ruleset: "season_2" } });
    const res = createRes();
    await handleListMyTeams(req, res);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: "user-1", ruleset: "season_2" },
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: { ownerId: "user-1", ruleset: "season_2" },
    });
  });

  it("forwards limit/offset query params to prisma", async () => {
    const { findMany, count } = await getMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(42);

    const req = createReq({ query: { limit: "10", offset: "20" } });
    const res = createRes();
    await handleListMyTeams(req, res);

    const callArgs = findMany.mock.calls[0]![0];
    expect(callArgs.take).toBe(10);
    expect(callArgs.skip).toBe(20);
    expect(res.payload).toMatchObject({
      success: true,
      data: { meta: expect.objectContaining({ total: 42 }) },
    });
  });
});

describe("Route: GET /team/:id/star-players (S25.5q)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    return {
      findFirst: vi.mocked(await import("../prisma")).prisma.team
        .findFirst as ReturnType<typeof vi.fn>,
    };
  }

  it("returns 404 ApiError when team not found or owned by other user", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListTeamStarPlayers(req, res);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "team-1", ownerId: "user-1" },
      }),
    );
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns ApiSuccess with empty list when team has no star players", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      ruleset: "season_3",
      starPlayers: [],
    });

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListTeamStarPlayers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: { starPlayers: [], count: 0 },
    });
  });

  it("returns ApiSuccess enriched with star player base fields", async () => {
    const { findFirst } = await getMocks();
    const hiredAt = new Date("2026-01-01");
    findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      ruleset: "season_3",
      starPlayers: [
        {
          id: "sp-1",
          starPlayerSlug: "morg-n-thorg",
          cost: 430,
          hiredAt,
        },
      ],
    });

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListTeamStarPlayers(req, res);

    const payload = res.payload as {
      success: boolean;
      data: {
        starPlayers: Array<{ id: string; slug: string; cost: number; hiredAt: Date }>;
        count: number;
      };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.count).toBe(1);
    expect(payload.data.starPlayers[0]).toMatchObject({
      id: "sp-1",
      slug: "morg-n-thorg",
      cost: 430,
      hiredAt,
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListTeamStarPlayers(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: POST /team/:id/recalculate (S25.5r)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      findFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      findUnique: prismaMock.team.findUnique as ReturnType<typeof vi.fn>,
      updateValues: updateTeamValues as ReturnType<typeof vi.fn>,
    };
  }

  it("returns 404 ApiError when team not found or owned by other user", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleRecalculateTeam(req, res);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "team-1", ownerId: "user-1" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns ApiSuccess with updated team and recalculated message", async () => {
    const { findFirst, findUnique, updateValues } = await getMocks();
    findFirst.mockResolvedValue({ id: "team-1", ownerId: "user-1" });
    updateValues.mockResolvedValue({ teamValue: 1100, currentValue: 1050 });
    const updatedTeam = { id: "team-1", currentValue: 1050, players: [] };
    findUnique.mockResolvedValue(updatedTeam);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleRecalculateTeam(req, res);

    expect(updateValues).toHaveBeenCalledWith(expect.anything(), "team-1");
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        team: updatedTeam,
        message: expect.stringContaining("VE="),
      },
    });
  });

  it("returns 500 ApiError when updateTeamValues throws", async () => {
    const { findFirst, updateValues } = await getMocks();
    findFirst.mockResolvedValue({ id: "team-1", ownerId: "user-1" });
    updateValues.mockRejectedValue(new Error("compute failed"));

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleRecalculateTeam(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 500 ApiError when prisma findFirst throws", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleRecalculateTeam(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: GET /team/:id/available-positions (S25.5s)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    return {
      findFirst: vi.mocked(await import("../prisma")).prisma.team
        .findFirst as ReturnType<typeof vi.fn>,
    };
  }

  it("returns 404 ApiError when team not found", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailablePositions(req, res);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "team-1", ownerId: "user-1" },
      }),
    );
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when roster not recognized", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "unknown",
      ruleset: "season_3",
      players: [],
    });
    mockGetRosterFromDb.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailablePositions(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns ApiSuccess with computed availability per position", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "skaven",
      ruleset: "season_3",
      players: [
        { id: "p-1", position: "skaven_lineman" },
        { id: "p-2", position: "skaven_lineman" },
        { id: "p-3", position: "skaven_blitzer" },
      ],
    });
    mockGetRosterFromDb.mockResolvedValue({
      name: "Skaven",
      budget: 1000,
      tier: "B",
      naf: true,
      positions: [
        {
          slug: "skaven_lineman",
          displayName: "Lineman",
          cost: 50,
          min: 0,
          max: 12,
          ma: 7,
          st: 3,
          ag: 3,
          pa: 4,
          av: 8,
          skills: "",
        },
        {
          slug: "skaven_blitzer",
          displayName: "Blitzer",
          cost: 90,
          min: 0,
          max: 4,
          ma: 7,
          st: 3,
          ag: 3,
          pa: 4,
          av: 9,
          skills: "block",
        },
      ],
    });

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailablePositions(req, res);

    expect(res.statusCode).toBe(200);
    const payload = res.payload as {
      success: boolean;
      data: {
        availablePositions: Array<{
          key: string;
          currentCount: number;
          maxCount: number;
          canAdd: boolean;
        }>;
        currentPlayerCount: number;
        maxPlayers: number;
      };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.currentPlayerCount).toBe(3);
    expect(payload.data.maxPlayers).toBe(16);
    expect(payload.data.availablePositions).toHaveLength(2);
    const lineman = payload.data.availablePositions.find(
      (p) => p.key === "skaven_lineman",
    );
    expect(lineman?.currentCount).toBe(2);
    expect(lineman?.canAdd).toBe(true);
    const blitzer = payload.data.availablePositions.find(
      (p) => p.key === "skaven_blitzer",
    );
    expect(blitzer?.currentCount).toBe(1);
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailablePositions(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: DELETE /team/:id/players/:playerId (S25.5t)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      teamFindFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      teamFindUnique: prismaMock.team.findUnique as ReturnType<typeof vi.fn>,
      selectionFindFirst: prismaMock.teamSelection.findFirst as ReturnType<
        typeof vi.fn
      >,
      playerDelete: prismaMock.teamPlayer.delete as ReturnType<typeof vi.fn>,
      updateValues: updateTeamValues as ReturnType<typeof vi.fn>,
    };
  }

  function makeTeamWithPlayers(playerCount: number, includePlayerId?: string) {
    const players = Array.from({ length: playerCount }, (_, i) => ({
      id: `p-${i}`,
      position: "skaven_lineman",
    }));
    if (includePlayerId && !players.some((p) => p.id === includePlayerId)) {
      players[0]!.id = includePlayerId;
    }
    return { id: "team-1", ownerId: "user-1", players };
  }

  it("returns 404 ApiError when team not found", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1", playerId: "p-1" } });
    const res = createRes();
    await handleDeleteTeamPlayer(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when team is engaged in active match", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayers(12, "p-1"));
    selectionFindFirst.mockResolvedValue({ id: "sel-1" });

    const req = createReq({ params: { id: "team-1", playerId: "p-1" } });
    const res = createRes();
    await handleDeleteTeamPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("match"),
    });
  });

  it("returns 404 ApiError when player not in team", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayers(12));
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1", playerId: "p-missing" } });
    const res = createRes();
    await handleDeleteTeamPlayer(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Joueur"),
    });
  });

  it("returns 400 ApiError when team would drop below 11 players", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayers(11, "p-0"));
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1", playerId: "p-0" } });
    const res = createRes();
    await handleDeleteTeamPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("11"),
    });
  });

  it("returns ApiSuccess with updated team after delete", async () => {
    const {
      teamFindFirst,
      teamFindUnique,
      selectionFindFirst,
      playerDelete,
      updateValues,
    } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayers(12, "p-1"));
    selectionFindFirst.mockResolvedValue(null);
    playerDelete.mockResolvedValue({ id: "p-1" });
    updateValues.mockResolvedValue({ teamValue: 1000, currentValue: 1000 });
    const updatedTeam = { id: "team-1", players: [] };
    teamFindUnique.mockResolvedValue(updatedTeam);

    const req = createReq({ params: { id: "team-1", playerId: "p-1" } });
    const res = createRes();
    await handleDeleteTeamPlayer(req, res);

    expect(playerDelete).toHaveBeenCalledWith({ where: { id: "p-1" } });
    expect(updateValues).toHaveBeenCalledWith(expect.anything(), "team-1");
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: { team: updatedTeam },
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({ params: { id: "team-1", playerId: "p-1" } });
    const res = createRes();
    await handleDeleteTeamPlayer(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: PUT /team/:id/info (S25.5u)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      teamFindFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      teamFindUnique: prismaMock.team.findUnique as ReturnType<typeof vi.fn>,
      teamUpdate: prismaMock.team.update as ReturnType<typeof vi.fn>,
      selectionFindFirst: prismaMock.teamSelection.findFirst as ReturnType<
        typeof vi.fn
      >,
      updateValues: updateTeamValues as ReturnType<typeof vi.fn>,
    };
  }

  it("returns 404 ApiError when team not found", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1" }, body: { rerolls: 4 } });
    const res = createRes();
    await handlePutTeamInfo(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when team is engaged in active match", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue({ id: "team-1", ownerId: "user-1" });
    selectionFindFirst.mockResolvedValue({ id: "sel-1" });

    const req = createReq({ params: { id: "team-1" }, body: { rerolls: 4 } });
    const res = createRes();
    await handlePutTeamInfo(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("match"),
    });
  });

  it("returns ApiSuccess with updated team and forwards only defined fields", async () => {
    const {
      teamFindFirst,
      teamFindUnique,
      teamUpdate,
      selectionFindFirst,
      updateValues,
    } = await getMocks();
    teamFindFirst.mockResolvedValue({ id: "team-1", ownerId: "user-1" });
    selectionFindFirst.mockResolvedValue(null);
    teamUpdate.mockResolvedValue({ id: "team-1", players: [] });
    updateValues.mockResolvedValue({ teamValue: 1000, currentValue: 1000 });
    const finalTeam = { id: "team-1", rerolls: 4, players: [] };
    teamFindUnique.mockResolvedValue(finalTeam);

    const req = createReq({
      params: { id: "team-1" },
      body: {
        rerolls: 4,
        cheerleaders: 2,
        // assistants/apothecary/dedicatedFans intentionally omitted
      },
    });
    const res = createRes();
    await handlePutTeamInfo(req, res);

    expect(teamUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "team-1" },
        data: { rerolls: 4, cheerleaders: 2 },
      }),
    );
    expect(updateValues).toHaveBeenCalledWith(expect.anything(), "team-1");
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: { team: finalTeam },
    });
  });

  it("returns 500 ApiError when prisma update throws", async () => {
    const { teamFindFirst, selectionFindFirst, teamUpdate } = await getMocks();
    teamFindFirst.mockResolvedValue({ id: "team-1", ownerId: "user-1" });
    selectionFindFirst.mockResolvedValue(null);
    teamUpdate.mockRejectedValue(new Error("update failed"));

    const req = createReq({ params: { id: "team-1" }, body: { rerolls: 4 } });
    const res = createRes();
    await handlePutTeamInfo(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: DELETE /team/:id/star-players/:starPlayerId (S25.5v)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      teamFindFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      teamFindUnique: prismaMock.team.findUnique as ReturnType<typeof vi.fn>,
      selectionFindFirst: prismaMock.teamSelection.findFirst as ReturnType<
        typeof vi.fn
      >,
      starPlayerDeleteMany: prismaMock.teamStarPlayer.deleteMany as ReturnType<
        typeof vi.fn
      >,
      mockRequiresPair: requiresPair as ReturnType<typeof vi.fn>,
      updateValues: updateTeamValues as ReturnType<typeof vi.fn>,
    };
  }

  it("returns 404 ApiError when team not found", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1", starPlayerId: "sp-1" },
    });
    const res = createRes();
    await handleDeleteTeamStarPlayer(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when team is engaged in active match", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      starPlayers: [{ id: "sp-1", starPlayerSlug: "morg-n-thorg" }],
    });
    selectionFindFirst.mockResolvedValue({ id: "sel-1" });

    const req = createReq({
      params: { id: "team-1", starPlayerId: "sp-1" },
    });
    const res = createRes();
    await handleDeleteTeamStarPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 404 ApiError when star player not in team", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      starPlayers: [{ id: "sp-other", starPlayerSlug: "headsplitter" }],
    });
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1", starPlayerId: "sp-missing" },
    });
    const res = createRes();
    await handleDeleteTeamStarPlayer(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("removes a single star player and returns ApiSuccess with updated team", async () => {
    const {
      teamFindFirst,
      teamFindUnique,
      selectionFindFirst,
      starPlayerDeleteMany,
      mockRequiresPair,
      updateValues,
    } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      starPlayers: [{ id: "sp-1", starPlayerSlug: "morg-n-thorg" }],
    });
    selectionFindFirst.mockResolvedValue(null);
    mockRequiresPair.mockReturnValue(null);
    starPlayerDeleteMany.mockResolvedValue({ count: 1 });
    updateValues.mockResolvedValue({ teamValue: 1000, currentValue: 1000 });
    const updatedTeam = { id: "team-1", players: [], starPlayers: [] };
    teamFindUnique.mockResolvedValue(updatedTeam);

    const req = createReq({
      params: { id: "team-1", starPlayerId: "sp-1" },
    });
    const res = createRes();
    await handleDeleteTeamStarPlayer(req, res);

    expect(starPlayerDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["sp-1"] } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        team: updatedTeam,
        message: expect.stringContaining("retire"),
      },
    });
  });

  it("removes pair when star player has a required partner", async () => {
    const {
      teamFindFirst,
      teamFindUnique,
      selectionFindFirst,
      starPlayerDeleteMany,
      mockRequiresPair,
      updateValues,
    } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      starPlayers: [
        { id: "sp-1", starPlayerSlug: "deeproot-strongbranch" },
        { id: "sp-2", starPlayerSlug: "willow-rosebark" },
      ],
    });
    selectionFindFirst.mockResolvedValue(null);
    mockRequiresPair.mockReturnValue("willow-rosebark");
    starPlayerDeleteMany.mockResolvedValue({ count: 2 });
    updateValues.mockResolvedValue({ teamValue: 1000, currentValue: 1000 });
    teamFindUnique.mockResolvedValue({
      id: "team-1",
      players: [],
      starPlayers: [],
    });

    const req = createReq({
      params: { id: "team-1", starPlayerId: "sp-1" },
    });
    const res = createRes();
    await handleDeleteTeamStarPlayer(req, res);

    expect(starPlayerDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["sp-1", "sp-2"] } },
    });
    expect(res.payload).toMatchObject({
      success: true,
      data: { message: expect.stringContaining("2 Star Players") },
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({
      params: { id: "team-1", starPlayerId: "sp-1" },
    });
    const res = createRes();
    await handleDeleteTeamStarPlayer(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: POST /team/:id/purchase (S25.5w)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      teamFindFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      teamFindUnique: prismaMock.team.findUnique as ReturnType<typeof vi.fn>,
      teamUpdate: prismaMock.team.update as ReturnType<typeof vi.fn>,
      selectionFindFirst: prismaMock.teamSelection.findFirst as ReturnType<
        typeof vi.fn
      >,
      updateValues: updateTeamValues as ReturnType<typeof vi.fn>,
    };
  }

  it("returns 404 ApiError when team not found", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: { type: "cheerleader" },
    });
    const res = createRes();
    await handlePurchase(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when team is engaged in active match", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      treasury: 100000,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 0,
      rerolls: 0,
      players: [],
    });
    selectionFindFirst.mockResolvedValue({ id: "sel-1" });

    const req = createReq({
      params: { id: "team-1" },
      body: { type: "cheerleader" },
    });
    const res = createRes();
    await handlePurchase(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("buys a cheerleader and returns ApiSuccess with description", async () => {
    const {
      teamFindFirst,
      teamFindUnique,
      teamUpdate,
      selectionFindFirst,
      updateValues,
    } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      treasury: 50000,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 0,
      rerolls: 0,
      players: [],
    });
    selectionFindFirst.mockResolvedValue(null);
    teamUpdate.mockResolvedValue({});
    updateValues.mockResolvedValue({ teamValue: 1000, currentValue: 1000 });
    const updatedTeam = { id: "team-1", players: [], cheerleaders: 1 };
    teamFindUnique.mockResolvedValue(updatedTeam);

    const req = createReq({
      params: { id: "team-1" },
      body: { type: "cheerleader" },
    });
    const res = createRes();
    await handlePurchase(req, res);

    expect(teamUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cheerleaders: 1,
          treasury: 40000,
        }),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        team: updatedTeam,
        purchase: { type: "cheerleader", cost: 10000 },
      },
    });
  });

  it("returns 400 ApiError when treasury insufficient (cheerleader)", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      treasury: 5000,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 0,
      rerolls: 0,
      players: [],
    });
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: { type: "cheerleader" },
    });
    const res = createRes();
    await handlePurchase(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("insuffisante"),
    });
  });

  it("returns 400 ApiError when apothecary already hired", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      treasury: 100000,
      cheerleaders: 0,
      assistants: 0,
      apothecary: true,
      dedicatedFans: 0,
      rerolls: 0,
      players: [],
    });
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: { type: "apothecary" },
    });
    const res = createRes();
    await handlePurchase(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("apothicaire"),
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({
      params: { id: "team-1" },
      body: { type: "cheerleader" },
    });
    const res = createRes();
    await handlePurchase(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: POST /team/choose (S25.5x)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      matchFindUnique: prismaMock.match.findUnique as ReturnType<typeof vi.fn>,
      transaction: prismaMock.$transaction as ReturnType<typeof vi.fn>,
    };
  }

  it("returns 404 ApiError when match not found", async () => {
    const { matchFindUnique } = await getMocks();
    matchFindUnique.mockResolvedValue(null);

    const req = createReq({ body: { matchId: "m-1", teamId: "t-1" } });
    const res = createRes();
    await handleChooseTeam(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when match status is not pending", async () => {
    const { matchFindUnique } = await getMocks();
    matchFindUnique.mockResolvedValue({ id: "m-1", status: "active" });

    const req = createReq({ body: { matchId: "m-1", teamId: "t-1" } });
    const res = createRes();
    await handleChooseTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("active"),
    });
  });

  it("returns 201 ApiSuccess with selection when transaction completes", async () => {
    const { matchFindUnique, transaction } = await getMocks();
    matchFindUnique.mockResolvedValue({ id: "m-1", status: "pending" });
    const selection = {
      id: "sel-1",
      matchId: "m-1",
      userId: "user-1",
      team: "t-1",
      teamRef: { id: "t-1", name: "Skavens" },
    };
    transaction.mockResolvedValue(selection);

    const req = createReq({ body: { matchId: "m-1", teamId: "t-1" } });
    const res = createRes();
    await handleChooseTeam(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.payload).toMatchObject({
      success: true,
      data: { selection },
    });
  });

  it("returns 409 ApiError when transaction throws status=409", async () => {
    const { matchFindUnique, transaction } = await getMocks();
    matchFindUnique.mockResolvedValue({ id: "m-1", status: "pending" });
    const err = Object.assign(
      new Error("Vous avez deja choisi une equipe pour ce match"),
      { status: 409 },
    );
    transaction.mockRejectedValue(err);

    const req = createReq({ body: { matchId: "m-1", teamId: "t-1" } });
    const res = createRes();
    await handleChooseTeam(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("deja choisi"),
    });
  });

  it("returns 409 ApiError on prisma P2002 unique constraint with userId", async () => {
    const { matchFindUnique, transaction } = await getMocks();
    matchFindUnique.mockResolvedValue({ id: "m-1", status: "pending" });
    const err = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["matchId", "userId"] },
    });
    transaction.mockRejectedValue(err);

    const req = createReq({ body: { matchId: "m-1", teamId: "t-1" } });
    const res = createRes();
    await handleChooseTeam(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("deja choisi"),
    });
  });

  it("returns 500 ApiError on unexpected throw without status/code", async () => {
    const { matchFindUnique, transaction } = await getMocks();
    matchFindUnique.mockResolvedValue({ id: "m-1", status: "pending" });
    transaction.mockRejectedValue(new Error("boom"));

    const req = createReq({ body: { matchId: "m-1", teamId: "t-1" } });
    const res = createRes();
    await handleChooseTeam(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: PUT /team/:id (S25.5y)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      teamFindFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      selectionFindFirst: prismaMock.teamSelection.findFirst as ReturnType<
        typeof vi.fn
      >,
      transaction: prismaMock.$transaction as ReturnType<typeof vi.fn>,
    };
  }

  function makeTeamWithPlayers() {
    return {
      id: "team-1",
      ownerId: "user-1",
      name: "Original Name",
      players: [
        { id: "p-1", name: "Joueur A", number: 1 },
        { id: "p-2", name: "Joueur B", number: 2 },
      ],
    };
  }

  it("returns 404 ApiError when team not found", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: { name: "x", players: [] },
    });
    const res = createRes();
    await handleUpdateTeam(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when team is engaged in active match", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayers());
    selectionFindFirst.mockResolvedValue({ id: "sel-1" });

    const req = createReq({
      params: { id: "team-1" },
      body: { players: [] },
    });
    const res = createRes();
    await handleUpdateTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when provided player ids contain invalid ids", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayers());
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: {
        players: [
          { id: "p-1", name: "A", number: 1 },
          { id: "p-rogue", name: "X", number: 99 },
        ],
      },
    });
    const res = createRes();
    await handleUpdateTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("invalides"),
    });
  });

  it("returns 400 ApiError when player numbers are not unique", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayers());
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: {
        players: [
          { id: "p-1", name: "A", number: 5 },
          { id: "p-2", name: "B", number: 5 },
        ],
      },
    });
    const res = createRes();
    await handleUpdateTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("uniques"),
    });
  });

  it("returns ApiSuccess with optimistic team payload after transaction", async () => {
    const { teamFindFirst, selectionFindFirst, transaction } =
      await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayers());
    selectionFindFirst.mockResolvedValue(null);
    transaction.mockResolvedValue([]);

    const req = createReq({
      params: { id: "team-1" },
      body: {
        name: "  New Name  ",
        players: [
          { id: "p-1", name: "  A renamed ", number: 10 },
          { id: "p-2", name: "B renamed", number: 11 },
        ],
      },
    });
    const res = createRes();
    await handleUpdateTeam(req, res);

    expect(transaction).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    const payload = res.payload as {
      success: boolean;
      data: {
        team: {
          name: string;
          players: Array<{ id: string; name: string; number: number }>;
        };
      };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.team.name).toBe("New Name");
    expect(payload.data.team.players[0]).toMatchObject({
      id: "p-1",
      name: "A renamed",
      number: 10,
    });
    expect(payload.data.team.players[1]).toMatchObject({
      id: "p-2",
      name: "B renamed",
      number: 11,
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({
      params: { id: "team-1" },
      body: { players: [] },
    });
    const res = createRes();
    await handleUpdateTeam(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: POST /team/:id/players (S25.5z)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      teamFindFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      selectionFindFirst: prismaMock.teamSelection.findFirst as ReturnType<
        typeof vi.fn
      >,
    };
  }

  function makeTeam(overrides: Partial<{ players: any[] }> = {}) {
    return {
      id: "team-1",
      ownerId: "user-1",
      roster: "skaven",
      ruleset: "season_3",
      initialBudget: 1000,
      players: [],
      ...overrides,
    };
  }

  it("returns 404 ApiError when team not found", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: { position: "skaven_lineman", name: "X", number: 5 },
    });
    const res = createRes();
    await handleAddTeamPlayer(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when team is engaged in active match", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeam());
    selectionFindFirst.mockResolvedValue({ id: "sel-1" });

    const req = createReq({
      params: { id: "team-1" },
      body: { position: "skaven_lineman", name: "X", number: 5 },
    });
    const res = createRes();
    await handleAddTeamPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when team already has 16 players", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    const fullPlayers = Array.from({ length: 16 }, (_, i) => ({
      id: `p-${i}`,
      number: i + 1,
      name: `Player ${i}`,
      position: "skaven_lineman",
    }));
    teamFindFirst.mockResolvedValue(makeTeam({ players: fullPlayers }));
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: { position: "skaven_lineman", name: "X", number: 99 },
    });
    const res = createRes();
    await handleAddTeamPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("16"),
    });
  });

  it("returns 400 ApiError when number already used", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(
      makeTeam({
        players: [
          {
            id: "p-1",
            number: 5,
            name: "Existing",
            position: "skaven_lineman",
          },
        ],
      }),
    );
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: { position: "skaven_lineman", name: "Newcomer", number: 5 },
    });
    const res = createRes();
    await handleAddTeamPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Existing"),
    });
  });

  it("returns 400 ApiError when roster not recognized", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeam());
    selectionFindFirst.mockResolvedValue(null);
    mockGetRosterFromDb.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: { position: "skaven_lineman", name: "X", number: 5 },
    });
    const res = createRes();
    await handleAddTeamPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Roster"),
    });
  });

  it("returns 400 ApiError when position not in roster", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeam());
    selectionFindFirst.mockResolvedValue(null);
    mockGetRosterFromDb.mockResolvedValue({
      name: "Skaven",
      budget: 1000,
      tier: "B",
      naf: true,
      positions: [],
    });

    const req = createReq({
      params: { id: "team-1" },
      body: { position: "unknown_position", name: "X", number: 5 },
    });
    const res = createRes();
    await handleAddTeamPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Position"),
    });
  });

  it("returns 400 ApiError when position max reached", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(
      makeTeam({
        players: [
          {
            id: "p-1",
            number: 1,
            name: "A",
            position: "skaven_blitzer",
          },
        ],
      }),
    );
    selectionFindFirst.mockResolvedValue(null);
    mockGetRosterFromDb.mockResolvedValue({
      name: "Skaven",
      budget: 1000,
      tier: "B",
      naf: true,
      positions: [
        {
          slug: "skaven_blitzer",
          displayName: "Blitzer",
          cost: 90,
          min: 0,
          max: 1,
          ma: 7,
          st: 3,
          ag: 3,
          pa: 4,
          av: 9,
          skills: "",
        },
      ],
    });

    const req = createReq({
      params: { id: "team-1" },
      body: { position: "skaven_blitzer", name: "B", number: 2 },
    });
    const res = createRes();
    await handleAddTeamPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Limite"),
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({
      params: { id: "team-1" },
      body: { position: "skaven_lineman", name: "X", number: 5 },
    });
    const res = createRes();
    await handleAddTeamPlayer(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: GET /team/:id/available-star-players (S25.5aa)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      teamFindFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      mockGetTeamAvailable: getTeamAvailableStarPlayers as ReturnType<
        typeof vi.fn
      >,
      mockRequiresPair: requiresPair as ReturnType<typeof vi.fn>,
    };
  }

  it("returns 404 ApiError when team not found", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailableStarPlayers(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns ApiSuccess with empty list when no star players available for roster", async () => {
    const { teamFindFirst, mockGetTeamAvailable } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "skaven",
      ruleset: "season_3",
      initialBudget: 1000,
      players: [],
      starPlayers: [],
    });
    mockGetTeamAvailable.mockReturnValue([]);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailableStarPlayers(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        availableStarPlayers: [],
        currentPlayerCount: 0,
        currentStarPlayerCount: 0,
        totalPlayers: 0,
        maxPlayers: 16,
        availableBudget: 1000,
        totalBudget: 1000,
      },
    });
  });

  it("enriches star players with hire-state flags (no pair, can hire)", async () => {
    const { teamFindFirst, mockGetTeamAvailable, mockRequiresPair } =
      await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "skaven",
      ruleset: "season_3",
      initialBudget: 1000,
      players: [],
      starPlayers: [],
    });
    mockGetTeamAvailable.mockReturnValue([
      { slug: "morg-n-thorg", displayName: "Morg", cost: 430 },
    ]);
    mockRequiresPair.mockReturnValue(null);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailableStarPlayers(req, res);

    expect(res.statusCode).toBe(200);
    const payload = res.payload as {
      success: boolean;
      data: {
        availableStarPlayers: Array<{
          slug: string;
          isHired: boolean;
          canHire: boolean;
          needsPair: boolean;
        }>;
      };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.availableStarPlayers).toHaveLength(1);
    expect(payload.data.availableStarPlayers[0]).toMatchObject({
      slug: "morg-n-thorg",
      isHired: false,
      canHire: true,
      needsPair: false,
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailableStarPlayers(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: POST /team/:id/star-players (S25.5ab)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      teamFindFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      teamFindUnique: prismaMock.team.findUnique as ReturnType<typeof vi.fn>,
      selectionFindFirst: prismaMock.teamSelection.findFirst as ReturnType<
        typeof vi.fn
      >,
      starPlayerCreate: prismaMock.teamStarPlayer.create as ReturnType<
        typeof vi.fn
      >,
      mockValidate: validateStarPlayerHire as ReturnType<typeof vi.fn>,
      mockRequiresPair: requiresPair as ReturnType<typeof vi.fn>,
    };
  }

  it("returns 404 ApiError when team not found", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1" },
      body: { starPlayerSlug: "morg-n-thorg" },
    });
    const res = createRes();
    await handleHireStarPlayer(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when team is engaged in active match", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "skaven",
      ruleset: "season_3",
      initialBudget: 1000,
      players: [],
      starPlayers: [],
    });
    selectionFindFirst.mockResolvedValue({ id: "sel-1" });

    const req = createReq({
      params: { id: "team-1" },
      body: { starPlayerSlug: "morg-n-thorg" },
    });
    const res = createRes();
    await handleHireStarPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when validation fails", async () => {
    const { teamFindFirst, selectionFindFirst, mockValidate } =
      await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "skaven",
      ruleset: "season_3",
      initialBudget: 1000,
      players: [],
      starPlayers: [],
    });
    selectionFindFirst.mockResolvedValue(null);
    mockValidate.mockReturnValue({
      valid: false,
      error: "Star Player non eligible",
    });

    const req = createReq({
      params: { id: "team-1" },
      body: { starPlayerSlug: "morg-n-thorg" },
    });
    const res = createRes();
    await handleHireStarPlayer(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("eligible"),
    });
  });

  it("returns 201 ApiSuccess when single star player is hired (no pair)", async () => {
    const {
      teamFindFirst,
      teamFindUnique,
      selectionFindFirst,
      starPlayerCreate,
      mockValidate,
      mockRequiresPair,
    } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "skaven",
      ruleset: "season_3",
      initialBudget: 1000,
      players: [],
      starPlayers: [],
    });
    selectionFindFirst.mockResolvedValue(null);
    mockValidate.mockReturnValue({
      valid: true,
      starPlayer: { slug: "morg-n-thorg", displayName: "Morg", cost: 430 },
    });
    mockRequiresPair.mockReturnValue(null);
    starPlayerCreate.mockResolvedValue({
      id: "sp-1",
      starPlayerSlug: "morg-n-thorg",
      cost: 430,
      hiredAt: new Date(),
    });
    teamFindUnique.mockResolvedValue({
      id: "team-1",
      players: [],
      starPlayers: [],
    });

    const req = createReq({
      params: { id: "team-1" },
      body: { starPlayerSlug: "morg-n-thorg" },
    });
    const res = createRes();
    await handleHireStarPlayer(req, res);

    expect(starPlayerCreate).toHaveBeenCalledWith({
      data: {
        teamId: "team-1",
        starPlayerSlug: "morg-n-thorg",
        cost: 430,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        team: expect.any(Object),
        newStarPlayers: expect.any(Array),
        message: expect.stringContaining("recrute"),
      },
    });
  });

  it("returns 409 ApiError on prisma P2002 unique constraint", async () => {
    const {
      teamFindFirst,
      selectionFindFirst,
      starPlayerCreate,
      mockValidate,
      mockRequiresPair,
    } = await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "skaven",
      ruleset: "season_3",
      initialBudget: 1000,
      players: [],
      starPlayers: [],
    });
    selectionFindFirst.mockResolvedValue(null);
    mockValidate.mockReturnValue({
      valid: true,
      starPlayer: { slug: "morg-n-thorg", displayName: "Morg", cost: 430 },
    });
    mockRequiresPair.mockReturnValue(null);
    starPlayerCreate.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const req = createReq({
      params: { id: "team-1" },
      body: { starPlayerSlug: "morg-n-thorg" },
    });
    const res = createRes();
    await handleHireStarPlayer(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("deja"),
    });
  });

  it("returns 500 ApiError on unexpected throw without P2002", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({
      params: { id: "team-1" },
      body: { starPlayerSlug: "morg-n-thorg" },
    });
    const res = createRes();
    await handleHireStarPlayer(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: PUT /team/:id/players/:playerId/skills (S25.5ac)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      teamFindFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      selectionFindFirst: prismaMock.teamSelection.findFirst as ReturnType<
        typeof vi.fn
      >,
    };
  }

  function makeTeamWithPlayer(playerOverrides: Record<string, unknown> = {}) {
    return {
      id: "team-1",
      ownerId: "user-1",
      players: [
        {
          id: "p-1",
          position: "skaven_lineman",
          skills: "",
          dead: false,
          spp: 0,
          advancements: "[]",
          ...playerOverrides,
        },
      ],
    };
  }

  it("returns 400 ApiError when chosen advancement missing skillSlug", async () => {
    const req = createReq({
      params: { id: "team-1", playerId: "p-1" },
      body: { advancementType: "primary" },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("skillSlug"),
    });
  });

  it("returns 400 ApiError when random advancement missing skillCategory", async () => {
    const req = createReq({
      params: { id: "team-1", playerId: "p-1" },
      body: { advancementType: "random-primary" },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("skillCategory"),
    });
  });

  it("returns 404 ApiError when team not found", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1", playerId: "p-1" },
      body: { advancementType: "primary", skillSlug: "block" },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns 400 ApiError when team is engaged in active match", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayer());
    selectionFindFirst.mockResolvedValue({ id: "sel-1" });

    const req = createReq({
      params: { id: "team-1", playerId: "p-1" },
      body: { advancementType: "primary", skillSlug: "block" },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("match"),
    });
  });

  it("returns 404 ApiError when player not in team", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayer());
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1", playerId: "p-rogue" },
      body: { advancementType: "primary", skillSlug: "block" },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Joueur"),
    });
  });

  it("returns 400 ApiError when player is dead", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(makeTeamWithPlayer({ dead: true }));
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1", playerId: "p-1" },
      body: { advancementType: "primary", skillSlug: "block" },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("mort"),
    });
  });

  it("returns 400 ApiError when player has 6 advancements already", async () => {
    const { teamFindFirst, selectionFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(
      makeTeamWithPlayer({
        advancements: JSON.stringify(
          Array.from({ length: 6 }, (_, i) => ({
            skillSlug: `s${i}`,
            type: "primary",
            isRandom: false,
            at: 0,
          })),
        ),
      }),
    );
    selectionFindFirst.mockResolvedValue(null);

    const req = createReq({
      params: { id: "team-1", playerId: "p-1" },
      body: { advancementType: "primary", skillSlug: "block" },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("6 avancements"),
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({
      params: { id: "team-1", playerId: "p-1" },
      body: { advancementType: "primary", skillSlug: "block" },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: POST /team/build (S25.5ad)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 ApiError when roster is not allowed", async () => {
    const req = createReq({
      body: {
        name: "X",
        roster: "not-a-roster",
        choices: [],
      },
    });
    const res = createRes();
    await handleBuildTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Roster"),
    });
  });

  it("returns 400 ApiError when roster not found in DB", async () => {
    mockGetRosterFromDb.mockResolvedValue(null);

    const req = createReq({
      body: {
        name: "X",
        roster: "skaven",
        choices: [],
      },
    });
    const res = createRes();
    await handleBuildTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Roster"),
    });
  });

  it("returns 400 ApiError when a position count violates min/max", async () => {
    mockGetRosterFromDb.mockResolvedValue({
      name: "Skaven",
      budget: 1000,
      tier: "B",
      naf: true,
      positions: [
        {
          slug: "skaven_blitzer",
          displayName: "Blitzer",
          cost: 90,
          min: 1,
          max: 4,
          ma: 7,
          st: 3,
          ag: 3,
          pa: 4,
          av: 9,
          skills: "",
        },
      ],
    });

    const req = createReq({
      body: {
        name: "X",
        roster: "skaven",
        choices: [{ key: "skaven_blitzer", count: 0 }],
      },
    });
    const res = createRes();
    await handleBuildTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Blitzer"),
    });
  });

  it("returns 400 ApiError when total players is below 11", async () => {
    mockGetRosterFromDb.mockResolvedValue({
      name: "Skaven",
      budget: 1000,
      tier: "B",
      naf: true,
      positions: [
        {
          slug: "skaven_lineman",
          displayName: "Lineman",
          cost: 50,
          min: 0,
          max: 12,
          ma: 7,
          st: 3,
          ag: 3,
          pa: 4,
          av: 8,
          skills: "",
        },
      ],
    });

    const req = createReq({
      body: {
        name: "X",
        roster: "skaven",
        choices: [{ key: "skaven_lineman", count: 5 }],
      },
    });
    const res = createRes();
    await handleBuildTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("11"),
    });
  });

  it("returns 400 ApiError when budget is exceeded", async () => {
    mockGetRosterFromDb.mockResolvedValue({
      name: "Skaven",
      budget: 1000,
      tier: "B",
      naf: true,
      positions: [
        {
          slug: "skaven_lineman",
          displayName: "Lineman",
          cost: 200,
          min: 0,
          max: 12,
          ma: 7,
          st: 3,
          ag: 3,
          pa: 4,
          av: 8,
          skills: "",
        },
      ],
    });

    const req = createReq({
      body: {
        name: "X",
        roster: "skaven",
        teamValue: 1000,
        choices: [{ key: "skaven_lineman", count: 11 }],
      },
    });
    const res = createRes();
    await handleBuildTeam(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Budget"),
    });
  });

  it("returns 500 ApiError when getRosterFromDb throws", async () => {
    mockGetRosterFromDb.mockRejectedValue(new Error("db down"));

    const req = createReq({
      body: {
        name: "X",
        roster: "skaven",
        choices: [],
      },
    });
    const res = createRes();
    await handleBuildTeam(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});

describe("Route: GET /team/:id (S25.5ae)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function getMocks() {
    const prismaMock = vi.mocked(await import("../prisma")).prisma;
    return {
      teamFindFirst: prismaMock.team.findFirst as ReturnType<typeof vi.fn>,
      selectionFindFirst: prismaMock.teamSelection.findFirst as ReturnType<
        typeof vi.fn
      >,
      localMatchFindMany: prismaMock.localMatch.findMany as ReturnType<
        typeof vi.fn
      >,
    };
  }

  it("returns 404 ApiError when team not found", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleGetTeamDetail(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringContaining("Introuvable"),
    });
  });

  it("returns ApiSuccess with team + currentMatch + zero localMatchStats when no local matches", async () => {
    const { teamFindFirst, selectionFindFirst, localMatchFindMany } =
      await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      ruleset: "season_3",
      players: [],
      starPlayers: [],
    });
    selectionFindFirst.mockResolvedValue(null);
    localMatchFindMany.mockResolvedValue([]);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleGetTeamDetail(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: {
        team: expect.objectContaining({ id: "team-1" }),
        currentMatch: null,
        localMatchStats: {
          total: 0,
          pending: 0,
          waitingForPlayer: 0,
          inProgress: 0,
          completed: 0,
          cancelled: 0,
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          touchdownsFor: 0,
          touchdownsAgainst: 0,
          touchdownDiff: 0,
        },
      },
    });
  });

  it("computes localMatchStats with wins/losses/draws and TD totals", async () => {
    const { teamFindFirst, selectionFindFirst, localMatchFindMany } =
      await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      ruleset: "season_3",
      players: [],
      starPlayers: [],
    });
    selectionFindFirst.mockResolvedValue(null);
    // 1 win as A, 1 loss as B, 1 draw as A, 1 in_progress, 1 cancelled
    localMatchFindMany.mockResolvedValue([
      {
        id: "lm-win",
        status: "completed",
        teamAId: "team-1",
        teamBId: "other",
        scoreTeamA: 3,
        scoreTeamB: 1,
      },
      {
        id: "lm-loss",
        status: "completed",
        teamAId: "other",
        teamBId: "team-1",
        scoreTeamA: 4,
        scoreTeamB: 2,
      },
      {
        id: "lm-draw",
        status: "completed",
        teamAId: "team-1",
        teamBId: "other",
        scoreTeamA: 1,
        scoreTeamB: 1,
      },
      {
        id: "lm-prog",
        status: "in_progress",
        teamAId: "team-1",
        teamBId: "other",
        scoreTeamA: 0,
        scoreTeamB: 0,
      },
      {
        id: "lm-cancel",
        status: "cancelled",
        teamAId: "team-1",
        teamBId: "other",
        scoreTeamA: 0,
        scoreTeamB: 0,
      },
    ]);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleGetTeamDetail(req, res);

    const payload = res.payload as {
      success: boolean;
      data: { localMatchStats: Record<string, number> };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.localMatchStats).toMatchObject({
      total: 5,
      completed: 3,
      inProgress: 1,
      cancelled: 1,
      matchesPlayed: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      // wins TF=3, loss TF=2, draw TF=1 -> 6
      touchdownsFor: 6,
      // wins TA=1, loss TA=4, draw TA=1 -> 6
      touchdownsAgainst: 6,
      touchdownDiff: 0,
    });
  });

  it("returns ApiSuccess with currentMatch when team is selected for a match", async () => {
    const { teamFindFirst, selectionFindFirst, localMatchFindMany } =
      await getMocks();
    teamFindFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      ruleset: "season_3",
      players: [],
      starPlayers: [],
    });
    const match = { id: "m-1", status: "active" };
    selectionFindFirst.mockResolvedValue({ id: "sel-1", match });
    localMatchFindMany.mockResolvedValue([]);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleGetTeamDetail(req, res);

    expect(res.payload).toMatchObject({
      success: true,
      data: { currentMatch: match },
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { teamFindFirst } = await getMocks();
    teamFindFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleGetTeamDetail(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});
