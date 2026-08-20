/**
 * GET /leagues/seasons/:seasonId/leaderboards/teams
 *
 * Tops PAR EQUIPE (totaux de saison). Le handler doit attacher
 * `categories` (l'UI itere dessus) et propager le topN de la query.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

vi.mock("../services/league-team-stats", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-team-stats")>();
  return {
    ...actual,
    computeTeamLeaderboards: vi.fn(),
  };
});

import { handleGetTeamLeaderboards } from "./league";
import {
  computeTeamLeaderboards,
  TEAM_LEADERBOARD_CATEGORIES,
} from "../services/league-team-stats";

const mockedCompute = vi.mocked(computeTeamLeaderboards);

function mockRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("handleGetTeamLeaderboards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("attache `categories` au catalogue et relaie le topN", async () => {
    mockedCompute.mockResolvedValue({
      seasonId: "s1",
      topN: 3,
      topScorers: [],
      bestDefenses: [],
      topBashers: [],
      topMartyrs: [],
      topPassers: [],
      topInterceptors: [],
      topAggressors: [],
      topCrowdSurges: [],
    });
    const req = { params: { seasonId: "s1" }, query: { topN: "3" } };
    const res = mockRes();

    await handleGetTeamLeaderboards(req as never, res as never);

    expect(mockedCompute).toHaveBeenCalledWith({ seasonId: "s1", topN: 3 });
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.categories).toEqual(TEAM_LEADERBOARD_CATEGORIES);
    expect(payload.data.topN).toBe(3);
  });

  it("ignore un topN non numérique (le service applique son défaut)", async () => {
    mockedCompute.mockResolvedValue({
      seasonId: "s1",
      topN: 5,
      topScorers: [],
      bestDefenses: [],
      topBashers: [],
      topMartyrs: [],
      topPassers: [],
      topInterceptors: [],
      topAggressors: [],
      topCrowdSurges: [],
    });
    const req = { params: { seasonId: "s1" }, query: { topN: "abc" } };
    const res = mockRes();

    await handleGetTeamLeaderboards(req as never, res as never);

    expect(mockedCompute).toHaveBeenCalledWith({
      seasonId: "s1",
      topN: undefined,
    });
  });
});
