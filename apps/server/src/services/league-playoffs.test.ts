/**
 * L2.C.3 — Tests du service `league-playoffs.ts`.
 *
 * Couvre :
 *  - PURE : generatePlayoffSeedingFor (top 2/4/8 + erreurs)
 *  - PURE : nextSlotFor (qf->sf, sf->final, final->null)
 *  - PURE : firstRoundSlotsFor + winnerFromStatus
 *  - DB :
 *      - startPlayoffs : skips si playoffSize=0 / season missing /
 *        already started / insufficient-participants. Cree N rounds
 *        playoff sinon (1 round par slot).
 *      - advancePlayoffsAfterPairingComplete : winner forfeit_*,
 *        cas next-round-existant (update existing) vs
 *        next-round-absent (create new), final = no-next-round.
 *      - advancePlayoffsWithWinner : meme logique mais avec
 *        winnerSide explicite.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StandingRow } from "./league";

vi.mock("./league", () => ({
  computeSeasonStandings: vi.fn(),
  computeSeasonStandingsByPool: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    leagueParticipant: {
      findMany: vi.fn(),
    },
    leagueRound: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    leaguePairing: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { computeSeasonStandings, computeSeasonStandingsByPool } from "./league";
import { prisma } from "../prisma";
import {
  generatePlayoffSeedingFor,
  nextSlotFor,
  firstRoundSlotsFor,
  winnerFromStatus,
  selectSeedsFromPools,
  startPlayoffs,
  advancePlayoffsAfterPairingComplete,
  advancePlayoffsWithWinner,
  getPlayoffsPublishedState,
  isPlayoffBracketVisible,
  setPlayoffsPublished,
  playoffAdvancementState,
  unadvancePlayoffsForSlot,
  type PlayoffSize,
} from "./league-playoffs";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  standings: computeSeasonStandings as unknown as MockFn,
  poolStandings: computeSeasonStandingsByPool as unknown as MockFn,
  seasonFind: prisma.leagueSeason.findUnique as MockFn,
  roundFindFirst: prisma.leagueRound.findFirst as MockFn,
  roundCreate: prisma.leagueRound.create as MockFn,
  roundCount: prisma.leagueRound.count as MockFn,
  pairingFindFirst: prisma.leaguePairing.findFirst as MockFn,
  pairingCreate: prisma.leaguePairing.create as MockFn,
  pairingUpdate: prisma.leaguePairing.update as MockFn,
  pairingUpdateMany: prisma.leaguePairing.updateMany as MockFn,
  roundUpdateMany: prisma.leagueRound.updateMany as MockFn,
  roundDelete: prisma.leagueRound.delete as MockFn,
  auditCreate: (prisma as unknown as { auditLog: { create: MockFn } }).auditLog
    .create as MockFn,
  seasonUpdate: prisma.leagueSeason.update as MockFn,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Par defaut : aucune poule -> chemin legacy (classement global).
  (computeSeasonStandingsByPool as unknown as MockFn).mockResolvedValue([]);
});

function row(over: Partial<StandingRow>): StandingRow {
  return {
    participantId: "p",
    teamId: "t",
    teamName: "Team",
    roster: "skaven",
    ownerId: "u",
    coachName: "Coach",
    played: 3,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    touchdownsFor: 0,
    touchdownsAgainst: 0,
    touchdownDifference: 0,
    casualtiesFor: 0,
    casualtiesAgainst: 0,
    seasonElo: 1000,
    status: "active",
    ...over,
  };
}

describe("generatePlayoffSeedingFor (PURE)", () => {
  it("returns [] when size=0", () => {
    expect(generatePlayoffSeedingFor(0, ["a", "b"], 8)).toEqual([]);
  });

  it("rejects unsupported sizes (3, 6, 16, etc.)", () => {
    expect(() =>
      generatePlayoffSeedingFor(
        3 as unknown as PlayoffSize,
        ["a", "b", "c"],
        8,
      ),
    ).toThrow(/non supporte/);
  });

  it("rejects when seeds < size", () => {
    expect(() => generatePlayoffSeedingFor(4, ["a", "b", "c"], 8)).toThrow(
      /insuffisants/,
    );
  });

  it("size=2 produces a single 'final' pairing seed1 vs seed2", () => {
    const out = generatePlayoffSeedingFor(2, ["seed1", "seed2"], 8);
    expect(out).toHaveLength(1);
    expect(out[0].slot).toBe("final");
    expect(out[0].roundNumber).toBe(8);
    expect(out[0].homeParticipantId).toBe("seed1");
    expect(out[0].awayParticipantId).toBe("seed2");
  });

  it("size=4 produces 2 SF pairings using cross-bracket seeding (1v4, 2v3)", () => {
    const out = generatePlayoffSeedingFor(4, ["s1", "s2", "s3", "s4"], 10);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      slot: "sf1",
      roundNumber: 10,
      homeParticipantId: "s1",
      awayParticipantId: "s4",
    });
    expect(out[1]).toMatchObject({
      slot: "sf2",
      roundNumber: 10,
      homeParticipantId: "s2",
      awayParticipantId: "s3",
    });
  });

  it("size=8 produces 4 QF pairings using standard seeding (1v8, 4v5, 2v7, 3v6)", () => {
    const out = generatePlayoffSeedingFor(
      8,
      ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"],
      14,
    );
    expect(out).toHaveLength(4);
    expect(out.map((p) => p.slot)).toEqual(["qf1", "qf2", "qf3", "qf4"]);
    expect(out[0]).toMatchObject({
      homeParticipantId: "s1",
      awayParticipantId: "s8",
    });
    expect(out[1]).toMatchObject({
      homeParticipantId: "s4",
      awayParticipantId: "s5",
    });
    expect(out[2]).toMatchObject({
      homeParticipantId: "s2",
      awayParticipantId: "s7",
    });
    expect(out[3]).toMatchObject({
      homeParticipantId: "s3",
      awayParticipantId: "s6",
    });
  });

  it("size=8 ignores extra seeds beyond the top 8", () => {
    const out = generatePlayoffSeedingFor(
      8,
      [
        "s1",
        "s2",
        "s3",
        "s4",
        "s5",
        "s6",
        "s7",
        "s8",
        "s9",
        "s10",
        "s11", // ignored
      ],
      1,
    );
    expect(out).toHaveLength(4);
  });
});

describe("nextSlotFor (PURE)", () => {
  it("maps qf1/qf2 -> sf1 (home/away)", () => {
    expect(nextSlotFor("qf1")).toEqual({ nextSlot: "sf1", side: "home" });
    expect(nextSlotFor("qf2")).toEqual({ nextSlot: "sf1", side: "away" });
  });

  it("maps qf3/qf4 -> sf2 (home/away)", () => {
    expect(nextSlotFor("qf3")).toEqual({ nextSlot: "sf2", side: "home" });
    expect(nextSlotFor("qf4")).toEqual({ nextSlot: "sf2", side: "away" });
  });

  it("maps sf1/sf2 -> final (home/away)", () => {
    expect(nextSlotFor("sf1")).toEqual({ nextSlot: "final", side: "home" });
    expect(nextSlotFor("sf2")).toEqual({ nextSlot: "final", side: "away" });
  });

  it("returns null for 'final' (terminal)", () => {
    expect(nextSlotFor("final")).toBeNull();
  });

  it("returns null for unknown slots", () => {
    expect(nextSlotFor("foo")).toBeNull();
  });
});

describe("firstRoundSlotsFor (PURE)", () => {
  it("returns the right slots per size", () => {
    expect(firstRoundSlotsFor(0)).toEqual([]);
    expect(firstRoundSlotsFor(2)).toEqual(["final"]);
    expect(firstRoundSlotsFor(4)).toEqual(["sf1", "sf2"]);
    expect(firstRoundSlotsFor(8)).toEqual(["qf1", "qf2", "qf3", "qf4"]);
  });
});

describe("selectSeedsFromPools (PURE)", () => {
  function pool(
    poolId: string,
    poolOrder: number,
    qualifiesForPlayoffs: number,
    ranked: string[],
  ) {
    return { poolId, poolOrder, qualifiesForPlayoffs, ranked };
  }

  it("2 poules x 2 qualifies (size 4) : ordre serpentin A1,B1,A2,B2", () => {
    const out = selectSeedsFromPools(
      [
        pool("A", 0, 2, ["a1", "a2", "a3"]),
        pool("B", 1, 2, ["b1", "b2", "b3"]),
      ],
      4,
    );
    expect(out).toEqual({ ok: true, seeds: ["a1", "b1", "a2", "b2"] });
  });

  it("2 poules x 2 : aucun duel intra-poule en demi-finale", () => {
    const out = selectSeedsFromPools(
      [pool("A", 0, 2, ["a1", "a2"]), pool("B", 1, 2, ["b1", "b2"])],
      4,
    );
    if (!out.ok) throw new Error("expected ok");
    const pairings = generatePlayoffSeedingFor(4, out.seeds, 1);
    // sf1 = 1v4 (a1 vs b2), sf2 = 2v3 (b1 vs a2).
    for (const p of pairings) {
      expect(p.homeParticipantId[0]).not.toBe(p.awayParticipantId[0]);
    }
  });

  it("4 poules x 2 (size 8) : aucun duel intra-poule en quart", () => {
    const out = selectSeedsFromPools(
      [
        pool("A", 0, 2, ["a1", "a2"]),
        pool("B", 1, 2, ["b1", "b2"]),
        pool("C", 2, 2, ["c1", "c2"]),
        pool("D", 3, 2, ["d1", "d2"]),
      ],
      8,
    );
    if (!out.ok) throw new Error("expected ok");
    expect(out.seeds).toEqual(["a1", "b1", "c1", "d1", "a2", "b2", "c2", "d2"]);
    for (const p of generatePlayoffSeedingFor(8, out.seeds, 1)) {
      expect(p.homeParticipantId[0]).not.toBe(p.awayParticipantId[0]);
    }
  });

  it("2 poules x 4 (size 8) : aucun duel intra-poule en quart", () => {
    const out = selectSeedsFromPools(
      [
        pool("A", 0, 4, ["a1", "a2", "a3", "a4"]),
        pool("B", 1, 4, ["b1", "b2", "b3", "b4"]),
      ],
      8,
    );
    if (!out.ok) throw new Error("expected ok");
    expect(out.seeds).toEqual(["a1", "b1", "a2", "b2", "a3", "b3", "a4", "b4"]);
    for (const p of generatePlayoffSeedingFor(8, out.seeds, 1)) {
      expect(p.homeParticipantId[0]).not.toBe(p.awayParticipantId[0]);
    }
  });

  it("quotas asymetriques : seeds produits, duel intra-poule tolere", () => {
    const out = selectSeedsFromPools(
      [pool("A", 0, 3, ["a1", "a2", "a3"]), pool("B", 1, 1, ["b1"])],
      4,
    );
    expect(out).toEqual({ ok: true, seeds: ["a1", "b1", "a2", "a3"] });
  });

  it("respecte pool.order et non l'ordre du tableau", () => {
    const out = selectSeedsFromPools(
      [pool("B", 1, 1, ["b1"]), pool("A", 0, 1, ["a1"])],
      2,
    );
    expect(out).toEqual({ ok: true, seeds: ["a1", "b1"] });
  });

  it("refuse quand la somme des quotas != taille du bracket", () => {
    const out = selectSeedsFromPools(
      [
        pool("A", 0, 3, ["a1", "a2", "a3"]),
        pool("B", 1, 3, ["b1", "b2", "b3"]),
      ],
      4,
    );
    expect(out).toEqual({ ok: false, reason: "pool-qualification-mismatch" });
  });

  it("refuse quand une poule est plus petite que son quota", () => {
    const out = selectSeedsFromPools(
      [pool("A", 0, 2, ["a1", "a2"]), pool("B", 1, 2, ["b1"])],
      4,
    );
    expect(out).toEqual({ ok: false, reason: "insufficient-participants" });
  });

  it("ignore les poules a quota 0 (dont la pseudo-poule non affectee)", () => {
    const out = selectSeedsFromPools(
      [
        pool("A", 0, 1, ["a1", "a2"]),
        pool("B", 1, 1, ["b1", "b2"]),
        pool("__unassigned__", 2, 0, ["x1", "x2"]),
      ],
      2,
    );
    expect(out).toEqual({ ok: true, seeds: ["a1", "b1"] });
  });
});

describe("winnerFromStatus (PURE)", () => {
  it("returns away for forfeit_home", () => {
    expect(
      winnerFromStatus({
        status: "forfeit_home",
        homeParticipantId: "h",
        awayParticipantId: "a",
      }),
    ).toBe("a");
  });

  it("returns home for forfeit_away", () => {
    expect(
      winnerFromStatus({
        status: "forfeit_away",
        homeParticipantId: "h",
        awayParticipantId: "a",
      }),
    ).toBe("h");
  });

  it("returns null for played (score not in the pairing row)", () => {
    expect(
      winnerFromStatus({
        status: "played",
        homeParticipantId: "h",
        awayParticipantId: "a",
      }),
    ).toBeNull();
  });

  it("returns null for scheduled / in_progress / cancelled", () => {
    for (const status of ["scheduled", "in_progress", "cancelled"]) {
      expect(
        winnerFromStatus({
          status,
          homeParticipantId: "h",
          awayParticipantId: "a",
        }),
      ).toBeNull();
    }
  });
});

describe("startPlayoffs", () => {
  it("returns season-missing when season does not exist", async () => {
    mocked.seasonFind.mockResolvedValue(null);
    const out = await startPlayoffs("missing");
    expect(out).toEqual({
      created: false,
      roundsCreated: 0,
      pairingsCreated: 0,
      skippedReason: "season-missing",
    });
  });

  it("returns playoffs-disabled when playoffSize=0", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "completed",
      playoffSize: 0,
    });
    const out = await startPlayoffs("s1");
    expect(out.skippedReason).toBe("playoffs-disabled");
  });

  it("returns playoffs-already-started when at least one playoff round exists", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "completed",
      playoffSize: 4,
    });
    mocked.roundCount.mockResolvedValue(2);
    const out = await startPlayoffs("s1");
    expect(out.skippedReason).toBe("playoffs-already-started");
  });

  it("returns insufficient-participants when eligible < playoffSize", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "completed",
      playoffSize: 4,
    });
    mocked.roundCount.mockResolvedValue(0);
    mocked.standings.mockResolvedValue([
      row({ participantId: "p1" }),
      row({ participantId: "p2" }),
    ]);
    const out = await startPlayoffs("s1");
    expect(out.skippedReason).toBe("insufficient-participants");
  });

  it("creates 4 rounds + 4 pairings for top 4 (SF + final NOT yet — only first round)", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "completed",
      playoffSize: 4,
    });
    mocked.roundCount.mockResolvedValue(0);
    mocked.standings.mockResolvedValue([
      row({ participantId: "p1" }),
      row({ participantId: "p2" }),
      row({ participantId: "p3" }),
      row({ participantId: "p4" }),
    ]);
    mocked.roundFindFirst.mockResolvedValue({ roundNumber: 7 });
    let id = 0;
    mocked.roundCreate.mockImplementation(async () => ({
      id: `r${++id}`,
    }));
    mocked.pairingCreate.mockResolvedValue({});

    const out = await startPlayoffs("s1");
    expect(out.created).toBe(true);
    // size=4 -> 2 SF rounds (size > 2 first round = SFs only).
    expect(out.roundsCreated).toBe(2);
    expect(out.pairingsCreated).toBe(2);
    expect(mocked.roundCreate).toHaveBeenCalledTimes(2);
    // First round createMany call : sf1 with 1v4
    const sf1Args = mocked.roundCreate.mock.calls[0][0];
    expect(sf1Args.data.kind).toBe("playoff");
    expect(sf1Args.data.bracketSlot).toBe("sf1");
    expect(sf1Args.data.roundNumber).toBe(8); // base = 7 + 1
    const sf2Args = mocked.roundCreate.mock.calls[1][0];
    expect(sf2Args.data.bracketSlot).toBe("sf2");
    expect(sf2Args.data.roundNumber).toBe(9);
  });

  it("excludes withdrawn participants from the seed list", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "completed",
      playoffSize: 2,
    });
    mocked.roundCount.mockResolvedValue(0);
    mocked.standings.mockResolvedValue([
      row({ participantId: "p1", status: "withdrawn" }),
      row({ participantId: "p2" }),
      row({ participantId: "p3" }),
    ]);
    mocked.roundFindFirst.mockResolvedValue({ roundNumber: 1 });
    mocked.roundCreate.mockResolvedValue({ id: "r1" });
    mocked.pairingCreate.mockResolvedValue({});

    await startPlayoffs("s1");
    // p1 is excluded; final should be p2 vs p3.
    const pairingArgs = mocked.pairingCreate.mock.calls[0][0];
    expect(pairingArgs.data.homeParticipantId).toBe("p2");
    expect(pairingArgs.data.awayParticipantId).toBe("p3");
  });
});

describe("startPlayoffs — seeding par poule", () => {
  function poolStanding(
    poolId: string,
    poolOrder: number,
    qualifiesForPlayoffs: number,
    participantIds: string[],
    statuses: string[] = [],
  ) {
    return {
      poolId,
      poolName: poolId,
      poolOrder,
      qualifiesForPlayoffs,
      standings: participantIds.map((participantId, i) =>
        row({ participantId, status: (statuses[i] ?? "active") as "active" }),
      ),
    };
  }

  function seasonReady(playoffSize: number) {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "in_progress",
      playoffSize,
    });
    mocked.roundCount.mockResolvedValue(0);
    mocked.roundFindFirst.mockResolvedValue({ roundNumber: 5 });
    mocked.roundCreate.mockResolvedValue({ id: "r1" });
    mocked.pairingCreate.mockResolvedValue({});
  }

  it("seede depuis les quotas de poule au lieu du classement global", async () => {
    seasonReady(4);
    mocked.poolStandings.mockResolvedValue([
      poolStanding("A", 0, 2, ["a1", "a2", "a3"]),
      poolStanding("B", 1, 2, ["b1", "b2", "b3"]),
    ]);

    const out = await startPlayoffs("s1");
    expect(out.created).toBe(true);
    // Le classement global ne doit pas etre consulte sur ce chemin.
    expect(mocked.standings).not.toHaveBeenCalled();
    // Serpentin a1,b1,a2,b2 -> sf1 = 1v4 (a1 vs b2), sf2 = 2v3 (b1 vs a2).
    expect(mocked.pairingCreate.mock.calls[0][0].data).toMatchObject({
      homeParticipantId: "a1",
      awayParticipantId: "b2",
    });
    expect(mocked.pairingCreate.mock.calls[1][0].data).toMatchObject({
      homeParticipantId: "b1",
      awayParticipantId: "a2",
    });
  });

  it("exclut les withdrawn du classement de poule", async () => {
    seasonReady(2);
    mocked.poolStandings.mockResolvedValue([
      poolStanding("A", 0, 1, ["a1", "a2"], ["withdrawn", "active"]),
      poolStanding("B", 1, 1, ["b1"]),
    ]);

    await startPlayoffs("s1");
    expect(mocked.pairingCreate.mock.calls[0][0].data).toMatchObject({
      homeParticipantId: "a2",
      awayParticipantId: "b1",
    });
  });

  it("refuse quand la somme des quotas != playoffSize", async () => {
    seasonReady(4);
    mocked.poolStandings.mockResolvedValue([
      poolStanding("A", 0, 3, ["a1", "a2", "a3"]),
      poolStanding("B", 1, 3, ["b1", "b2", "b3"]),
    ]);

    const out = await startPlayoffs("s1");
    expect(out.skippedReason).toBe("pool-qualification-mismatch");
    expect(mocked.roundCreate).not.toHaveBeenCalled();
  });

  it("refuse quand une poule est plus petite que son quota", async () => {
    seasonReady(4);
    mocked.poolStandings.mockResolvedValue([
      poolStanding("A", 0, 2, ["a1", "a2"]),
      poolStanding("B", 1, 2, ["b1"]),
    ]);

    const out = await startPlayoffs("s1");
    expect(out.skippedReason).toBe("insufficient-participants");
    expect(mocked.roundCreate).not.toHaveBeenCalled();
  });

  it("retombe sur le classement global quand toutes les poules qualifient 0", async () => {
    seasonReady(2);
    mocked.poolStandings.mockResolvedValue([
      poolStanding("A", 0, 0, ["a1", "a2"]),
      poolStanding("B", 1, 0, ["b1", "b2"]),
    ]);
    mocked.standings.mockResolvedValue([
      row({ participantId: "g1" }),
      row({ participantId: "g2" }),
    ]);

    const out = await startPlayoffs("s1");
    expect(out.created).toBe(true);
    expect(mocked.pairingCreate.mock.calls[0][0].data).toMatchObject({
      homeParticipantId: "g1",
      awayParticipantId: "g2",
    });
  });
});

describe("startPlayoffs — garde de fin de phase reguliere", () => {
  function seasonWithIncompleteRounds(incomplete: number) {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "in_progress",
      playoffSize: 2,
    });
    // 1er appel : rounds playoff existants. 2e : rounds reguliers non completes.
    mocked.roundCount.mockImplementation(async (args: unknown) => {
      const where = (args as { where: { kind?: unknown } }).where;
      return where.kind === "playoff" ? 0 : incomplete;
    });
    mocked.roundFindFirst.mockResolvedValue({ roundNumber: 5 });
    mocked.roundCreate.mockResolvedValue({ id: "r1" });
    mocked.pairingCreate.mockResolvedValue({});
    mocked.standings.mockResolvedValue([
      row({ participantId: "p1" }),
      row({ participantId: "p2" }),
    ]);
  }

  it("refuse quand un round regulier n'est pas completed", async () => {
    seasonWithIncompleteRounds(2);
    const out = await startPlayoffs("s1");
    expect(out.skippedReason).toBe("regular-season-incomplete");
    expect(mocked.roundCreate).not.toHaveBeenCalled();
    expect(mocked.pairingUpdateMany).not.toHaveBeenCalled();
  });

  it("genere le bracket quand tous les rounds reguliers sont completed", async () => {
    seasonWithIncompleteRounds(0);
    const out = await startPlayoffs("s1");
    expect(out.created).toBe(true);
    expect(mocked.pairingUpdateMany).not.toHaveBeenCalled();
  });

  it("force: cloture la phase reguliere puis genere le bracket", async () => {
    seasonWithIncompleteRounds(2);
    mocked.pairingUpdateMany.mockResolvedValue({ count: 3 });
    mocked.roundUpdateMany.mockResolvedValue({ count: 2 });

    const out = await startPlayoffs("s1", { force: true, byUserId: "u1" });
    expect(out.created).toBe(true);
    expect(out.cancelledPairings).toBe(3);
    expect(mocked.pairingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "cancelled" } }),
    );
    expect(mocked.roundUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "completed" } }),
    );
    expect(mocked.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "league.playoff:force-start",
          entityId: "s1",
        }),
      }),
    );
  });

  it("force: n'annule rien si une autre garde refuse (config incoherente)", async () => {
    seasonWithIncompleteRounds(2);
    mocked.poolStandings.mockResolvedValue([
      {
        poolId: "A",
        poolName: "A",
        poolOrder: 0,
        qualifiesForPlayoffs: 4,
        standings: [
          row({ participantId: "a1" }),
          row({ participantId: "a2" }),
          row({ participantId: "a3" }),
          row({ participantId: "a4" }),
        ],
      },
    ]);

    const out = await startPlayoffs("s1", { force: true, byUserId: "u1" });
    expect(out.skippedReason).toBe("pool-qualification-mismatch");
    expect(mocked.pairingUpdateMany).not.toHaveBeenCalled();
    expect(mocked.roundUpdateMany).not.toHaveBeenCalled();
    expect(mocked.roundCreate).not.toHaveBeenCalled();
  });

  it("force ne contourne pas playoffs-already-started", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "in_progress",
      playoffSize: 2,
    });
    mocked.roundCount.mockResolvedValue(2);
    const out = await startPlayoffs("s1", { force: true });
    expect(out.skippedReason).toBe("playoffs-already-started");
    expect(mocked.pairingUpdateMany).not.toHaveBeenCalled();
  });
});

describe("advancePlayoffsAfterPairingComplete (forfeit path)", () => {
  it("returns not-a-playoff-pairing for regular rounds", async () => {
    mocked.pairingFindFirst.mockResolvedValue({
      id: "p1",
      status: "played",
      homeParticipantId: "h",
      awayParticipantId: "a",
      round: {
        id: "r1",
        seasonId: "s1",
        roundNumber: 1,
        kind: "regular",
        bracketSlot: null,
      },
    });
    const out = await advancePlayoffsAfterPairingComplete("p1");
    expect(out).toEqual({
      advanced: false,
      reason: "not-a-playoff-pairing",
    });
  });

  it("returns no-next-round when slot is 'final'", async () => {
    mocked.pairingFindFirst.mockResolvedValue({
      id: "p1",
      status: "forfeit_home",
      homeParticipantId: "h",
      awayParticipantId: "a",
      round: {
        id: "r1",
        seasonId: "s1",
        roundNumber: 10,
        kind: "playoff",
        bracketSlot: "final",
      },
    });
    const out = await advancePlayoffsAfterPairingComplete("p1");
    expect(out).toEqual({ advanced: false, reason: "no-next-round" });
  });

  it("returns winner-undetermined when status=played (score not in pairing)", async () => {
    mocked.pairingFindFirst.mockResolvedValue({
      id: "p1",
      status: "played",
      homeParticipantId: "h",
      awayParticipantId: "a",
      round: {
        id: "r1",
        seasonId: "s1",
        roundNumber: 8,
        kind: "playoff",
        bracketSlot: "qf1",
      },
    });
    const out = await advancePlayoffsAfterPairingComplete("p1");
    expect(out).toEqual({
      advanced: false,
      reason: "winner-undetermined",
    });
  });

  it("creates next round + pairing when sf does not exist (qf1 forfeit_home -> sf1 home)", async () => {
    mocked.pairingFindFirst.mockResolvedValueOnce({
      id: "qf1-pairing",
      status: "forfeit_home",
      homeParticipantId: "seed1",
      awayParticipantId: "seed8",
      round: {
        id: "r-qf1",
        seasonId: "s1",
        roundNumber: 8,
        kind: "playoff",
        bracketSlot: "qf1",
      },
    });
    mocked.roundFindFirst.mockResolvedValueOnce(null); // no sf1 yet
    mocked.roundCreate.mockResolvedValue({ id: "r-sf1" });
    mocked.pairingCreate.mockResolvedValue({});

    const out = await advancePlayoffsAfterPairingComplete("qf1-pairing");
    expect(out).toEqual({ advanced: true, nextSlot: "sf1" });
    const newRoundArgs = mocked.roundCreate.mock.calls[0][0];
    expect(newRoundArgs.data.bracketSlot).toBe("sf1");
    expect(newRoundArgs.data.kind).toBe("playoff");
    const newPairingArgs = mocked.pairingCreate.mock.calls[0][0];
    // Winner of qf1 is seed8 (forfeit_home), placed as home in sf1
    expect(newPairingArgs.data.homeParticipantId).toBe("seed8");
  });

  // A158 — `pairing.round.roundNumber + 1` visait le numero DEJA pris par le
  // round frere du meme tour de bracket (`startPlayoffs` cree un round par
  // slot : demi 1 = N, demi 2 = N+1). La creation echouait sur la contrainte
  // unique (seasonId, roundNumber) et le tour suivant n'existait jamais.
  it("numerote le tour suivant apres le DERNIER round de la saison", async () => {
    mocked.pairingFindFirst.mockResolvedValueOnce({
      id: "sf1-pairing",
      status: "forfeit_home",
      homeParticipantId: "seed1",
      awayParticipantId: "seed4",
      round: {
        id: "r-sf1",
        seasonId: "s1",
        // Demi-finale 1 : le round frere (sf2) porte deja le numero 13.
        roundNumber: 12,
        kind: "playoff",
        bracketSlot: "sf1",
      },
    });
    mocked.roundFindFirst
      // Pas encore de round "final"...
      .mockResolvedValueOnce(null)
      // ...et le dernier round de la saison est sf2 (13).
      .mockResolvedValueOnce({ roundNumber: 13 });
    mocked.roundCreate.mockResolvedValue({ id: "r-final" });
    mocked.pairingCreate.mockResolvedValue({});

    const out = await advancePlayoffsAfterPairingComplete("sf1-pairing");

    expect(out).toEqual({ advanced: true, nextSlot: "final" });
    const newRoundArgs = mocked.roundCreate.mock.calls[0][0];
    // 14, et surtout PAS 13 (numero du round frere).
    expect(newRoundArgs.data.roundNumber).toBe(14);
    expect(newRoundArgs.data.bracketSlot).toBe("final");
  });

  it("updates existing next-round pairing when sf already exists (qf2 forfeit_away -> sf1 away)", async () => {
    mocked.pairingFindFirst
      // First call: load qf2 pairing.
      .mockResolvedValueOnce({
        id: "qf2-pairing",
        status: "forfeit_away",
        homeParticipantId: "seed4",
        awayParticipantId: "seed5",
        round: {
          id: "r-qf2",
          seasonId: "s1",
          roundNumber: 9,
          kind: "playoff",
          bracketSlot: "qf2",
        },
      })
      // Second call: load existing sf1 pairing.
      .mockResolvedValueOnce({
        id: "sf1-pairing",
        homeParticipantId: "seed1",
        awayParticipantId: "PLACEHOLDER",
      });
    mocked.roundFindFirst.mockResolvedValueOnce({ id: "r-sf1" });
    mocked.pairingUpdate.mockResolvedValue({});

    const out = await advancePlayoffsAfterPairingComplete("qf2-pairing");
    expect(out).toEqual({ advanced: true, nextSlot: "sf1" });
    expect(mocked.roundCreate).not.toHaveBeenCalled(); // existing sf1 reused
    const updateArgs = mocked.pairingUpdate.mock.calls[0][0];
    expect(updateArgs.where.id).toBe("sf1-pairing");
    // Winner of qf2 is seed4 (forfeit_away), placed as away in sf1.
    expect(updateArgs.data.awayParticipantId).toBe("seed4");
  });
});

describe("advancePlayoffsWithWinner (explicit winner side)", () => {
  it("uses winnerSide=home to pick homeParticipantId", async () => {
    mocked.pairingFindFirst.mockResolvedValueOnce({
      id: "p-sf1",
      status: "played",
      homeParticipantId: "winner-home",
      awayParticipantId: "loser-away",
      round: {
        id: "r-sf1",
        seasonId: "s1",
        roundNumber: 10,
        kind: "playoff",
        bracketSlot: "sf1",
      },
    });
    mocked.roundFindFirst.mockResolvedValueOnce(null);
    mocked.roundCreate.mockResolvedValue({ id: "r-final" });
    mocked.pairingCreate.mockResolvedValue({});

    const out = await advancePlayoffsWithWinner("p-sf1", "home");
    expect(out).toEqual({ advanced: true, nextSlot: "final" });
    const pairingArgs = mocked.pairingCreate.mock.calls[0][0];
    expect(pairingArgs.data.homeParticipantId).toBe("winner-home");
  });

  it("uses winnerSide=away to pick awayParticipantId", async () => {
    mocked.pairingFindFirst.mockResolvedValueOnce({
      id: "p-sf2",
      status: "played",
      homeParticipantId: "loser-home",
      awayParticipantId: "winner-away",
      round: {
        id: "r-sf2",
        seasonId: "s1",
        roundNumber: 11,
        kind: "playoff",
        bracketSlot: "sf2",
      },
    });
    // Final round already exists (sf1 advanced first).
    mocked.roundFindFirst.mockResolvedValueOnce({ id: "r-final" });
    mocked.pairingFindFirst.mockResolvedValueOnce({
      id: "final-pairing",
      homeParticipantId: "winner-of-sf1",
      awayParticipantId: "PLACEHOLDER",
    });
    mocked.pairingUpdate.mockResolvedValue({});

    const out = await advancePlayoffsWithWinner("p-sf2", "away");
    expect(out).toEqual({ advanced: true, nextSlot: "final" });
    const updateArgs = mocked.pairingUpdate.mock.calls[0][0];
    expect(updateArgs.data.awayParticipantId).toBe("winner-away");
  });
});

describe("publication du bracket de playoffs", () => {
  it("startPlayoffs marque le bracket neuf comme NON publie", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "in_progress",
      playoffSize: 2,
    });
    mocked.roundCount.mockResolvedValue(0);
    mocked.standings.mockResolvedValue([
      row({ participantId: "p1" }),
      row({ participantId: "p2" }),
    ]);
    mocked.roundFindFirst.mockResolvedValue({ roundNumber: 5 });
    mocked.roundCreate.mockResolvedValue({ id: "r1" });
    mocked.pairingCreate.mockResolvedValue({ id: "pp1" });

    const out = await startPlayoffs("s1");
    expect(out).toMatchObject({ created: true });
    // C'est ce `false` explicite qui distingue un bracket neuf d'une saison
    // anterieure a la publication differee (null, restee visible).
    expect(mocked.seasonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { playoffsPublished: false } }),
    );
  });

  it("isPlayoffBracketVisible : seul un false explicite masque le bracket", () => {
    // null = saison anterieure a la publication differee. Le schema est
    // applique par `db push` (pas de backfill possible) : son bracket est
    // deja consulte par la ligue et doit le rester.
    expect(isPlayoffBracketVisible(null)).toBe(true);
    expect(isPlayoffBracketVisible(undefined)).toBe(true);
    expect(isPlayoffBracketVisible(true)).toBe(true);
    expect(isPlayoffBracketVisible(false)).toBe(false);
  });

  it("getPlayoffsPublishedState remonte le tri-etat", async () => {
    mocked.seasonFind.mockResolvedValueOnce({ playoffsPublished: null });
    expect(await getPlayoffsPublishedState("s1")).toBeNull();
    mocked.seasonFind.mockResolvedValueOnce({ playoffsPublished: false });
    expect(await getPlayoffsPublishedState("s1")).toBe(false);
    mocked.seasonFind.mockResolvedValueOnce({ playoffsPublished: true });
    expect(await getPlayoffsPublishedState("s1")).toBe(true);
    mocked.seasonFind.mockResolvedValueOnce(null);
    expect(await getPlayoffsPublishedState("nope")).toBeNull();
  });

  it("publie quand un bracket existe", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1" });
    mocked.roundCount.mockResolvedValue(3);
    const out = await setPlayoffsPublished("s1", true);
    expect(out).toEqual({ ok: true, published: true });
    expect(mocked.seasonUpdate.mock.calls[0][0].data).toEqual({
      playoffsPublished: true,
    });
  });

  it("refuse de publier sans bracket genere", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1" });
    mocked.roundCount.mockResolvedValue(0);
    const out = await setPlayoffsPublished("s1", true);
    expect(out).toEqual({ ok: false, reason: "no-bracket" });
    expect(mocked.seasonUpdate).not.toHaveBeenCalled();
  });

  it("depublie sans exiger de bracket (retour arriere)", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1" });
    const out = await setPlayoffsPublished("s1", false);
    expect(out).toEqual({ ok: true, published: false });
    expect(mocked.roundCount).not.toHaveBeenCalled();
    expect(mocked.seasonUpdate.mock.calls[0][0].data).toEqual({
      playoffsPublished: false,
    });
  });

  it("saison inconnue : refus explicite", async () => {
    mocked.seasonFind.mockResolvedValue(null);
    expect(await setPlayoffsPublished("nope", true)).toEqual({
      ok: false,
      reason: "season-missing",
    });
  });
});

/**
 * Invalidation d'un match de playoff : miroir de l'avancement du bracket.
 * Le refus « playoffs-generated » rendait toute erreur de saisie en
 * playoff definitive — on la defait desormais, tant que le tour suivant
 * n'a pas demarre.
 */
describe("playoffAdvancementState / unadvancePlayoffsForSlot", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("la finale n'alimente aucun tour : rien a defaire", async () => {
    expect(await playoffAdvancementState("s1", "final")).toBe("none");
    expect(mocked.roundFindFirst).not.toHaveBeenCalled();
  });

  it("tour suivant non genere : rien a defaire", async () => {
    mocked.roundFindFirst.mockResolvedValue(null);
    expect(await playoffAdvancementState("s1", "sf1")).toBe("none");
  });

  it("tour suivant genere mais pas joue : desavancement possible", async () => {
    mocked.roundFindFirst.mockResolvedValue({ id: "r-final" });
    mocked.pairingFindFirst.mockResolvedValue({
      id: "p-final",
      homeParticipantId: "A",
      awayParticipantId: "A",
      status: "scheduled",
      match: null,
    });
    expect(await playoffAdvancementState("s1", "sf1")).toBe("pending");
  });

  it("tour suivant deja lance (match cree) : refus", async () => {
    mocked.roundFindFirst.mockResolvedValue({ id: "r-final" });
    mocked.pairingFindFirst.mockResolvedValue({
      id: "p-final",
      homeParticipantId: "A",
      awayParticipantId: "B",
      status: "scheduled",
      match: { id: "m-final" },
    });
    expect(await playoffAdvancementState("s1", "sf1")).toBe("started");
  });

  it("tour suivant deja joue : refus", async () => {
    mocked.roundFindFirst.mockResolvedValue({ id: "r-final" });
    mocked.pairingFindFirst.mockResolvedValue({
      id: "p-final",
      homeParticipantId: "A",
      awayParticipantId: "B",
      status: "played",
      match: null,
    });
    expect(await playoffAdvancementState("s1", "sf1")).toBe("started");
  });

  it("supprime le tour suivant quand ce resultat l'avait cree seul", async () => {
    // Convention placeholder de l'avancement : home === away tant que le
    // sibling n'a pas termine.
    mocked.roundFindFirst.mockResolvedValue({ id: "r-final" });
    mocked.pairingFindFirst.mockResolvedValue({
      id: "p-final",
      homeParticipantId: "A",
      awayParticipantId: "A",
      status: "scheduled",
      match: null,
    });

    const out = await unadvancePlayoffsForSlot({
      seasonId: "s1",
      slot: "sf1",
      winnerParticipantId: "A",
    });

    expect(out).toEqual({ unadvanced: true });
    expect(mocked.roundDelete).toHaveBeenCalledWith({
      where: { id: "r-final" },
    });
    expect(mocked.pairingUpdate).not.toHaveBeenCalled();
  });

  it("remet le cote concerne en placeholder quand l'autre demi est deja la", async () => {
    mocked.roundFindFirst.mockResolvedValue({ id: "r-final" });
    mocked.pairingFindFirst.mockResolvedValue({
      id: "p-final",
      homeParticipantId: "A", // issu de sf1
      awayParticipantId: "B", // issu de sf2
      status: "scheduled",
      match: null,
    });

    const out = await unadvancePlayoffsForSlot({
      seasonId: "s1",
      slot: "sf1",
      winnerParticipantId: "A",
    });

    expect(out).toEqual({ unadvanced: true });
    expect(mocked.roundDelete).not.toHaveBeenCalled();
    expect(mocked.pairingUpdate).toHaveBeenCalledWith({
      where: { id: "p-final" },
      data: { homeParticipantId: "B" },
    });
  });

  it("ne touche a rien si le cote a ete reecrit par une autre source", async () => {
    mocked.roundFindFirst.mockResolvedValue({ id: "r-final" });
    mocked.pairingFindFirst.mockResolvedValue({
      id: "p-final",
      homeParticipantId: "C", // plus le qualifie de ce match
      awayParticipantId: "B",
      status: "scheduled",
      match: null,
    });

    const out = await unadvancePlayoffsForSlot({
      seasonId: "s1",
      slot: "sf1",
      winnerParticipantId: "A",
    });

    expect(out).toEqual({
      unadvanced: false,
      reason: "advancement-superseded",
    });
    expect(mocked.pairingUpdate).not.toHaveBeenCalled();
    expect(mocked.roundDelete).not.toHaveBeenCalled();
  });

  it("refuse de defaire un tour suivant deja lance", async () => {
    mocked.roundFindFirst.mockResolvedValue({ id: "r-final" });
    mocked.pairingFindFirst.mockResolvedValue({
      id: "p-final",
      homeParticipantId: "A",
      awayParticipantId: "B",
      status: "played",
      match: null,
    });

    expect(
      await unadvancePlayoffsForSlot({
        seasonId: "s1",
        slot: "sf1",
        winnerParticipantId: "A",
      }),
    ).toEqual({ unadvanced: false, reason: "next-round-started" });
  });
});
