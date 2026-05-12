/**
 * Tests unitaires du service pro-league-rivalry.
 *
 * Couvre :
 *  - Helpers purs (computeRecord, computeRivalryStreak)
 *  - getHeadToHead avec mock prisma (avec/sans matchs, 404 team)
 *  - getTopRivals avec mock prisma (tri par totalMatches desc)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeam: { findUnique: vi.fn(), findMany: vi.fn() },
    proLeagueMatch: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  TeamNotFoundError,
  computeRecord,
  computeRivalryStreak,
  getHeadToHead,
  getTopRivals,
  HEAD_TO_HEAD_RECENT_CAP,
} from "./pro-league-rivalry";

const mockedPrisma = prisma as unknown as {
  proTeam: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.resetAllMocks();
});

const teamABrief = {
  id: "tA",
  slug: "team-a",
  city: "City A",
  name: "Athletics",
  race: "Orc",
  primaryColor: "#000",
  secondaryColor: "#fff",
};
const teamBBrief = {
  id: "tB",
  slug: "team-b",
  city: "City B",
  name: "Beasts",
  race: "Wood Elf",
  primaryColor: "#0f0",
  secondaryColor: "#00f",
};

function fakeMatch(
  partial: Partial<{
    matchId: string;
    homeTeamId: string;
    awayTeamId: string;
    scoreHome: number | null;
    scoreAway: number | null;
    outcome: "home" | "away" | "draw" | null;
    seasonYear: number | null;
    scheduledAt: string | null;
  }>,
) {
  return {
    matchId: partial.matchId ?? "m1",
    homeTeamId: partial.homeTeamId ?? "tA",
    awayTeamId: partial.awayTeamId ?? "tB",
    scoreHome: partial.scoreHome ?? 0,
    scoreAway: partial.scoreAway ?? 0,
    outcome: partial.outcome ?? null,
    seasonYear: partial.seasonYear ?? null,
    scheduledAt: partial.scheduledAt ?? null,
  };
}

describe("computeRecord", () => {
  it("retourne 0 pour aucun match", () => {
    expect(computeRecord("tA", [])).toEqual({
      totalMatches: 0,
      winsA: 0,
      winsB: 0,
      draws: 0,
      totalTdA: 0,
      totalTdB: 0,
    });
  });

  it("compte teamA home win + total TD", () => {
    const matches = [
      fakeMatch({
        homeTeamId: "tA",
        awayTeamId: "tB",
        scoreHome: 3,
        scoreAway: 1,
        outcome: "home",
      }),
    ];
    const record = computeRecord("tA", matches);
    expect(record).toEqual({
      totalMatches: 1,
      winsA: 1,
      winsB: 0,
      draws: 0,
      totalTdA: 3,
      totalTdB: 1,
    });
  });

  it("compte teamA away win", () => {
    const matches = [
      fakeMatch({
        homeTeamId: "tB",
        awayTeamId: "tA",
        scoreHome: 0,
        scoreAway: 2,
        outcome: "away",
      }),
    ];
    expect(computeRecord("tA", matches)).toMatchObject({
      winsA: 1,
      winsB: 0,
      totalTdA: 2,
      totalTdB: 0,
    });
  });

  it("compte loss home pour teamA", () => {
    const matches = [
      fakeMatch({
        homeTeamId: "tA",
        awayTeamId: "tB",
        scoreHome: 1,
        scoreAway: 3,
        outcome: "away",
      }),
    ];
    expect(computeRecord("tA", matches)).toMatchObject({
      winsA: 0,
      winsB: 1,
      totalTdA: 1,
      totalTdB: 3,
    });
  });

  it("compte draws", () => {
    const matches = [
      fakeMatch({
        homeTeamId: "tA",
        awayTeamId: "tB",
        scoreHome: 1,
        scoreAway: 1,
        outcome: "draw",
      }),
    ];
    expect(computeRecord("tA", matches)).toMatchObject({
      winsA: 0,
      winsB: 0,
      draws: 1,
    });
  });

  it("ignore les matches sans outcome", () => {
    const matches = [
      fakeMatch({ outcome: null, scoreHome: 5, scoreAway: 5 }),
      fakeMatch({
        homeTeamId: "tA",
        scoreHome: 1,
        scoreAway: 0,
        outcome: "home",
      }),
    ];
    const r = computeRecord("tA", matches);
    expect(r.totalMatches).toBe(1);
    expect(r.totalTdA).toBe(1);
  });

  it("agrege plusieurs matches", () => {
    const matches = [
      fakeMatch({
        homeTeamId: "tA",
        scoreHome: 2,
        scoreAway: 1,
        outcome: "home",
      }),
      fakeMatch({
        homeTeamId: "tB",
        awayTeamId: "tA",
        scoreHome: 3,
        scoreAway: 1,
        outcome: "home",
      }),
      fakeMatch({
        homeTeamId: "tA",
        scoreHome: 2,
        scoreAway: 2,
        outcome: "draw",
      }),
    ];
    const r = computeRecord("tA", matches);
    expect(r).toEqual({
      totalMatches: 3,
      winsA: 1,
      winsB: 1,
      draws: 1,
      totalTdA: 2 + 1 + 2,
      totalTdB: 1 + 3 + 2,
    });
  });
});

describe("computeRivalryStreak", () => {
  it("none/0 si vide", () => {
    expect(computeRivalryStreak("tA", [])).toEqual({
      kind: "none",
      length: 0,
    });
  });

  it("none si tous matches null outcome", () => {
    expect(
      computeRivalryStreak("tA", [
        fakeMatch({ outcome: null }),
        fakeMatch({ outcome: null }),
      ]),
    ).toEqual({ kind: "none", length: 0 });
  });

  it("compte le streak de wins consecutifs depuis le plus recent", () => {
    const matches = [
      fakeMatch({
        homeTeamId: "tA",
        scoreHome: 3,
        scoreAway: 1,
        outcome: "home",
      }),
      fakeMatch({
        homeTeamId: "tB",
        awayTeamId: "tA",
        scoreHome: 0,
        scoreAway: 2,
        outcome: "away",
      }),
      fakeMatch({
        homeTeamId: "tA",
        scoreHome: 1,
        scoreAway: 2,
        outcome: "away",
      }),
    ];
    expect(computeRivalryStreak("tA", matches)).toEqual({
      kind: "win",
      length: 2,
    });
  });

  it("stop au premier changement", () => {
    const matches = [
      fakeMatch({
        homeTeamId: "tA",
        scoreHome: 1,
        scoreAway: 2,
        outcome: "away",
      }),
      fakeMatch({
        homeTeamId: "tA",
        scoreHome: 3,
        scoreAway: 1,
        outcome: "home",
      }),
    ];
    expect(computeRivalryStreak("tA", matches)).toEqual({
      kind: "loss",
      length: 1,
    });
  });
});

describe("getHeadToHead", () => {
  it("404 si teamA introuvable", async () => {
    mockedPrisma.proTeam.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(teamBBrief);
    await expect(getHeadToHead("ghost", "team-b")).rejects.toBeInstanceOf(
      TeamNotFoundError,
    );
  });

  it("404 si teamB introuvable", async () => {
    mockedPrisma.proTeam.findUnique
      .mockResolvedValueOnce(teamABrief)
      .mockResolvedValueOnce(null);
    await expect(getHeadToHead("team-a", "ghost")).rejects.toBeInstanceOf(
      TeamNotFoundError,
    );
  });

  it("retourne summary vide quand 0 match", async () => {
    mockedPrisma.proTeam.findUnique
      .mockResolvedValueOnce(teamABrief)
      .mockResolvedValueOnce(teamBBrief);
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([]);

    const summary = await getHeadToHead("team-a", "team-b");

    expect(summary.record.totalMatches).toBe(0);
    expect(summary.lastMatch).toBeNull();
    expect(summary.recentMatches).toEqual([]);
    expect(summary.streakA.kind).toBe("none");
  });

  it("agrege correctement 3 matches", async () => {
    mockedPrisma.proTeam.findUnique
      .mockResolvedValueOnce(teamABrief)
      .mockResolvedValueOnce(teamBBrief);
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m-recent",
        seasonId: "s1",
        scheduledAt: new Date("2026-05-10"),
        homeTeamId: "tA",
        awayTeamId: "tB",
        scoreHome: 3,
        scoreAway: 1,
        outcome: "home",
        season: { year: 2026 },
      },
      {
        id: "m-older",
        seasonId: "s1",
        scheduledAt: new Date("2026-04-01"),
        homeTeamId: "tB",
        awayTeamId: "tA",
        scoreHome: 2,
        scoreAway: 0,
        outcome: "home",
        season: { year: 2026 },
      },
      {
        id: "m-oldest",
        seasonId: "s0",
        scheduledAt: new Date("2025-12-01"),
        homeTeamId: "tA",
        awayTeamId: "tB",
        scoreHome: 1,
        scoreAway: 1,
        outcome: "draw",
        season: { year: 2025 },
      },
    ]);

    const summary = await getHeadToHead("team-a", "team-b");

    expect(summary.teamA.slug).toBe("team-a");
    expect(summary.teamB.slug).toBe("team-b");
    expect(summary.record).toEqual({
      totalMatches: 3,
      winsA: 1,
      winsB: 1,
      draws: 1,
      totalTdA: 3 + 0 + 1,
      totalTdB: 1 + 2 + 1,
    });
    expect(summary.lastMatch?.matchId).toBe("m-recent");
    expect(summary.streakA.kind).toBe("win"); // m-recent etait une victoire
    expect(summary.streakA.length).toBe(1); // m-older = loss
  });

  it("cap recentMatches a HEAD_TO_HEAD_RECENT_CAP", async () => {
    mockedPrisma.proTeam.findUnique
      .mockResolvedValueOnce(teamABrief)
      .mockResolvedValueOnce(teamBBrief);
    const manyMatches = Array.from({ length: 30 }, (_, i) => ({
      id: `m${i}`,
      seasonId: "s1",
      scheduledAt: new Date(`2026-01-${String(i + 1).padStart(2, "0")}`),
      homeTeamId: "tA",
      awayTeamId: "tB",
      scoreHome: 1,
      scoreAway: 0,
      outcome: "home",
      season: { year: 2026 },
    }));
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce(manyMatches);

    const summary = await getHeadToHead("team-a", "team-b");

    expect(summary.record.totalMatches).toBe(30);
    expect(summary.recentMatches).toHaveLength(HEAD_TO_HEAD_RECENT_CAP);
  });
});

describe("getTopRivals", () => {
  it("retourne [] si limit < 1", async () => {
    expect(await getTopRivals("team-a", 0)).toEqual([]);
  });

  it("404 si team introuvable", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(null);
    await expect(getTopRivals("ghost", 3)).rejects.toBeInstanceOf(
      TeamNotFoundError,
    );
  });

  it("retourne [] si pas de matchs", async () => {
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamABrief);
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([]);
    expect(await getTopRivals("team-a", 3)).toEqual([]);
  });

  it("regroupe par opponent et trie par totalMatches desc", async () => {
    const tC = {
      id: "tC",
      slug: "team-c",
      city: "City C",
      name: "Crushers",
      race: "Dwarf",
      primaryColor: null,
      secondaryColor: null,
    };
    const tD = {
      id: "tD",
      slug: "team-d",
      city: "City D",
      name: "Devils",
      race: "Chaos",
      primaryColor: null,
      secondaryColor: null,
    };
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamABrief);
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      // vs tB : 3 matches (la rival #1)
      {
        id: "m1",
        seasonId: "s1",
        scheduledAt: new Date("2026-05-10"),
        homeTeamId: "tA",
        awayTeamId: "tB",
        scoreHome: 2,
        scoreAway: 1,
        outcome: "home",
        season: { year: 2026 },
      },
      {
        id: "m2",
        seasonId: "s1",
        scheduledAt: new Date("2026-04-10"),
        homeTeamId: "tB",
        awayTeamId: "tA",
        scoreHome: 1,
        scoreAway: 0,
        outcome: "home",
        season: { year: 2026 },
      },
      {
        id: "m3",
        seasonId: "s0",
        scheduledAt: new Date("2025-12-10"),
        homeTeamId: "tA",
        awayTeamId: "tB",
        scoreHome: 1,
        scoreAway: 1,
        outcome: "draw",
        season: { year: 2025 },
      },
      // vs tC : 2 matches
      {
        id: "m4",
        seasonId: "s1",
        scheduledAt: new Date("2026-03-10"),
        homeTeamId: "tA",
        awayTeamId: "tC",
        scoreHome: 3,
        scoreAway: 2,
        outcome: "home",
        season: { year: 2026 },
      },
      {
        id: "m5",
        seasonId: "s0",
        scheduledAt: new Date("2025-11-10"),
        homeTeamId: "tA",
        awayTeamId: "tC",
        scoreHome: 0,
        scoreAway: 1,
        outcome: "away",
        season: { year: 2025 },
      },
      // vs tD : 1 match
      {
        id: "m6",
        seasonId: "s0",
        scheduledAt: new Date("2025-10-10"),
        homeTeamId: "tA",
        awayTeamId: "tD",
        scoreHome: 1,
        scoreAway: 0,
        outcome: "home",
        season: { year: 2025 },
      },
    ]);
    mockedPrisma.proTeam.findMany.mockResolvedValueOnce([
      teamBBrief,
      tC,
      tD,
    ]);

    const rivals = await getTopRivals("team-a", 2);

    expect(rivals).toHaveLength(2);
    expect(rivals[0].team.slug).toBe("team-b");
    expect(rivals[0].totalMatches).toBe(3);
    expect(rivals[0].winsFor).toBe(1);
    expect(rivals[0].winsAgainst).toBe(1);
    expect(rivals[0].draws).toBe(1);
    expect(rivals[1].team.slug).toBe("team-c");
    expect(rivals[1].totalMatches).toBe(2);
  });

  it("tie-break par slug asc quand egalite totalMatches", async () => {
    const tC = {
      id: "tC",
      slug: "alpha-team",
      city: "X",
      name: "Y",
      race: "Z",
      primaryColor: null,
      secondaryColor: null,
    };
    mockedPrisma.proTeam.findUnique.mockResolvedValueOnce(teamABrief);
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        seasonId: "s1",
        scheduledAt: new Date("2026-05-10"),
        homeTeamId: "tA",
        awayTeamId: "tB",
        scoreHome: 1,
        scoreAway: 0,
        outcome: "home",
        season: { year: 2026 },
      },
      {
        id: "m2",
        seasonId: "s1",
        scheduledAt: new Date("2026-04-10"),
        homeTeamId: "tA",
        awayTeamId: "tC",
        scoreHome: 1,
        scoreAway: 0,
        outcome: "home",
        season: { year: 2026 },
      },
    ]);
    mockedPrisma.proTeam.findMany.mockResolvedValueOnce([teamBBrief, tC]);

    const rivals = await getTopRivals("team-a", 3);

    // egalite 1 match chacun → tri par slug asc → "alpha-team" devant "team-b"
    expect(rivals[0].team.slug).toBe("alpha-team");
    expect(rivals[1].team.slug).toBe("team-b");
  });
});
