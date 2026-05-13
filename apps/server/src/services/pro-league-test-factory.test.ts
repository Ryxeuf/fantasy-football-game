/**
 * Tests du service pro-league-test-factory.
 *
 * Couvre :
 *  - createTestSeason : flow nominal, picker d'annee, sub-set teams,
 *    erreurs (league not found, no teams, invalid input).
 *  - listTestSeasons : aggregate compteurs simulated/failed.
 *  - deleteTestSeason : cascade replays + delete season + refus
 *    sur saison non-test (defense-in-depth).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeague: { findUnique: vi.fn() },
    proLeagueSeason: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    proLeagueRound: { updateMany: vi.fn(), count: vi.fn() },
    proLeagueMatch: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      update: vi.fn(),
    },
    proLeagueStandings: { count: vi.fn() },
    proTeam: { findMany: vi.fn() },
    replay: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@bb/sim-engine", () => ({
  ENGINE_VER: "1.0.0-test",
}));

vi.mock("../seeders/pro-league", () => ({
  OLD_WORLD_LEAGUE_SLUG: "old-world-league",
}));

vi.mock("./pro-league-sim-runner", () => ({
  simulateProMatch: vi.fn(),
}));

import { prisma } from "../prisma";
import { simulateProMatch } from "./pro-league-sim-runner";
import {
  createTestSeason,
  deleteTestSeason,
  listTestSeasons,
  TestFactoryError,
} from "./pro-league-test-factory";

interface MockedPrisma {
  proLeague: { findUnique: ReturnType<typeof vi.fn> };
  proLeagueSeason: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  proLeagueRound: {
    updateMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  proLeagueMatch: {
    findMany: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  proLeagueStandings: { count: ReturnType<typeof vi.fn> };
  proTeam: { findMany: ReturnType<typeof vi.fn> };
  replay: { deleteMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

const mocked = prisma as unknown as MockedPrisma;
const simMock = simulateProMatch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createTestSeason", () => {
  it("nominal : cree saison test + simule tous les matchs", async () => {
    mocked.proLeague.findUnique.mockResolvedValueOnce({ id: "league-1" });
    // pickFreeTestYear : aucune annee occupee
    mocked.proLeagueSeason.findMany.mockResolvedValueOnce([]);
    mocked.proTeam.findMany.mockResolvedValueOnce([
      { id: "t1", slug: "team-1" },
      { id: "t2", slug: "team-2" },
      { id: "t3", slug: "team-3" },
      { id: "t4", slug: "team-4" },
    ]);

    const matchIdsCreated: string[] = [];
    mocked.$transaction.mockImplementationOnce(async (fn: any) => {
      let matchCounter = 0;
      const result = await fn({
        proLeagueSeason: {
          create: vi.fn().mockResolvedValueOnce({ id: "season-new" }),
        },
        proLeagueRound: {
          create: vi.fn().mockImplementation(async () => ({
            id: `round-${Math.random().toString(36).slice(2, 6)}`,
          })),
        },
        proLeagueMatch: {
          create: vi.fn().mockImplementation(async () => {
            matchCounter += 1;
            const id = `match-${matchCounter}`;
            matchIdsCreated.push(id);
            return { id };
          }),
        },
        proLeagueStandings: {
          createMany: vi.fn().mockResolvedValueOnce({ count: 4 }),
        },
      });
      return result;
    });

    simMock.mockResolvedValue(true);
    mocked.proLeagueMatch.update.mockResolvedValue({});
    mocked.proLeagueRound.updateMany.mockResolvedValue({ count: 3 });
    mocked.proLeagueSeason.update.mockResolvedValue({});

    const result = await createTestSeason({ label: "regression-v2" });

    expect(result.seasonId).toBe("season-new");
    expect(result.year).toBe(9000);
    expect(result.label).toBe("regression-v2");
    expect(result.teamCount).toBe(4);
    // 4 teams => 3 rounds * 2 matchs = 6 matchs
    expect(result.matchesSimulated).toBe(6);
    expect(result.matchesFailed).toBe(0);
    expect(simMock).toHaveBeenCalledTimes(6);
    // Apres sim ok, on promote chaque match a `completed`
    expect(mocked.proLeagueMatch.update).toHaveBeenCalledTimes(6);
    expect(mocked.proLeagueMatch.update.mock.calls[0][0].data.status).toBe(
      "completed",
    );
    // Rounds + season promus a `completed`
    expect(mocked.proLeagueRound.updateMany).toHaveBeenCalledTimes(1);
    expect(mocked.proLeagueSeason.update).toHaveBeenCalledTimes(1);
    expect(mocked.proLeagueSeason.update.mock.calls[0][0].data.status).toBe(
      "completed",
    );
  });

  it("isTest=true sur season + matches", async () => {
    mocked.proLeague.findUnique.mockResolvedValueOnce({ id: "league-1" });
    mocked.proLeagueSeason.findMany.mockResolvedValueOnce([]);
    mocked.proTeam.findMany.mockResolvedValueOnce([
      { id: "t1", slug: "team-1" },
      { id: "t2", slug: "team-2" },
    ]);

    const seasonCreate = vi.fn().mockResolvedValueOnce({ id: "season-new" });
    const matchCreate = vi
      .fn()
      .mockImplementation(async () => ({ id: "m-1" }));
    mocked.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        proLeagueSeason: { create: seasonCreate },
        proLeagueRound: {
          create: vi.fn().mockResolvedValueOnce({ id: "round-1" }),
        },
        proLeagueMatch: { create: matchCreate },
        proLeagueStandings: { createMany: vi.fn() },
      }),
    );
    simMock.mockResolvedValue(true);
    mocked.proLeagueMatch.update.mockResolvedValue({});
    mocked.proLeagueRound.updateMany.mockResolvedValue({});
    mocked.proLeagueSeason.update.mockResolvedValue({});

    await createTestSeason();

    expect(seasonCreate.mock.calls[0][0].data.isTest).toBe(true);
    expect(matchCreate.mock.calls[0][0].data.isTest).toBe(true);
  });

  it("year picker : prend le premier slot libre", async () => {
    mocked.proLeague.findUnique.mockResolvedValueOnce({ id: "league-1" });
    // 9000 et 9001 occupes => 9002 libre
    mocked.proLeagueSeason.findMany.mockResolvedValueOnce([
      { year: 9000 },
      { year: 9001 },
    ]);
    mocked.proTeam.findMany.mockResolvedValueOnce([
      { id: "t1", slug: "team-1" },
      { id: "t2", slug: "team-2" },
    ]);
    const seasonCreate = vi.fn().mockResolvedValueOnce({ id: "season-new" });
    mocked.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        proLeagueSeason: { create: seasonCreate },
        proLeagueRound: {
          create: vi.fn().mockResolvedValueOnce({ id: "round-1" }),
        },
        proLeagueMatch: {
          create: vi.fn().mockResolvedValueOnce({ id: "m-1" }),
        },
        proLeagueStandings: { createMany: vi.fn() },
      }),
    );
    simMock.mockResolvedValue(true);
    mocked.proLeagueMatch.update.mockResolvedValue({});
    mocked.proLeagueRound.updateMany.mockResolvedValue({});
    mocked.proLeagueSeason.update.mockResolvedValue({});

    const result = await createTestSeason();

    expect(result.year).toBe(9002);
    expect(seasonCreate.mock.calls[0][0].data.year).toBe(9002);
  });

  it("teamSlugs filtre le sous-ensemble + valide la presence", async () => {
    mocked.proLeague.findUnique.mockResolvedValueOnce({ id: "league-1" });
    mocked.proTeam.findMany.mockResolvedValueOnce([
      { id: "t1", slug: "team-1" },
      { id: "t2", slug: "team-2" },
    ]);
    mocked.proLeagueSeason.findMany.mockResolvedValueOnce([]);
    const seasonCreate = vi.fn().mockResolvedValueOnce({ id: "s" });
    mocked.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        proLeagueSeason: { create: seasonCreate },
        proLeagueRound: {
          create: vi.fn().mockResolvedValueOnce({ id: "r" }),
        },
        proLeagueMatch: {
          create: vi.fn().mockResolvedValueOnce({ id: "m" }),
        },
        proLeagueStandings: { createMany: vi.fn() },
      }),
    );
    simMock.mockResolvedValue(true);
    mocked.proLeagueMatch.update.mockResolvedValue({});
    mocked.proLeagueRound.updateMany.mockResolvedValue({});
    mocked.proLeagueSeason.update.mockResolvedValue({});

    const result = await createTestSeason({
      teamSlugs: ["team-1", "team-2"],
    });

    expect(result.teamCount).toBe(2);
    // Verifie qu'on a bien filtre par slug, pas pris toutes les teams
    const findManyCall = mocked.proTeam.findMany.mock.calls[0][0];
    expect(findManyCall.where.slug).toEqual({ in: ["team-1", "team-2"] });
  });

  it("INVALID_INPUT si teamSlug manque en DB", async () => {
    mocked.proLeague.findUnique.mockResolvedValueOnce({ id: "league-1" });
    mocked.proTeam.findMany.mockResolvedValueOnce([
      { id: "t1", slug: "team-1" },
    ]);

    await expect(
      createTestSeason({ teamSlugs: ["team-1", "ghost-team"] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(mocked.$transaction).not.toHaveBeenCalled();
  });

  it("INVALID_INPUT si moins de 2 teamSlugs", async () => {
    mocked.proLeague.findUnique.mockResolvedValueOnce({ id: "league-1" });

    await expect(
      createTestSeason({ teamSlugs: ["only-one"] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("LEAGUE_NOT_FOUND si la ligue singleton n'existe pas", async () => {
    mocked.proLeague.findUnique.mockResolvedValueOnce(null);

    await expect(createTestSeason()).rejects.toMatchObject({
      code: "LEAGUE_NOT_FOUND",
    });
  });

  it("NO_TEAMS_AVAILABLE si moins de 2 teams en DB", async () => {
    mocked.proLeague.findUnique.mockResolvedValueOnce({ id: "league-1" });
    mocked.proTeam.findMany.mockResolvedValueOnce([
      { id: "t1", slug: "team-1" },
    ]);
    mocked.proLeagueSeason.findMany.mockResolvedValueOnce([]);

    await expect(createTestSeason()).rejects.toMatchObject({
      code: "NO_TEAMS_AVAILABLE",
    });
  });

  it("compte matchesFailed et ne promote pas la saison si echec", async () => {
    mocked.proLeague.findUnique.mockResolvedValueOnce({ id: "league-1" });
    mocked.proLeagueSeason.findMany.mockResolvedValueOnce([]);
    mocked.proTeam.findMany.mockResolvedValueOnce([
      { id: "t1", slug: "team-1" },
      { id: "t2", slug: "team-2" },
    ]);
    let matchCounter = 0;
    mocked.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        proLeagueSeason: {
          create: vi.fn().mockResolvedValueOnce({ id: "s" }),
        },
        proLeagueRound: {
          create: vi.fn().mockResolvedValueOnce({ id: "r" }),
        },
        proLeagueMatch: {
          create: vi.fn().mockImplementation(async () => {
            matchCounter += 1;
            return { id: `m-${matchCounter}` };
          }),
        },
        proLeagueStandings: { createMany: vi.fn() },
      }),
    );
    simMock.mockRejectedValueOnce(new Error("boom"));
    mocked.proLeagueMatch.update.mockResolvedValue({});

    const result = await createTestSeason();

    expect(result.matchesFailed).toBe(1);
    expect(result.matchesSimulated).toBe(0);
    // Pas de promotion en `completed` quand un match a fail
    expect(mocked.proLeagueRound.updateMany).not.toHaveBeenCalled();
    expect(mocked.proLeagueSeason.update).not.toHaveBeenCalled();
  });
});

describe("listTestSeasons", () => {
  it("aggregate simulatedCount + failedCount par saison", async () => {
    mocked.proLeagueSeason.findMany.mockResolvedValueOnce([
      {
        id: "s1",
        year: 9000,
        testLabel: "smoke-test",
        status: "completed",
        engineVer: "1.0.0",
        driverKind: "hybrid",
        createdAt: new Date("2026-05-13T00:00:00Z"),
        _count: { rounds: 15, matches: 120 },
      },
      {
        id: "s2",
        year: 9001,
        testLabel: null,
        status: "in_progress",
        engineVer: "1.0.0",
        driverKind: "full",
        createdAt: new Date("2026-05-12T00:00:00Z"),
        _count: { rounds: 3, matches: 6 },
      },
    ]);
    mocked.proLeagueMatch.groupBy.mockResolvedValueOnce([
      { seasonId: "s1", status: "completed", _count: { _all: 119 } },
      { seasonId: "s1", status: "failed", _count: { _all: 1 } },
      { seasonId: "s2", status: "ready", _count: { _all: 3 } },
      { seasonId: "s2", status: "scheduled", _count: { _all: 3 } },
    ]);

    const out = await listTestSeasons();

    expect(out).toHaveLength(2);
    const s1 = out.find((s) => s.id === "s1")!;
    expect(s1.simulatedCount).toBe(119);
    expect(s1.failedCount).toBe(1);
    expect(s1.label).toBe("smoke-test");
    const s2 = out.find((s) => s.id === "s2")!;
    expect(s2.simulatedCount).toBe(3);
    expect(s2.failedCount).toBe(0);

    // Filtre `isTest: true` toujours present
    const whereArg = mocked.proLeagueSeason.findMany.mock.calls[0][0].where;
    expect(whereArg.isTest).toBe(true);
  });

  it("liste vide quand aucune test season", async () => {
    mocked.proLeagueSeason.findMany.mockResolvedValueOnce([]);

    const out = await listTestSeasons();
    expect(out).toEqual([]);
    expect(mocked.proLeagueMatch.groupBy).not.toHaveBeenCalled();
  });
});

describe("deleteTestSeason", () => {
  it("delete replays + cascade season", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce({
      id: "s1",
      isTest: true,
    });
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([
      { id: "m1" },
      { id: "m2" },
      { id: "m3" },
    ]);
    mocked.proLeagueRound.count.mockResolvedValueOnce(2);
    mocked.proLeagueStandings.count.mockResolvedValueOnce(4);
    mocked.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        replay: {
          deleteMany: vi.fn().mockResolvedValueOnce({ count: 3 }),
        },
        proLeagueSeason: { delete: vi.fn().mockResolvedValueOnce({}) },
      }),
    );

    const result = await deleteTestSeason("s1");

    expect(result.deletedReplays).toBe(3);
    expect(result.deletedMatches).toBe(3);
    expect(result.deletedRounds).toBe(2);
    expect(result.deletedStandings).toBe(4);
  });

  it("SEASON_NOT_TEST refuse une saison prod (defense-in-depth)", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce({
      id: "s1",
      isTest: false,
    });

    await expect(deleteTestSeason("s1")).rejects.toMatchObject({
      code: "SEASON_NOT_TEST",
    });
    expect(mocked.$transaction).not.toHaveBeenCalled();
  });

  it("SEASON_NOT_FOUND si saison inexistante", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce(null);

    await expect(deleteTestSeason("ghost")).rejects.toMatchObject({
      code: "SEASON_NOT_FOUND",
    });
  });

  it("delete sans replay si aucun match", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce({
      id: "s1",
      isTest: true,
    });
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([]);
    mocked.proLeagueRound.count.mockResolvedValueOnce(0);
    mocked.proLeagueStandings.count.mockResolvedValueOnce(0);
    const replayDeleteMock = vi.fn();
    mocked.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        replay: { deleteMany: replayDeleteMock },
        proLeagueSeason: { delete: vi.fn().mockResolvedValueOnce({}) },
      }),
    );

    const result = await deleteTestSeason("s1");

    expect(result.deletedReplays).toBe(0);
    expect(replayDeleteMock).not.toHaveBeenCalled();
  });
});

describe("TestFactoryError", () => {
  it("expose code + heritage Error", () => {
    const e = new TestFactoryError("INVALID_INPUT", "test");
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("INVALID_INPUT");
    expect(e.name).toBe("TestFactoryError");
  });
});
