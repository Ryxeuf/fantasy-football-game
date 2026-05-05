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
      count: vi.fn(),
    },
    leaguePairing: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { computeSeasonStandings } from "./league";
import { prisma } from "../prisma";
import {
  generatePlayoffSeedingFor,
  nextSlotFor,
  firstRoundSlotsFor,
  winnerFromStatus,
  startPlayoffs,
  advancePlayoffsAfterPairingComplete,
  advancePlayoffsWithWinner,
  type PlayoffSize,
} from "./league-playoffs";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  standings: computeSeasonStandings as unknown as MockFn,
  seasonFind: prisma.leagueSeason.findUnique as MockFn,
  roundFindFirst: prisma.leagueRound.findFirst as MockFn,
  roundCreate: prisma.leagueRound.create as MockFn,
  roundCount: prisma.leagueRound.count as MockFn,
  pairingFindFirst: prisma.leaguePairing.findFirst as MockFn,
  pairingCreate: prisma.leaguePairing.create as MockFn,
  pairingUpdate: prisma.leaguePairing.update as MockFn,
};

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(() =>
      generatePlayoffSeedingFor(4, ["a", "b", "c"], 8),
    ).toThrow(/insuffisants/);
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
    const out = generatePlayoffSeedingFor(
      4,
      ["s1", "s2", "s3", "s4"],
      10,
    );
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
        "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8",
        "s9", "s10", "s11", // ignored
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
    mocked.pairingFindFirst
      .mockResolvedValueOnce({
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
    mocked.pairingFindFirst
      .mockResolvedValueOnce({
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
