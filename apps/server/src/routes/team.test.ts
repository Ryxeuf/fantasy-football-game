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
} from "./team";
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
