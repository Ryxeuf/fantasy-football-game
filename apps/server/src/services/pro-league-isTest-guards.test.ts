/**
 * Tests for Lot 2.C.3 — guards excluding isTest=true matches from
 * production aggregators / writers.
 *
 * Each suite asserts that the where clauses include `isTest: false`
 * (or equivalent) so sandbox matchs don't leak into stats, feeds,
 * casualties applied, bets, drift baseline, gazette, etc.
 *
 * We mock prisma at module level and inspect the args passed to
 * findMany / findUnique so the tests are fast and don't require a
 * database.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    proLeagueSeason: { findFirst: vi.fn() },
    proTeam: { findUnique: vi.fn() },
    proTeamRoster: { findMany: vi.fn() },
    proLeagueStandings: { findMany: vi.fn() },
    proBetMarket: { findUnique: vi.fn() },
    proBet: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import { computeEngineDrift } from "./pro-league-engine-drift-watcher";
import { sweepMatchCasualties } from "./pro-roster-casualties";
import { sweepUnsettledMarkets } from "./pro-bet-settlement";

const mocked = prisma as unknown as {
  proLeagueMatch: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  proBetMarket: { findUnique: ReturnType<typeof vi.fn> };
  proBet: { findUnique: ReturnType<typeof vi.fn> };
};

describe("Lot 2.C.3 — guards on aggregators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computeEngineDrift filtre isTest=false", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    await computeEngineDrift();
    const args = mocked.proLeagueMatch.findMany.mock.calls[0][0];
    expect(args.where.isTest).toBe(false);
  });

  it("sweepMatchCasualties filtre isTest=false", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    await sweepMatchCasualties();
    const args = mocked.proLeagueMatch.findMany.mock.calls[0][0];
    expect(args.where.isTest).toBe(false);
  });

  it("sweepUnsettledMarkets filtre isTest=false", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    await sweepUnsettledMarkets();
    const args = mocked.proLeagueMatch.findMany.mock.calls[0][0];
    expect(args.where.isTest).toBe(false);
  });
});

describe("Lot 2.C.3 — placeBet rejects isTest matches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("placeBet renvoie BetValidationError quand le match est sandbox", async () => {
    const { placeBet, BetValidationError } = await import("./pro-bet");
    mocked.proBet.findUnique.mockResolvedValue(null);
    mocked.proBetMarket.findUnique.mockResolvedValue({
      id: "market-1",
      matchId: "m-test",
      type: "winner",
      config: '{"home":2.0,"away":2.0,"draw":3.0}',
      status: "open",
      closesAt: new Date(Date.now() + 60_000),
      match: { isTest: true },
    });

    await expect(
      placeBet({
        clientToken: "abcdefghijklm",
        marketId: "market-1",
        userId: "u-1",
        selection: "home",
        stake: 100,
        oddsAtPlace: 2.0,
      }),
    ).rejects.toBeInstanceOf(BetValidationError);
  });
});
