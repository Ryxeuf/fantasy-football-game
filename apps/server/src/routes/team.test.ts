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
import { handleGenerateTeamName, handleGetRoster } from "./team";
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
