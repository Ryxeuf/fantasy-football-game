/**
 * Workstream ligue offline — tests du service `recordOfflineLeagueResult`.
 *
 * Couvre :
 *  - skips : pairing introuvable / etat terminal / match deja compte
 *  - victoire home : compteurs (W/L, points, TD, CAS), pairing `played`,
 *    ELO saisonnier applique (home gagne, away perd)
 *  - nul : draws des deux cotes
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leaguePairing: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(1), // round non complet -> short-circuit
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
    $transaction: vi.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  },
}));

import { prisma } from "../prisma";
import { recordOfflineLeagueResult } from "./league-offline-result";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  pairFind: prisma.leaguePairing.findUnique as MockFn,
  pairUpdate: prisma.leaguePairing.update as MockFn,
  pairCount: prisma.leaguePairing.count as MockFn,
  seasonFind: prisma.leagueSeason.findUnique as MockFn,
  participantUpdate: prisma.leagueParticipant.update as MockFn,
};

const BAREME = { winPoints: 3, drawPoints: 1, lossPoints: 0 };

function buildPairing(overrides: Record<string, unknown> = {}) {
  return {
    id: "pair-1",
    status: "scheduled",
    match: null,
    round: { id: "round-1", seasonId: "season-1" },
    homeParticipant: {
      id: "part-home",
      seasonElo: 1000,
      wins: 0,
      draws: 0,
      losses: 0,
    },
    awayParticipant: {
      id: "part-away",
      seasonElo: 1000,
      wins: 0,
      draws: 0,
      losses: 0,
    },
    ...overrides,
  };
}

function dataOf(call: unknown): Record<string, any> {
  return (call as { data: Record<string, any> }).data;
}

describe("recordOfflineLeagueResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.pairCount.mockResolvedValue(1);
    mocked.seasonFind.mockResolvedValue({ league: BAREME });
    mocked.participantUpdate.mockResolvedValue({});
    mocked.pairUpdate.mockResolvedValue({});
  });

  it("skips when the pairing does not exist", async () => {
    mocked.pairFind.mockResolvedValue(null);
    const r = await recordOfflineLeagueResult({
      pairingId: "nope",
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });
    expect(r).toEqual({ skipped: true, reason: "pairing-missing" });
  });

  it("skips when the pairing is already terminal (played)", async () => {
    mocked.pairFind.mockResolvedValue(buildPairing({ status: "played" }));
    const r = await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });
    expect(r).toEqual({
      skipped: true,
      reason: "pairing-not-terminal-eligible",
    });
  });

  it("skips when the linked match is already scored", async () => {
    mocked.pairFind.mockResolvedValue(
      buildPairing({ match: { id: "m1", leagueScoredAt: new Date() } }),
    );
    const r = await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });
    expect(r).toEqual({ skipped: true, reason: "match-already-scored" });
  });

  it("records a home win: counters, played status, ELO applied", async () => {
    mocked.pairFind.mockResolvedValue(buildPairing());
    const r = await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 3,
      casualtiesAway: 1,
    });

    expect(r).toMatchObject({ recorded: true, winner: "home" });
    expect(mocked.participantUpdate).toHaveBeenCalledTimes(2);

    const homeData = dataOf(mocked.participantUpdate.mock.calls[0][0]);
    expect(homeData.wins).toEqual({ increment: 1 });
    expect(homeData.losses).toEqual({ increment: 0 });
    expect(homeData.points).toEqual({ increment: BAREME.winPoints });
    expect(homeData.touchdownsFor).toEqual({ increment: 2 });
    expect(homeData.touchdownsAgainst).toEqual({ increment: 1 });
    expect(homeData.casualtiesFor).toEqual({ increment: 3 });
    // home a gagne -> ELO saisonnier en hausse
    expect(homeData.seasonElo).toBeGreaterThan(1000);

    const awayData = dataOf(mocked.participantUpdate.mock.calls[1][0]);
    expect(awayData.losses).toEqual({ increment: 1 });
    expect(awayData.points).toEqual({ increment: BAREME.lossPoints });
    expect(awayData.seasonElo).toBeLessThan(1000);

    // pairing bascule en played
    const pairData = dataOf(mocked.pairUpdate.mock.calls[0][0]);
    expect(pairData.status).toBe("played");
  });

  it("records a draw on both sides", async () => {
    mocked.pairFind.mockResolvedValue(buildPairing());
    const r = await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 1,
      scoreAway: 1,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });
    expect(r).toMatchObject({ recorded: true, winner: "draw" });
    const homeData = dataOf(mocked.participantUpdate.mock.calls[0][0]);
    const awayData = dataOf(mocked.participantUpdate.mock.calls[1][0]);
    expect(homeData.draws).toEqual({ increment: 1 });
    expect(awayData.draws).toEqual({ increment: 1 });
    expect(homeData.points).toEqual({ increment: BAREME.drawPoints });
    expect(awayData.points).toEqual({ increment: BAREME.drawPoints });
  });
});
