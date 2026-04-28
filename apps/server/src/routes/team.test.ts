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
    team: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    teamSelection: {
      findFirst: vi.fn(),
    },
    localMatch: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../utils/roster-helpers", () => ({
  getRosterFromDb: vi.fn(),
}));

vi.mock("../utils/team-values", () => ({
  updateTeamValues: vi.fn(),
}));

vi.mock("../utils/star-player-validation", () => ({
  validateStarPlayerHire: vi.fn(),
  validateStarPlayerPairs: vi.fn(),
  validateStarPlayersForTeam: vi.fn(),
  getTeamAvailableStarPlayers: vi.fn(),
  calculateStarPlayersCost: vi.fn(),
  requiresPair: vi.fn(() => null),
}));

vi.mock("../../../../packages/game-engine/src/utils/team-value-calculator", () => ({
  getPlayerCost: vi.fn(() => 50000),
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
  handleListAvailableStarPlayers,
  handleListAvailableTeams,
  handleListMyTeams,
  handleListTeamStarPlayers,
  handleRecalculateTeam,
} from "./team";
import {
  getTeamAvailableStarPlayers,
  requiresPair,
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

describe("Route: GET /team/:id/available-star-players (S25.5t)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requiresPair as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (getTeamAvailableStarPlayers as ReturnType<typeof vi.fn>).mockReturnValue([]);
  });

  async function getMocks() {
    return {
      findFirst: vi.mocked(await import("../prisma")).prisma.team
        .findFirst as ReturnType<typeof vi.fn>,
      mockGetAvailable: getTeamAvailableStarPlayers as ReturnType<typeof vi.fn>,
      mockRequiresPair: requiresPair as ReturnType<typeof vi.fn>,
    };
  }

  it("returns 404 ApiError when team not found or owned by other user", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockResolvedValue(null);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailableStarPlayers(req, res);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "team-1", ownerId: "user-1" },
      }),
    );
    expect(res.statusCode).toBe(404);
    expect(res.payload).toMatchObject({ success: false });
  });

  it("returns ApiSuccess with empty list and budget metadata when no star players are available", async () => {
    const { findFirst, mockGetAvailable } = await getMocks();
    findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      ruleset: "season_3",
      roster: "skaven",
      initialBudget: 1000,
      players: [],
      starPlayers: [],
    });
    mockGetAvailable.mockReturnValue([]);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailableStarPlayers(req, res);

    expect(mockGetAvailable).toHaveBeenCalledWith("skaven", "season_3");
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

  it("returns ApiSuccess enriched with isHired/canHire and budget deduction", async () => {
    const { findFirst, mockGetAvailable } = await getMocks();
    findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      ruleset: "season_3",
      roster: "skaven",
      initialBudget: 1000,
      players: [
        { id: "p-1", position: "lineman" },
        { id: "p-2", position: "lineman" },
      ],
      starPlayers: [],
    });
    mockGetAvailable.mockReturnValue([
      {
        slug: "morg-n-thorg",
        displayName: "Morg N Thorg",
        cost: 430000,
      },
      {
        slug: "deeproot-strongbranch",
        displayName: "Deeproot",
        cost: 950000,
      },
    ]);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailableStarPlayers(req, res);

    const payload = res.payload as {
      success: boolean;
      data: {
        availableStarPlayers: Array<{
          slug: string;
          isHired: boolean;
          canHire: boolean;
          needsPair: boolean;
        }>;
        availableBudget: number;
        currentPlayerCount: number;
        totalPlayers: number;
      };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.currentPlayerCount).toBe(2);
    expect(payload.data.totalPlayers).toBe(2);
    expect(payload.data.availableBudget).toBe(900);
    expect(payload.data.availableStarPlayers).toHaveLength(2);
    const morg = payload.data.availableStarPlayers.find((sp) => sp.slug === "morg-n-thorg");
    expect(morg).toMatchObject({ isHired: false, canHire: true, needsPair: false });
    const deeproot = payload.data.availableStarPlayers.find(
      (sp) => sp.slug === "deeproot-strongbranch",
    );
    expect(deeproot).toMatchObject({ isHired: false, canHire: false, needsPair: false });
  });

  it("flags already hired star players as isHired=true and canHire=false", async () => {
    const { findFirst, mockGetAvailable } = await getMocks();
    findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      ruleset: "season_3",
      roster: "skaven",
      initialBudget: 1000,
      players: [],
      starPlayers: [
        { starPlayerSlug: "morg-n-thorg", cost: 430000 },
      ],
    });
    mockGetAvailable.mockReturnValue([
      { slug: "morg-n-thorg", displayName: "Morg N Thorg", cost: 430000 },
    ]);

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailableStarPlayers(req, res);

    const payload = res.payload as {
      success: boolean;
      data: {
        availableStarPlayers: Array<{ slug: string; isHired: boolean; canHire: boolean }>;
        currentStarPlayerCount: number;
        totalPlayers: number;
        availableBudget: number;
      };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.currentStarPlayerCount).toBe(1);
    expect(payload.data.totalPlayers).toBe(1);
    expect(payload.data.availableBudget).toBe(570);
    expect(payload.data.availableStarPlayers[0]).toMatchObject({
      slug: "morg-n-thorg",
      isHired: true,
      canHire: false,
    });
  });

  it("returns 500 ApiError when prisma throws", async () => {
    const { findFirst } = await getMocks();
    findFirst.mockRejectedValue(new Error("db down"));

    const req = createReq({ params: { id: "team-1" } });
    const res = createRes();
    await handleListAvailableStarPlayers(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toMatchObject({ success: false });
  });
});
