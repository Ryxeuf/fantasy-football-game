import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn() },
    user: { create: vi.fn() },
    team: { create: vi.fn() },
    teamPlayer: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("../services/league-scheduler", () => ({
  requireLeagueCreator: vi.fn(),
}));
vi.mock("../services/league", () => ({
  addParticipant: vi.fn(),
  parseAllowedRosters: vi.fn((raw: string | null) =>
    raw ? (JSON.parse(raw) as string[]) : null,
  ),
}));
vi.mock("../utils/team-values", () => ({ updateTeamValues: vi.fn() }));

import type { Response } from "express";
import { prisma } from "../prisma";
import { requireLeagueCreator } from "../services/league-scheduler";
import { addParticipant } from "../services/league";
import { handleAddTestParticipant } from "./league-test-data";
import type { AuthenticatedRequest } from "../middleware/authUser";

const mockPrisma = prisma as unknown as {
  leagueSeason: { findUnique: ReturnType<typeof vi.fn> };
  user: { create: ReturnType<typeof vi.fn> };
  team: { create: ReturnType<typeof vi.fn> };
  teamPlayer: { createMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockRequireCreator = requireLeagueCreator as ReturnType<typeof vi.fn>;
const mockAddParticipant = addParticipant as ReturnType<typeof vi.fn>;

function createRes() {
  const res: Partial<Response> & { statusCode?: number; payload?: unknown } =
    {};
  res.status = vi.fn().mockImplementation((c: number) => {
    res.statusCode = c;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((p: unknown) => {
    res.payload = p;
    return res as Response;
  });
  return res as Response & { statusCode?: number; payload?: unknown };
}

function createReq(
  overrides: Partial<AuthenticatedRequest> = {},
): AuthenticatedRequest {
  return {
    body: {},
    params: { seasonId: "season-1" },
    query: {},
    user: { id: "commish", roles: ["user"] },
    ...overrides,
  } as AuthenticatedRequest;
}

const ORIGINAL_ENV = process.env.NODE_ENV;

describe("Route: POST /leagues/seasons/:seasonId/test-participant (dev only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "development";
  });
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
  });

  it("returns 404 in production", async () => {
    process.env.NODE_ENV = "production";
    const res = createRes();
    await handleAddTestParticipant(createReq(), res);
    expect(res.statusCode).toBe(404);
    expect(mockRequireCreator).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not the commissioner", async () => {
    mockRequireCreator.mockRejectedValue(new Error("forbidden"));
    const res = createRes();
    await handleAddTestParticipant(createReq(), res);
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("creates a test coach + team and joins the season", async () => {
    mockRequireCreator.mockResolvedValue({});
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "season-1",
      league: {
        ruleset: "season_3",
        allowedRosters: JSON.stringify(["skaven", "dwarf"]),
      },
    });
    mockPrisma.user.create.mockResolvedValue({
      id: "coach-x",
      coachName: "Coach Test abcde",
    });
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: unknown) => unknown) =>
        cb({
          team: {
            create: vi
              .fn()
              .mockResolvedValue({ id: "team-x", name: "Test skaven abcde" }),
          },
          teamPlayer: { createMany: vi.fn().mockResolvedValue({ count: 11 }) },
        }),
    );
    mockAddParticipant.mockResolvedValue({ id: "part-x" });

    const res = createRes();
    await handleAddTestParticipant(createReq(), res);

    // roster choisi = premier allowedRoster
    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(mockAddParticipant).toHaveBeenCalledWith({
      seasonId: "season-1",
      teamId: "team-x",
    });
    expect(res.statusCode).toBe(201);
    expect(res.payload).toMatchObject({
      success: true,
      data: expect.objectContaining({
        team: expect.objectContaining({ id: "team-x", roster: "skaven" }),
        coach: expect.objectContaining({ id: "coach-x" }),
      }),
    });
  });
});
