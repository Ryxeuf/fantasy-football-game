import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeam: { findUnique: vi.fn() },
    proLeagueSeason: { findFirst: vi.fn() },
    proLeagueStandings: { findUnique: vi.fn() },
    proLeagueMatch: { findMany: vi.fn() },
    proTeamRoster: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  ProTeamNotFoundError,
  getProTeamDetail,
} from "./pro-league-team";

interface MockedPrisma {
  proTeam: { findUnique: ReturnType<typeof vi.fn> };
  proLeagueSeason: { findFirst: ReturnType<typeof vi.fn> };
  proLeagueStandings: { findUnique: ReturnType<typeof vi.fn> };
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn> };
  proTeamRoster: { findMany: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;

const TEAM_ID = "team_buf_1";

function fakeTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: TEAM_ID,
    slug: "buf-snow-ogres",
    city: "Buffalo",
    name: "Snow Ogres",
    race: "Ogre",
    nflFlavor: "Buffalo snow brutality",
    primaryColor: "#00338D",
    secondaryColor: "#C60C30",
    baseTv: 1100,
    meta: { motto: "Snow over Steel" },
    leagueId: "league_1",
    league: { slug: "old-world-league", branding: null },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proLeagueSeason.findFirst.mockResolvedValue(null);
  mocked.proLeagueStandings.findUnique.mockResolvedValue(null);
  mocked.proLeagueMatch.findMany.mockResolvedValue([]);
  mocked.proTeamRoster.findMany.mockResolvedValue([]);
});

describe("getProTeamDetail — sprint 1.C.2", () => {
  it("404 si l'équipe n'existe pas", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(null);
    await expect(getProTeamDetail("unknown")).rejects.toThrow(
      ProTeamNotFoundError,
    );
  });

  it("404 si l'équipe appartient à une autre ligue", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(
      fakeTeam({ league: { slug: "other-league", branding: null } }),
    );
    await expect(getProTeamDetail("buf-snow-ogres")).rejects.toThrow(
      ProTeamNotFoundError,
    );
  });

  it("renvoie les meta + motto extrait de meta.motto", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    const out = await getProTeamDetail("buf-snow-ogres");
    expect(out.slug).toBe("buf-snow-ogres");
    expect(out.city).toBe("Buffalo");
    expect(out.race).toBe("Ogre");
    expect(out.motto).toBe("Snow over Steel");
    expect(out.baseTv).toBe(1100);
    expect(out.seasonId).toBeNull();
    expect(out.record).toBeNull();
  });

  it("priorise une saison in_progress sur completed", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proLeagueSeason.findFirst.mockResolvedValueOnce({
      id: "s_active",
      year: 2026,
    });
    const out = await getProTeamDetail("buf-snow-ogres");
    expect(out.seasonId).toBe("s_active");
    expect(out.seasonYear).toBe(2026);
    // 1 seul appel (pas de fallback completed)
    expect(mocked.proLeagueSeason.findFirst).toHaveBeenCalledTimes(1);
  });

  it("inclut le record + form depuis standings", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proLeagueSeason.findFirst.mockResolvedValueOnce({
      id: "s1",
      year: 2026,
    });
    mocked.proLeagueStandings.findUnique.mockResolvedValue({
      played: 4,
      wins: 3,
      draws: 0,
      losses: 1,
      points: 9,
      tdFor: 12,
      tdAgainst: 5,
      form: ["W", "W", "L", "W"],
    });

    const out = await getProTeamDetail("buf-snow-ogres");
    expect(out.record).toEqual({
      played: 4,
      wins: 3,
      draws: 0,
      losses: 1,
      points: 9,
      tdFor: 12,
      tdAgainst: 5,
      form: ["W", "W", "L", "W"],
    });
  });

  it("formate les matchs avec opponent + isHome", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proLeagueSeason.findFirst.mockResolvedValueOnce({
      id: "s1",
      year: 2026,
    });
    const at = new Date("2026-09-15T21:00:00Z");
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        status: "scheduled",
        scheduledAt: at,
        scoreHome: null,
        scoreAway: null,
        outcome: null,
        homeTeamId: TEAM_ID,
        awayTeamId: "other-team",
        round: { roundNumber: 4 },
        homeTeam: {
          slug: "buf-snow-ogres",
          name: "Snow Ogres",
          city: "Buffalo",
          primaryColor: "#00338D",
        },
        awayTeam: {
          slug: "gb-cheese-halflings",
          name: "Cheese Halflings",
          city: "Green Bay",
          primaryColor: "#203731",
        },
      },
    ]);
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([]);

    const out = await getProTeamDetail("buf-snow-ogres");
    expect(out.upcomingMatches).toHaveLength(1);
    const m = out.upcomingMatches[0];
    expect(m.id).toBe("m1");
    expect(m.isHome).toBe(true);
    expect(m.opponent.slug).toBe("gb-cheese-halflings");
    expect(m.scheduledAt).toBe(at.toISOString());
  });

  it("parse skills array natif et JSON string", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proTeamRoster.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Grim",
        position: "Lineman",
        ma: 5,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: ["block", "thick_skull"], // postgres native
        status: "active",
        form: 60,
        niggling: 0,
      },
      {
        id: "p2",
        name: "Mox",
        position: "Blitzer",
        ma: 6,
        st: 4,
        ag: 3,
        pa: null,
        av: 10,
        skills: '["dodge"]', // sqlite JSON string mirror
        status: "injured",
        form: 40,
        niggling: 1,
      },
    ]);

    const out = await getProTeamDetail("buf-snow-ogres");
    expect(out.roster).toHaveLength(2);
    expect(out.roster[0].skills).toEqual(["block", "thick_skull"]);
    expect(out.roster[1].skills).toEqual(["dodge"]);
    expect(out.roster[1].pa).toBeNull();
    expect(out.roster[1].niggling).toBe(1);
  });
});
