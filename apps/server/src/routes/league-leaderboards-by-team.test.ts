/**
 * A66 — GET /leagues/seasons/:seasonId/leaderboards/by-team
 *
 * Non-régression : chaque `team.catalogue` DOIT embarquer `categories`
 * (comme la vue globale). Son absence faisait crasher la page
 * « Statistiques par équipe » côté client
 * (`t.catalogue.categories.map` sur undefined).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

vi.mock("../services/league-player-stats", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-player-stats")>();
  return {
    ...actual,
    computeLeaderboardsByTeam: vi.fn(),
  };
});

import { handleGetLeaderboardsByTeam } from "./league";
import {
  computeLeaderboardsByTeam,
  LEADERBOARD_CATEGORIES,
} from "../services/league-player-stats";

const mockedCompute = vi.mocked(computeLeaderboardsByTeam);

function mockRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("A66 — handleGetLeaderboardsByTeam", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("attache `categories` au catalogue de chaque équipe", async () => {
    mockedCompute.mockResolvedValue([
      {
        teamId: "t1",
        teamName: "Les Rats",
        // Catalogue brut du service : sans `categories` (source du bug).
        catalogue: { topScorers: [], scope: "career" } as never,
      },
    ]);
    const req = { params: { seasonId: "s1" }, query: {} };
    const res = mockRes();

    await handleGetLeaderboardsByTeam(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.teams).toHaveLength(1);
    expect(payload.data.teams[0].catalogue.categories).toEqual(
      LEADERBOARD_CATEGORIES,
    );
  });
});
