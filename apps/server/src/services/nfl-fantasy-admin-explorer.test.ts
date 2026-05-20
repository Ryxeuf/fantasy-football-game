import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflSeason: { findMany: vi.fn() },
    nflWeek: { groupBy: vi.fn() },
    nflGame: { groupBy: vi.fn(), findMany: vi.fn() },
    nflPlayer: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    nflTeam: { findMany: vi.fn(), findUnique: vi.fn() },
    nflGameStat: { findMany: vi.fn(), update: vi.fn() },
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
  getNflPlayerDetail,
  getNflTeamDetail,
  listNflPlayersForAdmin,
  listNflSeasonsForAdmin,
  listNflTeamsForAdmin,
  recomputePlayerSpp,
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
