import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflSeason: { findMany: vi.fn(), findUnique: vi.fn() },
    nflWeek: { groupBy: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    nflGame: { groupBy: vi.fn(), findMany: vi.fn() },
    nflPlayer: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    nflTeam: { findMany: vi.fn(), findUnique: vi.fn() },
    nflGameStat: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      update: vi.fn(),
    },
    nflIngestRun: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    nflFantasyLeague: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    nflFantasyEntry: { findMany: vi.fn(), groupBy: vi.fn() },
    nflFantasyMatchup: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      findUnique: vi.fn(),
    },
    nflFantasyLineup: { findMany: vi.fn() },
    nflFantasyLineupStarter: { findMany: vi.fn() },
  },
}));

vi.mock("@bb/nfl-mapper", async () => {
  const actual = await vi.importActual<typeof import("@bb/nfl-mapper")>(
    "@bb/nfl-mapper",
  );
  return {
    ...actual,
    computeSpp: vi.fn(),
    getBbPosition: vi.fn(),
  };
});

vi.mock("./nfl-ingest", () => ({
  buildStatLineFromRow: vi.fn(),
}));

import { prisma } from "../prisma";
import { computeSpp, getBbPosition } from "@bb/nfl-mapper";
import { buildStatLineFromRow } from "./nfl-ingest";
import {
  NflFantasyAdminError,
  cleanupReplayLeagues,
  getLeagueDetailForAdmin,
  getMatchupDetailForAdmin,
  getNflIngestRunForAdmin,
  getNflPlayerDetail,
  getNflTeamDetail,
  getWeekDetail,
  listAllLeaguesForAdmin,
  listNflIngestRunsForAdmin,
  listNflPlayersForAdmin,
  listNflSeasonsForAdmin,
  listNflTeamsForAdmin,
  listWeeksForSeason,
  recomputePlayerSpp,
  recomputeSeasonSpp,
  reDeriveAllPlayersBb,
  reDerivePlayerBb,
} from "./nfl-fantasy-admin-explorer";

beforeEach(() => {
  vi.resetAllMocks();
});

// ────────────────────────────────────────────────────────────────────
// listNflSeasonsForAdmin
// ────────────────────────────────────────────────────────────────────

describe("listNflSeasonsForAdmin", () => {
  it("retourne un tableau vide si aucune saison", async () => {
    vi.mocked(prisma.nflSeason.findMany).mockResolvedValueOnce([] as never);
    const out = await listNflSeasonsForAdmin();
    expect(out).toEqual([]);
  });

  it("agrege weeks + games + players par saison", async () => {
    vi.mocked(prisma.nflSeason.findMany).mockResolvedValueOnce([
      {
        id: "2025",
        status: "in_progress",
        startDate: new Date("2025-09-04"),
        endDate: new Date("2026-02-15"),
      },
      {
        id: "2024",
        status: "completed",
        startDate: new Date("2024-09-05"),
        endDate: new Date("2025-02-09"),
      },
    ] as never);
    vi.mocked(prisma.nflWeek.groupBy).mockResolvedValueOnce([
      { seasonId: "2025", _count: { _all: 22 } },
      { seasonId: "2024", _count: { _all: 22 } },
    ] as never);
    vi.mocked(prisma.nflGame.groupBy).mockResolvedValueOnce([
      { seasonId: "2025", _count: { _all: 100 } },
      { seasonId: "2024", _count: { _all: 285 } },
    ] as never);
    vi.mocked(prisma.nflPlayer.count)
      .mockResolvedValueOnce(800 as never)
      .mockResolvedValueOnce(1500 as never);

    const out = await listNflSeasonsForAdmin();
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: "2025",
      status: "in_progress",
      weeksCount: 22,
      gamesCount: 100,
      playersCount: 800,
    });
    expect(out[1]).toMatchObject({
      id: "2024",
      weeksCount: 22,
      gamesCount: 285,
      playersCount: 1500,
    });
  });
});

// ────────────────────────────────────────────────────────────────────
// listNflTeamsForAdmin
// ────────────────────────────────────────────────────────────────────

describe("listNflTeamsForAdmin", () => {
  it("agrege joueurs actifs + total + games sur la saison", async () => {
    vi.mocked(prisma.nflTeam.findMany).mockResolvedValueOnce([
      { code: "KC", city: "Kansas City", bbRace: "Skaven", raceLabel: "Kansas City Skaven" },
      { code: "MIA", city: "Miami", bbRace: "Dwarf", raceLabel: "Miami Dwarves" },
    ] as never);
    vi.mocked(prisma.nflPlayer.groupBy)
      .mockResolvedValueOnce([
        { teamCode: "KC", _count: { _all: 50 } },
        { teamCode: "MIA", _count: { _all: 45 } },
      ] as never)
      .mockResolvedValueOnce([
        { teamCode: "KC", _count: { _all: 55 } },
        { teamCode: "MIA", _count: { _all: 60 } },
      ] as never);
    vi.mocked(prisma.nflGame.groupBy)
      .mockResolvedValueOnce([{ homeTeam: "KC", _count: { _all: 8 } }] as never)
      .mockResolvedValueOnce([{ awayTeam: "KC", _count: { _all: 9 } }] as never);

    const out = await listNflTeamsForAdmin({ seasonId: "2025" });
    expect(out).toHaveLength(2);
    const kc = out.find((t) => t.code === "KC")!;
    expect(kc.activePlayers).toBe(50);
    expect(kc.totalPlayers).toBe(55);
    expect(kc.gamesInSeason).toBe(17); // 8 home + 9 away
    const mia = out.find((t) => t.code === "MIA")!;
    expect(mia.activePlayers).toBe(45);
    expect(mia.gamesInSeason).toBe(0); // pas de games dans le mock
  });

  it("sans seasonId, gamesInSeason = 0 partout", async () => {
    vi.mocked(prisma.nflTeam.findMany).mockResolvedValueOnce([
      { code: "KC", city: "Kansas City", bbRace: "Skaven", raceLabel: "KC Skaven" },
    ] as never);
    vi.mocked(prisma.nflPlayer.groupBy)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const out = await listNflTeamsForAdmin({});
    expect(out[0]!.gamesInSeason).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// getNflTeamDetail
// ────────────────────────────────────────────────────────────────────

describe("getNflTeamDetail", () => {
  it("retourne null si team inexistante", async () => {
    vi.mocked(prisma.nflTeam.findUnique).mockResolvedValueOnce(null as never);
    const out = await getNflTeamDetail({ code: "XXX" });
    expect(out).toBeNull();
  });

  it("retourne le detail + roster + games tries", async () => {
    vi.mocked(prisma.nflTeam.findUnique).mockResolvedValueOnce({
      code: "KC",
      city: "Kansas City",
      bbRace: "Skaven",
      raceLabel: "Kansas City Skaven",
    } as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValueOnce([
      {
        id: "P1",
        pseudonym: "Sidearm Wizard",
        realName: "Pat M.",
        realNameDisplay: false,
        jerseyNumber: 15,
        nflPosition: "QB",
        bbPosition: "Thrower",
        status: "active",
      },
      {
        id: "P2",
        pseudonym: "IR Guy",
        realName: "Inj Player",
        realNameDisplay: false,
        jerseyNumber: 88,
        nflPosition: "WR",
        bbPosition: "Catcher",
        status: "ir",
      },
    ] as never);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValueOnce([
      {
        id: "G1",
        weekId: "2025:W10",
        homeTeam: "KC",
        awayTeam: "BUF",
        kickoffAt: new Date("2025-11-09T17:00:00Z"),
        status: "final",
        homeScore: 30,
        awayScore: 21,
      },
    ] as never);

    const out = await getNflTeamDetail({ code: "KC", seasonId: "2025" });
    expect(out).not.toBeNull();
    expect(out!.code).toBe("KC");
    expect(out!.players).toHaveLength(2);
    expect(out!.activePlayers).toBe(1);
    expect(out!.totalPlayers).toBe(2);
    expect(out!.gamesInSeason).toBe(1);
    expect(out!.games[0]!.opponent).toBe("BUF");
    expect(out!.games[0]!.isHome).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// listNflPlayersForAdmin
// ────────────────────────────────────────────────────────────────────

describe("listNflPlayersForAdmin", () => {
  it("clamp pageSize a 200 et page a 1+", async () => {
    vi.mocked(prisma.nflPlayer.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValueOnce([] as never);

    const out = await listNflPlayersForAdmin({ page: 0, pageSize: 9999 });
    expect(out.page).toBe(1);
    expect(out.pageSize).toBe(200);
  });

  it("aggrege SPP + games sur la saison filtree", async () => {
    vi.mocked(prisma.nflPlayer.count).mockResolvedValueOnce(2 as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValueOnce([
      {
        id: "P1",
        pseudonym: "QB Star",
        realName: "Real 1",
        realNameDisplay: false,
        teamCode: "KC",
        jerseyNumber: 15,
        nflPosition: "QB",
        bbPosition: "Thrower",
        status: "active",
      },
      {
        id: "P2",
        pseudonym: "WR Sub",
        realName: "Real 2",
        realNameDisplay: false,
        teamCode: "MIA",
        jerseyNumber: 81,
        nflPosition: "WR",
        bbPosition: "Catcher",
        status: "active",
      },
    ] as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValueOnce([
      { playerId: "P1", computedSpp: 10 },
      { playerId: "P1", computedSpp: 5 },
      { playerId: "P2", computedSpp: 3 },
    ] as never);

    const out = await listNflPlayersForAdmin({ seasonId: "2025" });
    expect(out.players).toHaveLength(2);
    const p1 = out.players.find((p) => p.id === "P1")!;
    expect(p1.totalSpp).toBe(15);
    expect(p1.gamesPlayed).toBe(2);
    const p2 = out.players.find((p) => p.id === "P2")!;
    expect(p2.totalSpp).toBe(3);
    expect(p2.gamesPlayed).toBe(1);
  });

  it("n'inclut pas totalSpp/gamesPlayed sans seasonId", async () => {
    vi.mocked(prisma.nflPlayer.count).mockResolvedValueOnce(1 as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValueOnce([
      {
        id: "P1",
        pseudonym: "X",
        realName: "X",
        realNameDisplay: false,
        teamCode: null,
        jerseyNumber: null,
        nflPosition: "QB",
        bbPosition: "Thrower",
        status: "retired",
      },
    ] as never);

    const out = await listNflPlayersForAdmin({});
    expect(out.players[0]!.totalSpp).toBeUndefined();
    expect(out.players[0]!.gamesPlayed).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────
// getNflPlayerDetail
// ────────────────────────────────────────────────────────────────────

describe("getNflPlayerDetail", () => {
  it("retourne null si joueur introuvable", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValueOnce(null as never);
    const out = await getNflPlayerDetail({ id: "ghost" });
    expect(out).toBeNull();
  });

  it("retourne stats agregees + tri par kickoff DESC", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValueOnce({
      id: "P1",
      pseudonym: "QB",
      realName: "Real",
      realNameDisplay: false,
      teamCode: "KC",
      jerseyNumber: 15,
      nflPosition: "QB",
      bbPosition: "Thrower",
      bbStats: {},
      bbSkills: [],
      status: "active",
      retiredAt: null,
    } as never);
    vi.mocked(prisma.nflTeam.findUnique).mockResolvedValueOnce({
      code: "KC",
      city: "Kansas City",
      raceLabel: "KC Skaven",
      bbRace: "Skaven",
    } as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValueOnce([
      {
        gameId: "G1",
        computedSpp: 10,
        sppBreakdown: { events: [], totalSpp: 10 },
        rawStats: {},
        ingestSource: "nflverse",
        ingestedAt: new Date("2025-11-10"),
        game: {
          weekId: "2025:W10",
          seasonId: "2025",
          homeTeam: "KC",
          awayTeam: "BUF",
          homeScore: 30,
          awayScore: 21,
          status: "final",
          kickoffAt: new Date("2025-11-09T17:00:00Z"),
          week: { weekNumber: 10 },
        },
      },
      {
        gameId: "G2",
        computedSpp: 5,
        sppBreakdown: { events: [], totalSpp: 5 },
        rawStats: {},
        ingestSource: "nflverse",
        ingestedAt: new Date("2025-11-17"),
        game: {
          weekId: "2025:W11",
          seasonId: "2025",
          homeTeam: "DEN",
          awayTeam: "KC",
          homeScore: 14,
          awayScore: 28,
          status: "final",
          kickoffAt: new Date("2025-11-16T17:00:00Z"),
          week: { weekNumber: 11 },
        },
      },
    ] as never);

    const out = await getNflPlayerDetail({ id: "P1", seasonId: "2025" });
    expect(out).not.toBeNull();
    expect(out!.totalSpp).toBe(15);
    expect(out!.gamesPlayed).toBe(2);
    expect(out!.stats).toHaveLength(2);
    expect(out!.stats[0]!.opponent).toBe("BUF");
    expect(out!.stats[0]!.isHome).toBe(true);
    expect(out!.stats[1]!.opponent).toBe("DEN");
    expect(out!.stats[1]!.isHome).toBe(false);
    expect(out!.team?.bbRace).toBe("Skaven");
  });
});

// ────────────────────────────────────────────────────────────────────
// recomputePlayerSpp
// ────────────────────────────────────────────────────────────────────

describe("recomputePlayerSpp", () => {
  it("throw PLAYER_NOT_FOUND si joueur absent", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValueOnce(null as never);
    await expect(recomputePlayerSpp("ghost")).rejects.toBeInstanceOf(
      NflFantasyAdminError,
    );
  });

  it("relance computeSpp() et update chaque NflGameStat", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValueOnce({
      id: "P1",
      bbPosition: "Thrower",
    } as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValueOnce([
      { id: "S1", computedSpp: 10, rawStats: { position: "QB" } },
      { id: "S2", computedSpp: 5, rawStats: { position: "QB" } },
    ] as never);
    vi.mocked(buildStatLineFromRow).mockReturnValue({} as never);
    vi.mocked(computeSpp)
      .mockReturnValueOnce({ totalSpp: 12, events: [] } as never)
      .mockReturnValueOnce({ totalSpp: 7, events: [] } as never);
    vi.mocked(prisma.nflGameStat.update).mockResolvedValue({} as never);

    const out = await recomputePlayerSpp("P1");
    expect(out.playerId).toBe("P1");
    expect(out.statsUpdated).toBe(2);
    expect(out.previousTotalSpp).toBe(15);
    expect(out.newTotalSpp).toBe(19);
    expect(prisma.nflGameStat.update).toHaveBeenCalledTimes(2);
  });

  it("supporte stats null / pas de rawStats", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValueOnce({
      id: "P1",
      bbPosition: "Thrower",
    } as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValueOnce([
      { id: "S1", computedSpp: null, rawStats: null },
    ] as never);
    vi.mocked(buildStatLineFromRow).mockReturnValue({} as never);
    vi.mocked(computeSpp).mockReturnValueOnce({
      totalSpp: 3,
      events: [],
    } as never);

    const out = await recomputePlayerSpp("P1");
    expect(out.previousTotalSpp).toBe(0);
    expect(out.newTotalSpp).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────
// reDerivePlayerBb
// ────────────────────────────────────────────────────────────────────

describe("reDerivePlayerBb", () => {
  it("throw PLAYER_NOT_FOUND si joueur absent", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValueOnce(null as never);
    await expect(reDerivePlayerBb("ghost")).rejects.toBeInstanceOf(
      NflFantasyAdminError,
    );
  });

  it("throw PLAYER_NO_TEAM si pas de teamCode", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValueOnce({
      id: "P1",
      teamCode: null,
      nflPosition: "QB",
      bbPosition: "Thrower",
    } as never);
    await expect(reDerivePlayerBb("P1")).rejects.toMatchObject({
      code: "PLAYER_NO_TEAM",
    });
  });

  it("update bbPosition si different", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValueOnce({
      id: "P1",
      teamCode: "KC",
      nflPosition: "QB",
      bbPosition: "Thrower",
    } as never);
    vi.mocked(prisma.nflTeam.findUnique).mockResolvedValueOnce({
      code: "KC",
      bbRace: "Skaven",
    } as never);
    vi.mocked(getBbPosition).mockReturnValueOnce("Gutter Runner" as never);
    vi.mocked(prisma.nflPlayer.update).mockResolvedValue({} as never);

    const out = await reDerivePlayerBb("P1");
    expect(out.changed).toBe(true);
    expect(out.previousBbPosition).toBe("Thrower");
    expect(out.newBbPosition).toBe("Gutter Runner");
    expect(prisma.nflPlayer.update).toHaveBeenCalledOnce();
  });

  it("ne touche pas la DB si bbPosition identique (idempotent)", async () => {
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValueOnce({
      id: "P1",
      teamCode: "KC",
      nflPosition: "QB",
      bbPosition: "Thrower",
    } as never);
    vi.mocked(prisma.nflTeam.findUnique).mockResolvedValueOnce({
      code: "KC",
      bbRace: "Skaven",
    } as never);
    vi.mocked(getBbPosition).mockReturnValueOnce("Thrower" as never);

    const out = await reDerivePlayerBb("P1");
    expect(out.changed).toBe(false);
    expect(prisma.nflPlayer.update).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────
// listNflIngestRunsForAdmin (Phase 3.D)
// ────────────────────────────────────────────────────────────────────

describe("listNflIngestRunsForAdmin", () => {
  it("clamp limit a 500 + tri DESC startedAt + duree calculee", async () => {
    vi.mocked(prisma.nflIngestRun.findMany).mockResolvedValueOnce([
      {
        id: "r1",
        source: "nflverse",
        weekId: "2025:W10",
        startedAt: new Date("2025-11-09T10:00:00Z"),
        completedAt: new Date("2025-11-09T10:00:30Z"),
        status: "success",
        result: { gamesUpdated: 14 },
      },
      {
        id: "r2",
        source: "espn",
        weekId: null,
        startedAt: new Date("2025-11-08T10:00:00Z"),
        completedAt: null,
        status: "in_progress",
        result: {},
      },
    ] as never);

    const out = await listNflIngestRunsForAdmin({ limit: 1000 });
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe("r1");
    expect(out[0]!.durationMs).toBe(30_000);
    expect(out[1]!.durationMs).toBeNull();
  });

  it("retourne tableau vide si pas de runs", async () => {
    vi.mocked(prisma.nflIngestRun.findMany).mockResolvedValueOnce([] as never);
    const out = await listNflIngestRunsForAdmin({});
    expect(out).toEqual([]);
  });
});

describe("getNflIngestRunForAdmin", () => {
  it("retourne null si introuvable", async () => {
    vi.mocked(prisma.nflIngestRun.findUnique).mockResolvedValueOnce(
      null as never,
    );
    const out = await getNflIngestRunForAdmin("nope");
    expect(out).toBeNull();
  });

  it("retourne detail avec durationMs", async () => {
    vi.mocked(prisma.nflIngestRun.findUnique).mockResolvedValueOnce({
      id: "r1",
      source: "nflverse",
      weekId: "2025:W10",
      startedAt: new Date("2025-11-09T10:00:00Z"),
      completedAt: new Date("2025-11-09T10:01:00Z"),
      status: "success",
      result: { gamesUpdated: 14 },
    } as never);
    const out = await getNflIngestRunForAdmin("r1");
    expect(out?.durationMs).toBe(60_000);
  });
});

// ────────────────────────────────────────────────────────────────────
// listWeeksForSeason (Phase 3.D)
// ────────────────────────────────────────────────────────────────────

describe("listWeeksForSeason", () => {
  it("agrege games + ingest status par week", async () => {
    vi.mocked(prisma.nflWeek.findMany).mockResolvedValueOnce([
      {
        id: "2025:W10",
        seasonId: "2025",
        weekNumber: 10,
        startDate: new Date("2025-11-06"),
        endDate: new Date("2025-11-10"),
        isPlayoffs: false,
      },
      {
        id: "2025:W19",
        seasonId: "2025",
        weekNumber: 19,
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-12"),
        isPlayoffs: true,
      },
    ] as never);
    vi.mocked(prisma.nflGame.groupBy)
      .mockResolvedValueOnce([
        { weekId: "2025:W10", _count: { _all: 14 } },
      ] as never)
      .mockResolvedValueOnce([
        { weekId: "2025:W10", _count: { _all: 13 } },
      ] as never);
    vi.mocked(prisma.nflIngestRun.findMany).mockResolvedValueOnce([
      {
        weekId: "2025:W10",
        status: "success",
        startedAt: new Date("2025-11-09"),
      },
      {
        weekId: "2025:W10",
        status: "partial",
        startedAt: new Date("2025-11-08"),
      },
    ] as never);

    const out = await listWeeksForSeason("2025");
    expect(out).toHaveLength(2);
    const w10 = out.find((w) => w.weekNumber === 10)!;
    expect(w10.gamesCount).toBe(14);
    expect(w10.gamesFinal).toBe(13);
    // La plus recente startedAt gagne (success ici)
    expect(w10.ingestStatus).toBe("success");
    expect(w10.isPlayoffs).toBe(false);
    const w19 = out.find((w) => w.weekNumber === 19)!;
    expect(w19.isPlayoffs).toBe(true);
    expect(w19.ingestStatus).toBeNull();
  });

  it("retourne [] si saison sans weeks", async () => {
    vi.mocked(prisma.nflWeek.findMany).mockResolvedValueOnce([] as never);
    const out = await listWeeksForSeason("9999");
    expect(out).toEqual([]);
  });
});

describe("getWeekDetail", () => {
  it("retourne null si week introuvable", async () => {
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValueOnce(null as never);
    const out = await getWeekDetail("nope");
    expect(out).toBeNull();
  });

  it("agrege games + statsCount par game", async () => {
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValueOnce({
      id: "2025:W10",
      seasonId: "2025",
      weekNumber: 10,
      startDate: new Date("2025-11-06"),
      endDate: new Date("2025-11-10"),
      isPlayoffs: false,
    } as never);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValueOnce([
      {
        id: "G1",
        homeTeam: "KC",
        awayTeam: "BUF",
        homeScore: 30,
        awayScore: 21,
        status: "final",
        kickoffAt: new Date("2025-11-09T17:00:00Z"),
      },
    ] as never);
    vi.mocked(prisma.nflGameStat.groupBy).mockResolvedValueOnce([
      { gameId: "G1", _count: { _all: 60 } },
    ] as never);
    vi.mocked(prisma.nflIngestRun.findFirst).mockResolvedValueOnce({
      status: "success",
    } as never);

    const out = await getWeekDetail("2025:W10");
    expect(out!.games).toHaveLength(1);
    expect(out!.games[0]!.statsCount).toBe(60);
    expect(out!.ingestStatus).toBe("success");
  });
});

// ────────────────────────────────────────────────────────────────────
// listAllLeaguesForAdmin (Phase 3.D)
// ────────────────────────────────────────────────────────────────────

describe("listAllLeaguesForAdmin", () => {
  it("retourne pagination + agrege entries/matchups par league", async () => {
    vi.mocked(prisma.nflFantasyLeague.count).mockResolvedValueOnce(2 as never);
    vi.mocked(prisma.nflFantasyLeague.findMany).mockResolvedValueOnce([
      {
        id: "L1",
        name: "Public Test",
        ownerId: "U1",
        seasonId: "2025",
        size: 10,
        type: "public",
        draftMode: "snake",
        status: "in_progress",
        inviteCode: null,
        createdAt: new Date("2025-10-01"),
        updatedAt: new Date("2025-11-01"),
      },
      {
        id: "L2",
        name: "Private",
        ownerId: "U2",
        seasonId: "2025",
        size: 4,
        type: "private",
        draftMode: "snake",
        status: "draft",
        inviteCode: "ABC12345",
        createdAt: new Date("2025-10-05"),
        updatedAt: new Date("2025-10-05"),
      },
    ] as never);
    vi.mocked(prisma.nflFantasyEntry.groupBy).mockResolvedValueOnce([
      { leagueId: "L1", _count: { _all: 8 } },
      { leagueId: "L2", _count: { _all: 2 } },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.groupBy).mockResolvedValueOnce([
      { leagueId: "L1", _count: { _all: 4 } },
    ] as never);

    const out = await listAllLeaguesForAdmin({});
    expect(out.total).toBe(2);
    expect(out.leagues).toHaveLength(2);
    const l1 = out.leagues.find((l) => l.id === "L1")!;
    expect(l1.entriesCount).toBe(8);
    expect(l1.matchupsCount).toBe(4);
    const l2 = out.leagues.find((l) => l.id === "L2")!;
    expect(l2.entriesCount).toBe(2);
    expect(l2.matchupsCount).toBe(0);
  });

  it("clamp page/pageSize", async () => {
    vi.mocked(prisma.nflFantasyLeague.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.nflFantasyLeague.findMany).mockResolvedValueOnce(
      [] as never,
    );
    const out = await listAllLeaguesForAdmin({ page: 0, pageSize: 9999 });
    expect(out.page).toBe(1);
    expect(out.pageSize).toBe(200);
  });
});

describe("getLeagueDetailForAdmin", () => {
  it("retourne null si league introuvable", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValueOnce(
      null as never,
    );
    const out = await getLeagueDetailForAdmin("nope");
    expect(out).toBeNull();
  });

  it("retourne metadata + entries + matchups", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValueOnce({
      id: "L1",
      name: "Test",
      ownerId: "U1",
      seasonId: "2025",
      size: 10,
      type: "private",
      draftMode: "snake",
      status: "in_progress",
      inviteCode: "ABC12345",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValueOnce([
      {
        id: "E1",
        userId: "U1",
        teamName: "Stompers",
        bbRace: "Skaven",
        totalTV: 1300,
        joinedAt: new Date("2025-10-01"),
      },
    ] as never);
    vi.mocked(prisma.nflFantasyMatchup.findMany).mockResolvedValueOnce([
      {
        id: "M1",
        weekId: "2025:W10",
        homeEntryId: "E1",
        awayEntryId: "E2",
        homeScore: 24,
        awayScore: 15,
        winnerId: "E1",
        settledAt: new Date("2025-11-10"),
      },
    ] as never);

    const out = await getLeagueDetailForAdmin("L1");
    expect(out?.entries).toHaveLength(1);
    expect(out?.matchups).toHaveLength(1);
    expect(out?.entriesCount).toBe(1);
    expect(out?.matchupsCount).toBe(1);
    expect(out?.matchups[0]!.winnerId).toBe("E1");
  });
});

// ────────────────────────────────────────────────────────────────────
// recomputeSeasonSpp (Phase 3.F)
// ────────────────────────────────────────────────────────────────────

describe("recomputeSeasonSpp", () => {
  it("throw SEASON_NOT_FOUND si saison absente", async () => {
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValueOnce(
      null as never,
    );
    await expect(recomputeSeasonSpp("9999")).rejects.toBeInstanceOf(
      NflFantasyAdminError,
    );
  });

  it("relance computeSpp() + update sur chaque stat de la saison", async () => {
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValueOnce({
      id: "2024",
    } as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValueOnce([
      {
        id: "S1",
        computedSpp: 10,
        rawStats: { position: "QB" },
        player: { bbPosition: "Thrower" },
      },
      {
        id: "S2",
        computedSpp: 5,
        rawStats: { position: "WR" },
        player: { bbPosition: "Catcher" },
      },
    ] as never);
    vi.mocked(buildStatLineFromRow).mockReturnValue({} as never);
    vi.mocked(computeSpp)
      .mockReturnValueOnce({ totalSpp: 12, events: [] } as never)
      .mockReturnValueOnce({ totalSpp: 7, events: [] } as never);
    vi.mocked(prisma.nflGameStat.update).mockResolvedValue({} as never);

    const out = await recomputeSeasonSpp("2024");
    expect(out.statsUpdated).toBe(2);
    expect(out.previousTotalSpp).toBe(15);
    expect(out.newTotalSpp).toBe(19);
    expect(out.errors).toEqual([]);
  });

  it("collecte les erreurs et continue", async () => {
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValueOnce({
      id: "2024",
    } as never);
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValueOnce([
      {
        id: "S1",
        computedSpp: 10,
        rawStats: { position: "QB" },
        player: { bbPosition: "Thrower" },
      },
      {
        id: "S2",
        computedSpp: 5,
        rawStats: { position: "WR" },
        player: { bbPosition: "Catcher" },
      },
    ] as never);
    vi.mocked(buildStatLineFromRow).mockReturnValue({} as never);
    vi.mocked(computeSpp)
      .mockImplementationOnce(() => {
        throw new Error("boom");
      })
      .mockReturnValueOnce({ totalSpp: 7, events: [] } as never);
    vi.mocked(prisma.nflGameStat.update).mockResolvedValue({} as never);

    const out = await recomputeSeasonSpp("2024");
    expect(out.statsUpdated).toBe(1);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]?.statId).toBe("S1");
  });
});

// ────────────────────────────────────────────────────────────────────
// reDeriveAllPlayersBb (Phase 3.F)
// ────────────────────────────────────────────────────────────────────

describe("reDeriveAllPlayersBb", () => {
  it("update bbPosition uniquement si different", async () => {
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValueOnce([
      { id: "P1", teamCode: "KC", nflPosition: "QB", bbPosition: "Thrower" },
      { id: "P2", teamCode: "KC", nflPosition: "WR", bbPosition: "Catcher" },
    ] as never);
    vi.mocked(prisma.nflTeam.findMany).mockResolvedValueOnce([
      { code: "KC", bbRace: "Skaven" },
    ] as never);
    vi.mocked(getBbPosition)
      .mockReturnValueOnce("Thrower" as never) // P1 unchanged
      .mockReturnValueOnce("Gutter Runner" as never); // P2 update
    vi.mocked(prisma.nflPlayer.update).mockResolvedValue({} as never);

    const out = await reDeriveAllPlayersBb();
    expect(out.playersUpdated).toBe(1);
    expect(out.playersUnchanged).toBe(1);
    expect(out.playersSkipped).toBe(0);
    expect(prisma.nflPlayer.update).toHaveBeenCalledOnce();
  });

  it("skip si teamRace introuvable", async () => {
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValueOnce([
      {
        id: "P1",
        teamCode: "GHOST",
        nflPosition: "QB",
        bbPosition: "Thrower",
      },
    ] as never);
    vi.mocked(prisma.nflTeam.findMany).mockResolvedValueOnce([] as never);

    const out = await reDeriveAllPlayersBb();
    expect(out.playersSkipped).toBe(1);
    expect(out.playersUpdated).toBe(0);
  });

  it("collecte les erreurs (catch)", async () => {
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValueOnce([
      { id: "P1", teamCode: "KC", nflPosition: "QB", bbPosition: "Thrower" },
    ] as never);
    vi.mocked(prisma.nflTeam.findMany).mockResolvedValueOnce([
      { code: "KC", bbRace: "Skaven" },
    ] as never);
    vi.mocked(getBbPosition).mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const out = await reDeriveAllPlayersBb();
    expect(out.errors).toHaveLength(1);
    expect(out.playersUpdated).toBe(0);
  });
});


// ────────────────────────────────────────────────────────────────────
// cleanupReplayLeagues (Phase 3.I)
// ────────────────────────────────────────────────────────────────────

describe("cleanupReplayLeagues", () => {
  it("retourne 0 si aucune replay league", async () => {
    vi.mocked(prisma.nflFantasyLeague.findMany).mockResolvedValueOnce(
      [] as never,
    );
    const out = await cleanupReplayLeagues();
    expect(out.deletedCount).toBe(0);
    expect(out.leagueIds).toEqual([]);
    expect(prisma.nflFantasyLeague.deleteMany).not.toHaveBeenCalled();
  });

  it("supprime toutes les leagues replay matchees et retourne leurs ids", async () => {
    vi.mocked(prisma.nflFantasyLeague.findMany).mockResolvedValueOnce([
      { id: "L1" },
      { id: "L2" },
      { id: "L3" },
    ] as never);
    vi.mocked(prisma.nflFantasyLeague.deleteMany).mockResolvedValueOnce({
      count: 3,
    } as never);

    const out = await cleanupReplayLeagues();
    expect(out.deletedCount).toBe(3);
    expect(out.leagueIds).toEqual(["L1", "L2", "L3"]);

    expect(prisma.nflFantasyLeague.findMany).toHaveBeenCalledWith({
      where: { ownerId: { startsWith: "replay-" } },
      select: { id: true },
    });
    expect(prisma.nflFantasyLeague.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["L1", "L2", "L3"] } },
    });
  });
});

// ────────────────────────────────────────────────────────────────────
// getMatchupDetailForAdmin (Phase 3.J)
// ────────────────────────────────────────────────────────────────────

describe("getMatchupDetailForAdmin", () => {
  it("retourne null si matchup introuvable", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValueOnce(
      null as never,
    );
    const out = await getMatchupDetailForAdmin("M-missing");
    expect(out).toBeNull();
  });

  it("agrege metadata + 2 sides avec starters + winnerSide", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValueOnce({
      id: "M1",
      leagueId: "L1",
      weekId: "2024:W3",
      homeEntryId: "E-home",
      awayEntryId: "E-away",
      homeScore: 100,
      awayScore: 80,
      winnerId: "E-home",
      settledAt: new Date("2024-09-22T22:00:00Z"),
      createdAt: new Date("2024-09-15T00:00:00Z"),
    } as never);
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValueOnce({
      id: "L1",
      name: "Replay 2024",
      seasonId: "2024",
    } as never);
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValueOnce([
      {
        id: "E-home",
        userId: "U1",
        teamName: "Home Team",
        bbRace: "Skaven",
      },
      {
        id: "E-away",
        userId: "U2",
        teamName: "Away Team",
        bbRace: "Dwarf",
      },
    ] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValueOnce([
      {
        id: "LU-home",
        entryId: "E-home",
        weekId: "2024:W3",
        captainId: "P1",
        viceCaptainId: "P2",
        lockedAt: new Date("2024-09-22T17:00:00Z"),
        totalSpp: 100,
      },
      {
        id: "LU-away",
        entryId: "E-away",
        weekId: "2024:W3",
        captainId: "P3",
        viceCaptainId: "P4",
        lockedAt: new Date("2024-09-22T17:00:00Z"),
        totalSpp: 80,
      },
    ] as never);
    vi.mocked(prisma.nflFantasyLineupStarter.findMany).mockResolvedValueOnce([
      {
        lineupId: "LU-home",
        playerId: "P1",
        bbPosition: "Thrower",
        isCaptain: true,
        isViceCaptain: false,
        rawSpp: 20,
        finalSpp: 30,
        sppBreakdown: { events: [{ kind: "PASSING_TD", count: 2 }] },
      },
      {
        lineupId: "LU-home",
        playerId: "P2",
        bbPosition: "Catcher",
        isCaptain: false,
        isViceCaptain: true,
        rawSpp: 15,
        finalSpp: 18,
        sppBreakdown: { events: [] },
      },
      {
        lineupId: "LU-away",
        playerId: "P3",
        bbPosition: "Blitzer",
        isCaptain: true,
        isViceCaptain: false,
        rawSpp: 10,
        finalSpp: 15,
        sppBreakdown: { events: [] },
      },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValueOnce([
      { id: "P1", pseudonym: "Captain Star", teamCode: "KC", nflPosition: "QB" },
      { id: "P2", pseudonym: "Vice Hero", teamCode: "KC", nflPosition: "WR" },
      { id: "P3", pseudonym: "Opp QB", teamCode: "BUF", nflPosition: "QB" },
    ] as never);

    const out = await getMatchupDetailForAdmin("M1");
    expect(out).not.toBeNull();
    expect(out!.id).toBe("M1");
    expect(out!.leagueName).toBe("Replay 2024");
    expect(out!.seasonId).toBe("2024");
    expect(out!.weekId).toBe("2024:W3");
    expect(out!.winnerSide).toBe("home");
    expect(out!.home.teamName).toBe("Home Team");
    expect(out!.home.score).toBe(100);
    expect(out!.home.starters).toHaveLength(2);
    // Trie DESC par finalSpp : 30 avant 18
    expect(out!.home.starters[0]!.playerId).toBe("P1");
    expect(out!.home.starters[0]!.playerPseudonym).toBe("Captain Star");
    expect(out!.home.starters[0]!.isCaptain).toBe(true);
    expect(out!.away.teamName).toBe("Away Team");
    expect(out!.away.starters).toHaveLength(1);
    expect(out!.away.starters[0]!.playerId).toBe("P3");
  });

  it("winnerSide = 'tie' quand settledAt mais winnerId null", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValueOnce({
      id: "M2",
      leagueId: "L1",
      weekId: "2024:W3",
      homeEntryId: "E-home",
      awayEntryId: "E-away",
      homeScore: 50,
      awayScore: 50,
      winnerId: null,
      settledAt: new Date("2024-09-22T22:00:00Z"),
      createdAt: new Date("2024-09-15T00:00:00Z"),
    } as never);
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValueOnce({
      id: "L1",
      name: "Replay 2024",
      seasonId: "2024",
    } as never);
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValueOnce([
      { id: "E-home", userId: "U1", teamName: "H", bbRace: null },
      { id: "E-away", userId: "U2", teamName: "A", bbRace: null },
    ] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValueOnce(
      [] as never,
    );
    vi.mocked(prisma.nflFantasyLineupStarter.findMany).mockResolvedValueOnce(
      [] as never,
    );
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValueOnce([] as never);

    const out = await getMatchupDetailForAdmin("M2");
    expect(out!.winnerSide).toBe("tie");
  });

  it("winnerSide = null quand pas settle", async () => {
    vi.mocked(prisma.nflFantasyMatchup.findUnique).mockResolvedValueOnce({
      id: "M3",
      leagueId: "L1",
      weekId: "2024:W3",
      homeEntryId: "E-home",
      awayEntryId: "E-away",
      homeScore: null,
      awayScore: null,
      winnerId: null,
      settledAt: null,
      createdAt: new Date("2024-09-15T00:00:00Z"),
    } as never);
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValueOnce({
      id: "L1",
      name: "L1",
      seasonId: "2024",
    } as never);
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValueOnce([
      { id: "E-home", userId: "U1", teamName: "H", bbRace: null },
      { id: "E-away", userId: "U2", teamName: "A", bbRace: null },
    ] as never);
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValueOnce(
      [] as never,
    );
    vi.mocked(prisma.nflFantasyLineupStarter.findMany).mockResolvedValueOnce(
      [] as never,
    );
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValueOnce([] as never);

    const out = await getMatchupDetailForAdmin("M3");
    expect(out!.winnerSide).toBeNull();
    expect(out!.home.starters).toEqual([]);
  });
});
