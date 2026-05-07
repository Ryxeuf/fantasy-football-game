import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findMany: vi.fn() },
    proLeagueSeason: { findFirst: vi.fn() },
    proLeagueStandings: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import { getDailyRecap } from "./pro-gazette-recap";

interface MockedPrisma {
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn> };
  proLeagueSeason: { findFirst: ReturnType<typeof vi.fn> };
  proLeagueStandings: { findMany: ReturnType<typeof vi.fn> };
}
const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proLeagueSeason.findFirst.mockResolvedValue(null);
  mocked.proLeagueStandings.findMany.mockResolvedValue([]);
});

describe("getDailyRecap — sprint 1.E.3", () => {
  it("retourne un recap vide si pas de matchs", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    const out = await getDailyRecap(new Date("2026-09-15T00:00:00Z"));
    expect(out.matchesPlayed).toBe(0);
    expect(out.matches).toEqual([]);
    expect(out.storylines).toEqual([]);
    expect(out.fromAt).toBe("2026-09-15T00:00:00.000Z");
    expect(out.toAt).toBe("2026-09-16T00:00:00.000Z");
  });

  it("filtre les matchs failed (scoreHome null)", async () => {
    // 1er findMany = matchs principaux
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        homeTeamId: "h1",
        awayTeamId: "a1",
        scoreHome: 2,
        scoreAway: 1,
        outcome: "home",
        touchdownCount: 3,
        casualtyCount: 1,
        nuffleCount: 0,
        completedAt: new Date("2026-09-15T22:00:00Z"),
        homeTeam: { slug: "buf", name: "Buffalo" },
        awayTeam: { slug: "kc", name: "KC" },
      },
      {
        id: "m_failed",
        homeTeamId: "h2",
        awayTeamId: "a2",
        scoreHome: null,
        scoreAway: null,
        outcome: null,
        touchdownCount: null,
        casualtyCount: null,
        nuffleCount: null,
        completedAt: new Date("2026-09-15T22:00:00Z"),
        homeTeam: { slug: "x", name: "X" },
        awayTeam: { slug: "y", name: "Y" },
      },
    ]);
    // priorMatchups query — empty
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);

    const out = await getDailyRecap(new Date("2026-09-15T00:00:00Z"));
    expect(out.matchesPlayed).toBe(1);
    expect(out.matches[0].id).toBe("m1");
  });

  it("agrège standings + storylines", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        homeTeamId: "h1",
        awayTeamId: "a1",
        scoreHome: 5,
        scoreAway: 1,
        outcome: "home",
        touchdownCount: 6,
        casualtyCount: 4,
        nuffleCount: 0,
        completedAt: new Date("2026-09-15T22:00:00Z"),
        homeTeam: { slug: "buf", name: "Buffalo" },
        awayTeam: { slug: "kc", name: "KC" },
      },
    ]);
    mocked.proLeagueSeason.findFirst.mockResolvedValueOnce({
      id: "season_1",
    });
    mocked.proLeagueStandings.findMany.mockResolvedValue([
      {
        teamId: "h1",
        played: 5,
        wins: 4,
        draws: 0,
        losses: 1,
        points: 12,
        tdFor: 12,
        team: { slug: "buf", name: "Buffalo" },
      },
      {
        teamId: "a1",
        played: 5,
        wins: 1,
        draws: 0,
        losses: 4,
        points: 3,
        tdFor: 5,
        team: { slug: "kc", name: "KC" },
      },
    ]);
    // priorMatchups query — empty (pas de rivalry)
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);

    const out = await getDailyRecap(new Date("2026-09-15T00:00:00Z"));
    expect(out.matchesPlayed).toBe(1);
    expect(out.standings).toHaveLength(2);
    expect(out.standings[0].rank).toBe(1);
    expect(out.standings[0].teamName).toBe("Buffalo");

    // Storylines : season_top (Buffalo rank=1) + blowout (5-1) + record_td (6) + bloodbath (4)
    const types = out.storylines.map((s) => s.type);
    expect(types).toContain("season_top");
    expect(types).toContain("blowout");
    expect(types).toContain("record_td");
    expect(types).toContain("bloodbath");
  });

  it("détecte rivalry_buildup quand priorMatchups ≥ 3", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m_today",
        homeTeamId: "h1",
        awayTeamId: "a1",
        scoreHome: 2,
        scoreAway: 1,
        outcome: "home",
        touchdownCount: 3,
        casualtyCount: 1,
        nuffleCount: 0,
        completedAt: new Date("2026-09-15T22:00:00Z"),
        homeTeam: { slug: "buf", name: "Buffalo" },
        awayTeam: { slug: "kc", name: "KC" },
      },
    ]);
    mocked.proLeagueSeason.findFirst.mockResolvedValueOnce(null);
    // Rivalry query : 3 matchs passés entre Buffalo & KC
    mocked.proLeagueMatch.findMany.mockResolvedValue([
      { completedAt: new Date("2026-08-25T22:00:00Z") },
      { completedAt: new Date("2026-09-05T22:00:00Z") },
      { completedAt: new Date("2026-09-15T22:00:00Z") },
    ]);
    const out = await getDailyRecap(new Date("2026-09-15T00:00:00Z"));
    expect(out.storylines.some((s) => s.type === "rivalry_buildup")).toBe(true);
  });
});
