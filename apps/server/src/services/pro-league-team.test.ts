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
  nextLevelSpp,
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

describe("getProTeamDetail roster — Lot E (progression / TV / career)", () => {
  it("expose progression {level, spp, nextLevelSpp, tv}", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proTeamRoster.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Veteran",
        position: "Blitzer",
        ma: 6,
        st: 4,
        ag: 3,
        pa: 4,
        av: 10,
        skills: ["block"],
        status: "active",
        form: 50,
        niggling: 0,
        spp: 25, // 16 < 25 < 31 → level 3 (rookie + 2 advancements)
        level: 3,
        tvCached: 90000,
        tdCount: 5,
        casCount: 2,
        compCount: 0,
        mvpCount: 1,
        maBonus: 0,
        stBonus: 0,
        agBonus: 0,
        paBonus: 0,
        avBonus: 0,
      },
    ]);
    const out = await getProTeamDetail("buf-snow-ogres");
    expect(out.roster).toHaveLength(1);
    const p = out.roster[0]!;
    expect(p.progression.level).toBe(3);
    expect(p.progression.spp).toBe(25);
    expect(p.progression.nextLevelSpp).toBe(31);
    expect(p.progression.tv).toBe(90000);
  });

  it("recompute le level depuis spp si la colonne level est en retard (legacy)", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proTeamRoster.findMany.mockResolvedValue([
      {
        id: "p_legacy",
        name: "Legacy",
        position: "Lineman",
        ma: 5,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: [],
        status: "active",
        form: 50,
        niggling: 0,
        spp: 50,
        level: 1, // legacy : pas update par level-up applier
        tvCached: 50000,
        tdCount: 0,
        casCount: 0,
        compCount: 0,
        mvpCount: 0,
        maBonus: 0,
        stBonus: 0,
        agBonus: 0,
        paBonus: 0,
        avBonus: 0,
      },
    ]);
    const out = await getProTeamDetail("buf-snow-ogres");
    // 50 SPP ⇒ level 4 (passé 16, 31, 51 ? non, 50 < 51 → level 4 = passé 6, 16, 31)
    expect(out.roster[0]!.progression.level).toBe(4);
    // Lot K — DB level=1, computed level=4 → applier en retard ⇒ ready=true
    expect(out.roster[0]!.progression.readyToLevelUp).toBe(true);
  });

  it("Lot K — readyToLevelUp=false quand le level DB est synchro avec spp", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proTeamRoster.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Synchro",
        position: "Lineman",
        ma: 5,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: [],
        status: "active",
        form: 50,
        niggling: 0,
        spp: 25,
        level: 3, // levelForSpp(25) = 3 → applier sync, pas de ready
        tvCached: 60000,
        tdCount: 0,
        casCount: 0,
        compCount: 0,
        mvpCount: 0,
        maBonus: 0,
        stBonus: 0,
        agBonus: 0,
        paBonus: 0,
        avBonus: 0,
      },
    ]);
    const out = await getProTeamDetail("buf-snow-ogres");
    expect(out.roster[0]!.progression.readyToLevelUp).toBe(false);
  });

  it("expose statBonuses (Lot 4.D.1) et career counters (Lot 3.C.x)", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proTeamRoster.findMany.mockResolvedValue([
      {
        id: "p_star",
        name: "Star",
        position: "Catcher",
        ma: 8,
        st: 2,
        ag: 4,
        pa: null,
        av: 8,
        skills: ["dodge", "catch"],
        status: "active",
        form: 70,
        niggling: 0,
        spp: 80,
        level: 5,
        tvCached: 130000,
        tdCount: 12,
        casCount: 1,
        compCount: 3,
        mvpCount: 2,
        maBonus: 1,
        stBonus: 0,
        agBonus: 0,
        paBonus: 0,
        avBonus: 0,
      },
    ]);
    const out = await getProTeamDetail("buf-snow-ogres");
    const p = out.roster[0]!;
    expect(p.statBonuses).toEqual({ ma: 1, st: 0, ag: 0, pa: 0, av: 0 });
    expect(p.career).toEqual({
      tdCount: 12,
      casCount: 1,
      compCount: 3,
      mvpCount: 2,
    });
  });

  it("fallback sur valeurs par defaut quand colonnes absentes (rosters anciens)", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proTeamRoster.findMany.mockResolvedValue([
      {
        id: "p_old",
        name: "Old",
        position: "Lineman",
        ma: 5,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: [],
        status: "active",
        form: 50,
        niggling: 0,
        // pas de spp / level / tvCached / counters / bonuses : null tous
        spp: null,
        level: null,
        tvCached: null,
        tdCount: null,
        casCount: null,
        compCount: null,
        mvpCount: null,
        maBonus: null,
        stBonus: null,
        agBonus: null,
        paBonus: null,
        avBonus: null,
      },
    ]);
    const out = await getProTeamDetail("buf-snow-ogres");
    const p = out.roster[0]!;
    expect(p.progression.spp).toBe(0);
    expect(p.progression.level).toBe(1);
    expect(p.progression.nextLevelSpp).toBe(6);
    expect(p.progression.tv).toBe(50000);
    expect(p.statBonuses).toEqual({ ma: 0, st: 0, ag: 0, pa: 0, av: 0 });
    expect(p.career).toEqual({
      tdCount: 0,
      casCount: 0,
      compCount: 0,
      mvpCount: 0,
    });
  });
});

describe("getProTeamDetail topEarners — Lot M", () => {
  it("retourne le top 5 actifs trié par TV desc", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    const mkRoster = (id: string, name: string, tv: number, status = "active") => ({
      id,
      name,
      position: "Lineman",
      ma: 5,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: [],
      status,
      form: 50,
      niggling: 0,
      spp: 0,
      level: 1,
      tvCached: tv,
      tdCount: 0,
      casCount: 0,
      compCount: 0,
      mvpCount: 0,
      maBonus: 0,
      stBonus: 0,
      agBonus: 0,
      paBonus: 0,
      avBonus: 0,
    });
    mocked.proTeamRoster.findMany.mockResolvedValue([
      mkRoster("p1", "Cheap", 50_000),
      mkRoster("p2", "Mid", 90_000),
      mkRoster("p3", "Star", 150_000),
      mkRoster("p4", "Mid2", 95_000),
      mkRoster("p5", "Mid3", 110_000),
      mkRoster("p6", "Lineman6", 50_000),
      mkRoster("p7", "Bench", 60_000),
    ]);

    const out = await getProTeamDetail("buf-snow-ogres");
    expect(out.topEarners).toHaveLength(5);
    expect(out.topEarners.map((p) => p.id)).toEqual([
      "p3",
      "p5",
      "p4",
      "p2",
      "p7",
    ]);
    expect(out.topEarners[0]!.tv).toBe(150_000);
    expect(out.totalRosterTv).toBe(50_000 + 90_000 + 150_000 + 95_000 + 110_000 + 50_000 + 60_000);
  });

  it("exclut les joueurs non-active du top earners et du total TV", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proTeamRoster.findMany.mockResolvedValue([
      {
        id: "p_active",
        name: "Active",
        position: "Lineman",
        ma: 5,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: [],
        status: "active",
        form: 50,
        niggling: 0,
        spp: 0,
        level: 1,
        tvCached: 50000,
        tdCount: 0,
        casCount: 0,
        compCount: 0,
        mvpCount: 0,
        maBonus: 0,
        stBonus: 0,
        agBonus: 0,
        paBonus: 0,
        avBonus: 0,
      },
      {
        id: "p_dead",
        name: "Dead",
        position: "Lineman",
        ma: 5,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: [],
        status: "dead",
        form: 0,
        niggling: 0,
        spp: 100,
        level: 5,
        tvCached: 200000,
        tdCount: 5,
        casCount: 0,
        compCount: 0,
        mvpCount: 0,
        maBonus: 0,
        stBonus: 0,
        agBonus: 0,
        paBonus: 0,
        avBonus: 0,
      },
    ]);
    const out = await getProTeamDetail("buf-snow-ogres");
    expect(out.topEarners).toHaveLength(1);
    expect(out.topEarners[0]!.id).toBe("p_active");
    expect(out.totalRosterTv).toBe(50000);
  });

  it("topEarners=[] si aucun joueur actif", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(fakeTeam());
    mocked.proTeamRoster.findMany.mockResolvedValue([]);
    const out = await getProTeamDetail("buf-snow-ogres");
    expect(out.topEarners).toEqual([]);
    expect(out.totalRosterTv).toBe(0);
  });
});

describe("nextLevelSpp — Lot E", () => {
  it("retourne le prochain seuil BB (6/16/31/51/76/176)", () => {
    expect(nextLevelSpp(0)).toBe(6);
    expect(nextLevelSpp(5)).toBe(6);
    expect(nextLevelSpp(6)).toBe(16);
    expect(nextLevelSpp(15)).toBe(16);
    expect(nextLevelSpp(16)).toBe(31);
    expect(nextLevelSpp(50)).toBe(51);
    expect(nextLevelSpp(75)).toBe(76);
    expect(nextLevelSpp(175)).toBe(176);
  });

  it("retourne null pour un legend (>= 176 SPP)", () => {
    expect(nextLevelSpp(176)).toBeNull();
    expect(nextLevelSpp(500)).toBeNull();
  });
});
