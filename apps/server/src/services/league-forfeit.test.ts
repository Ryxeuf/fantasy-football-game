/**
 * L2.A.11 — Tests du service `league-forfeit.ts`.
 *
 * Couvre :
 *  - recordForfeit : 404 / etat non terminal / match deja compte /
 *    application correcte (winner/loser, points, TD, status)
 *  - completion automatique de round et saison apres dernier forfait
 *  - sweepDeadlinePairings : selection par deadline, batch limit,
 *    delegation a recordForfeit
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leaguePairing: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    leagueSeason: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    leagueRound: {
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    leagueParticipant: {
      update: vi.fn(),
    },
    match: {
      update: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import { prisma } from "../prisma";
import {
  recordForfeit,
  sweepDeadlinePairings,
} from "./league-forfeit";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  pairFind: prisma.leaguePairing.findUnique as MockFn,
  pairFindMany: prisma.leaguePairing.findMany as MockFn,
  pairUpdate: prisma.leaguePairing.update as MockFn,
  pairCount: prisma.leaguePairing.count as MockFn,
  seasonFind: prisma.leagueSeason.findUnique as MockFn,
  seasonUpdate: prisma.leagueSeason.update as MockFn,
  roundUpdate: prisma.leagueRound.update as MockFn,
  roundFindMany: prisma.leagueRound.findMany as MockFn,
  participantUpdate: prisma.leagueParticipant.update as MockFn,
  matchUpdate: prisma.match.update as MockFn,
  transaction: prisma.$transaction as MockFn,
};

const BAREME = {
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
};

function buildPairing(overrides: Record<string, unknown> = {}) {
  return {
    id: "pair-1",
    status: "scheduled",
    match: null,
    round: { id: "round-1", seasonId: "season-1" },
    homeParticipantId: "p-home",
    awayParticipantId: "p-away",
    homeParticipant: { id: "p-home", seasonId: "season-1" },
    awayParticipant: { id: "p-away", seasonId: "season-1" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.transaction.mockImplementation(async (ops: unknown[]) =>
    Promise.all(ops as Promise<unknown>[]),
  );
  // Default: no other pairings pending in the round, no other rounds
  // pending in the season -> round + season auto-complete.
  mocked.pairCount.mockResolvedValue(0);
  mocked.roundFindMany.mockResolvedValue([]);
});

describe("recordForfeit", () => {
  it("returns pairing-missing when pairing does not exist", async () => {
    mocked.pairFind.mockResolvedValue(null);
    const out = await recordForfeit({ pairingId: "missing" });
    expect(out).toEqual({ skipped: true, reason: "pairing-missing" });
  });

  it("skips pairings already in a terminal state", async () => {
    mocked.pairFind.mockResolvedValue(buildPairing({ status: "played" }));
    const out = await recordForfeit({ pairingId: "pair-1" });
    expect(out).toEqual({
      skipped: true,
      reason: "pairing-not-terminal-eligible",
    });
  });

  it("skips when the linked match has already been scored", async () => {
    mocked.pairFind.mockResolvedValue(
      buildPairing({
        status: "in_progress",
        match: { id: "m-1", leagueScoredAt: new Date() },
      }),
    );
    const out = await recordForfeit({ pairingId: "pair-1" });
    expect(out).toEqual({ skipped: true, reason: "match-already-scored" });
  });

  it("forfeits the home team by default and credits the away team 2-0", async () => {
    mocked.pairFind.mockResolvedValue(buildPairing());
    mocked.seasonFind.mockResolvedValue({ league: BAREME });

    const out = await recordForfeit({ pairingId: "pair-1" });

    expect(out).toEqual({
      recorded: true,
      pairingId: "pair-1",
      side: "home",
      winnerParticipantId: "p-away",
      loserParticipantId: "p-home",
    });

    const calls = mocked.participantUpdate.mock.calls.map(
      (c: unknown[]) => c[0],
    ) as Array<{ where: { id: string }; data: Record<string, unknown> }>;
    const winner = calls.find((c) => c.where.id === "p-away");
    const loser = calls.find((c) => c.where.id === "p-home");
    expect(winner?.data.wins).toEqual({ increment: 1 });
    expect(winner?.data.points).toEqual({ increment: 3 });
    expect(winner?.data.touchdownsFor).toEqual({ increment: 2 });
    expect(loser?.data.losses).toEqual({ increment: 1 });
    expect(loser?.data.points).toEqual({ increment: -1 });
    expect(loser?.data.touchdownsAgainst).toEqual({ increment: 2 });

    expect(mocked.pairUpdate).toHaveBeenCalledWith({
      where: { id: "pair-1" },
      data: { status: "forfeit_home" },
    });
  });

  it("forfeits the away team when side='away'", async () => {
    mocked.pairFind.mockResolvedValue(buildPairing());
    mocked.seasonFind.mockResolvedValue({ league: BAREME });

    const out = await recordForfeit({
      pairingId: "pair-1",
      side: "away",
    });
    if (!("recorded" in out)) throw new Error("expected recorded");
    expect(out.winnerParticipantId).toBe("p-home");
    expect(out.loserParticipantId).toBe("p-away");
    expect(mocked.pairUpdate).toHaveBeenCalledWith({
      where: { id: "pair-1" },
      data: { status: "forfeit_away" },
    });
  });

  it("flips the linked match leagueScoredAt to prevent double-counting", async () => {
    mocked.pairFind.mockResolvedValue(
      buildPairing({
        status: "in_progress",
        match: { id: "m-1", leagueScoredAt: null },
      }),
    );
    mocked.seasonFind.mockResolvedValue({ league: BAREME });

    await recordForfeit({ pairingId: "pair-1" });

    expect(mocked.matchUpdate).toHaveBeenCalledWith({
      where: { id: "m-1" },
      data: { leagueScoredAt: expect.any(Date) },
    });
  });

  it("auto-completes the round and the season after the last forfeit", async () => {
    mocked.pairFind.mockResolvedValue(buildPairing());
    mocked.seasonFind.mockResolvedValue({ league: BAREME });
    mocked.pairCount.mockResolvedValue(0); // no other pending pairings
    mocked.roundFindMany.mockResolvedValue([]); // no other rounds left

    await recordForfeit({ pairingId: "pair-1" });

    expect(mocked.roundUpdate).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: { status: "completed" },
    });
    expect(mocked.seasonUpdate).toHaveBeenCalledWith({
      where: { id: "season-1" },
      data: { status: "completed" },
    });
  });

  it("does not complete the round when other pairings are still pending", async () => {
    mocked.pairFind.mockResolvedValue(buildPairing());
    mocked.seasonFind.mockResolvedValue({ league: BAREME });
    mocked.pairCount.mockResolvedValue(2); // 2 other pairings pending

    await recordForfeit({ pairingId: "pair-1" });

    expect(mocked.roundUpdate).not.toHaveBeenCalled();
    expect(mocked.seasonUpdate).not.toHaveBeenCalled();
  });
});

describe("sweepDeadlinePairings", () => {
  it("returns zero when no pairing is past its deadline", async () => {
    mocked.pairFindMany.mockResolvedValue([]);
    const out = await sweepDeadlinePairings();
    expect(out).toEqual({ inspected: 0, forfeited: 0, skipped: 0 });
    expect(mocked.pairUpdate).not.toHaveBeenCalled();
  });

  it("forfaits each due pairing using the default side='home'", async () => {
    mocked.pairFindMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    // Each call to recordForfeit re-loads its pairing.
    mocked.pairFind.mockImplementation(async (args: { where: { id: string } }) =>
      buildPairing({ id: args.where.id }),
    );
    mocked.seasonFind.mockResolvedValue({ league: BAREME });

    const out = await sweepDeadlinePairings({ limit: 10 });

    expect(out).toEqual({ inspected: 2, forfeited: 2, skipped: 0 });
    expect(mocked.pairUpdate).toHaveBeenCalledTimes(2);
  });

  it("counts pairings that get skipped (e.g. raced match scoring)", async () => {
    mocked.pairFindMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    mocked.pairFind.mockImplementation(async (args: { where: { id: string } }) =>
      buildPairing({
        id: args.where.id,
        status: args.where.id === "p1" ? "played" : "scheduled",
      }),
    );
    mocked.seasonFind.mockResolvedValue({ league: BAREME });

    const out = await sweepDeadlinePairings();
    expect(out.inspected).toBe(2);
    expect(out.forfeited).toBe(1);
    expect(out.skipped).toBe(1);
  });

  it("respects the limit option", async () => {
    mocked.pairFindMany.mockResolvedValue([]);
    await sweepDeadlinePairings({ limit: 7 });
    const args = mocked.pairFindMany.mock.calls[0][0];
    expect(args.take).toBe(7);
  });

  it("clamps invalid limit values into 1..500", async () => {
    mocked.pairFindMany.mockResolvedValue([]);
    await sweepDeadlinePairings({ limit: 9999 });
    expect(mocked.pairFindMany.mock.calls[0][0].take).toBe(500);
    await sweepDeadlinePairings({ limit: 0 });
    expect(mocked.pairFindMany.mock.calls[1][0].take).toBe(1);
  });
});
