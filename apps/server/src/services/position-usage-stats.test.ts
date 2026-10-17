import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findMany: vi.fn() },
    teamPlayer: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    leagueMatchSheet: { findMany: vi.fn() },
    match: { findMany: vi.fn() },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  foldCareerExtrasByPosition,
  getRosterPositionStats,
} from "./position-usage-stats";
import { prisma } from "../prisma";
import { EMPTY_CAREER_COUNTERS } from "./player-career-stats";

interface MockedPrisma {
  team: { findMany: ReturnType<typeof vi.fn> };
  teamPlayer: {
    groupBy: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  leagueMatchSheet: { findMany: ReturnType<typeof vi.fn> };
  match: { findMany: ReturnType<typeof vi.fn> };
}
const mockedPrisma = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.resetAllMocks();
  // Par défaut : aucune feuille validée, la carrière = compteurs.
  mockedPrisma.team.findMany.mockResolvedValue([]);
  mockedPrisma.teamPlayer.findMany.mockResolvedValue([]);
  mockedPrisma.leagueMatchSheet.findMany.mockResolvedValue([]);
  mockedPrisma.match.findMany.mockResolvedValue([]);
});

describe("foldCareerExtrasByPosition", () => {
  it("additionne par poste coupe et matchs de ligue sans évènement", () => {
    const extras = foldCareerExtrasByPosition(
      new Map([
        [
          "p1",
          {
            leagueMatchesNotPersisted: 1,
            cup: { ...EMPTY_CAREER_COUNTERS, matchesPlayed: 2, touchdowns: 3, casualties: 1, mvpAwards: 1 },
          },
        ],
        ["p2", { leagueMatchesNotPersisted: 2, cup: EMPTY_CAREER_COUNTERS }],
        ["inconnu", { leagueMatchesNotPersisted: 9, cup: EMPTY_CAREER_COUNTERS }],
      ]),
      new Map([
        ["p1", "Blitzer"],
        ["p2", "Blitzer"],
      ]),
    );
    expect(extras.get("Blitzer")).toEqual({
      matchesPlayed: 5,
      touchdowns: 3,
      casualties: 1,
      mvpAwards: 1,
    });
    expect(extras.size).toBe(1);
  });
});

describe("getRosterPositionStats", () => {
  it("agrège le compte + les moyennes carrière par position", async () => {
    mockedPrisma.teamPlayer.groupBy.mockResolvedValue([
      {
        position: "Coureur d'Égouts",
        _count: { _all: 4 },
        _sum: {
          spp: 80,
          totalTouchdowns: 20,
          totalCasualties: 6,
          totalMvpAwards: 4,
          matchesPlayed: 40,
        },
      },
      {
        position: "Lanceur Skaven",
        _count: { _all: 2 },
        _sum: {
          spp: 10,
          totalTouchdowns: 1,
          totalCasualties: 0,
          totalMvpAwards: 1,
          matchesPlayed: 8,
        },
      },
    ]);

    const stats = await getRosterPositionStats("skaven", "season_3");

    expect(stats.totalPlayers).toBe(6);
    expect(stats.byPosition["Coureur d'Égouts"]).toEqual({
      count: 4,
      matchesPlayed: 40,
      avgSpp: 20,
      avgTouchdowns: 5,
      avgCasualties: 1.5,
      avgMvp: 1,
    });
    expect(stats.byPosition["Lanceur Skaven"].avgSpp).toBe(5);
  });

  it("ajoute aux moyennes ce que les joueurs ont fait en coupe", async () => {
    mockedPrisma.teamPlayer.groupBy.mockResolvedValue([
      {
        position: "Chevalier du Graal",
        _count: { _all: 1 },
        _sum: {
          spp: 0,
          totalTouchdowns: 0,
          totalCasualties: 0,
          totalMvpAwards: 0,
          matchesPlayed: 0,
        },
      },
    ]);
    mockedPrisma.team.findMany.mockResolvedValue([{ id: "T1" }]);
    mockedPrisma.teamPlayer.findMany
      // Joueurs lus par le chargeur de carrière…
      .mockResolvedValueOnce([
        { id: "p1", teamId: "T1", number: 1, name: "Bohémond", position: "Chevalier du Graal" },
      ])
      // … puis le poste des joueurs concernés.
      .mockResolvedValueOnce([{ id: "p1", position: "Chevalier du Graal" }]);
    mockedPrisma.leagueMatchSheet.findMany.mockResolvedValue([
      {
        pairingId: null,
        cupPairingId: "cp-1",
        forfeitSide: null,
        motmPlayerIds: [],
        rosterSnapshotHome: { players: [{ id: "p1" }] },
        rosterSnapshotAway: null,
        pairing: null,
        cupPairing: { homeTeamId: "T1", awayTeamId: "T2" },
        events: [
          { kind: "touchdown", team: "home", actorPlayerId: "p1" },
          { kind: "touchdown", team: "home", actorPlayerId: "p1" },
        ],
      },
    ]);

    const stats = await getRosterPositionStats("bretonnian", "season_3");

    expect(mockedPrisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roster: "bretonnian", ruleset: "season_3" } }),
    );
    expect(stats.byPosition["Chevalier du Graal"]).toMatchObject({
      matchesPlayed: 1,
      avgTouchdowns: 2,
    });
  });

  it("sert les compteurs seuls si les feuilles sont illisibles", async () => {
    mockedPrisma.teamPlayer.groupBy.mockResolvedValue([
      {
        position: "Blitzer",
        _count: { _all: 1 },
        _sum: { spp: 0, totalTouchdowns: 2, totalCasualties: 0, totalMvpAwards: 0, matchesPlayed: 3 },
      },
    ]);
    mockedPrisma.team.findMany.mockRejectedValue(new Error("db down"));
    const stats = await getRosterPositionStats("human", "season_3");
    expect(stats.byPosition.Blitzer).toMatchObject({ matchesPlayed: 3, avgTouchdowns: 2 });
  });

  it("scope la requête au roster + ruleset", async () => {
    mockedPrisma.teamPlayer.groupBy.mockResolvedValue([]);
    await getRosterPositionStats("amazon", "season_3");
    const arg = mockedPrisma.teamPlayer.groupBy.mock.calls[0][0];
    expect(arg.where).toEqual({
      team: { roster: "amazon", ruleset: "season_3" },
    });
    expect(arg.by).toEqual(["position"]);
  });

  it("gère les sommes nulles et l'absence de joueurs sans diviser par zéro", async () => {
    mockedPrisma.teamPlayer.groupBy.mockResolvedValue([
      {
        position: "Rat Ogre",
        _count: { _all: 0 },
        _sum: {
          spp: null,
          totalTouchdowns: null,
          totalCasualties: null,
          totalMvpAwards: null,
          matchesPlayed: null,
        },
      },
    ]);
    const stats = await getRosterPositionStats("skaven", "season_3");
    expect(stats.byPosition["Rat Ogre"]).toEqual({
      count: 0,
      matchesPlayed: 0,
      avgSpp: 0,
      avgTouchdowns: 0,
      avgCasualties: 0,
      avgMvp: 0,
    });
  });
});
