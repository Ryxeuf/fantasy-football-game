import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findUnique: vi.fn(), findMany: vi.fn() },
    proBetMarket: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    proBet: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    proBetSettlement: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("./pro-wallet", () => ({
  credit: vi.fn(),
}));

import { prisma } from "../prisma";
import { credit } from "./pro-wallet";
import {
  SettlementError,
  settleMarketsForMatch,
  sweepUnsettledMarkets,
} from "./pro-bet-settlement";

interface MockedPrisma {
  proLeagueMatch: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  proBetMarket: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  proBet: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  proBetSettlement: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

const mocked = prisma as unknown as MockedPrisma;
const mockedCredit = vi.mocked(credit);

const MATCH_ID = "m_1";

function buildCompletedMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH_ID,
    status: "completed",
    outcome: "home",
    touchdownCount: 4,
    casualtyCount: 2,
    nuffleCount: 3,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proBetMarket.update.mockResolvedValue({});
  mocked.proBet.update.mockResolvedValue({});
  mocked.proBetSettlement.findUnique.mockResolvedValue(null);
  mocked.proBetSettlement.create.mockResolvedValue({});
});

describe("settleMarketsForMatch — sprint 1.D.5", () => {
  it("MATCH_NOT_FOUND si match inconnu", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(null);
    try {
      await settleMarketsForMatch(MATCH_ID);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SettlementError);
      expect((err as SettlementError).code).toBe("MATCH_NOT_FOUND");
    }
  });

  it("MATCH_NOT_COMPLETED si match status != completed", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      buildCompletedMatch({ status: "scheduled" }),
    );
    try {
      await settleMarketsForMatch(MATCH_ID);
      throw new Error("expected throw");
    } catch (err) {
      expect((err as SettlementError).code).toBe("MATCH_NOT_COMPLETED");
    }
  });

  it("ne touche à rien si aucun market non-settled", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(buildCompletedMatch());
    mocked.proBetMarket.findMany.mockResolvedValue([]);
    const out = await settleMarketsForMatch(MATCH_ID);
    expect(out.settled).toBe(0);
    expect(out.skipped).toBe(0);
    expect(out.summaries).toEqual([]);
    expect(mockedCredit).not.toHaveBeenCalled();
  });

  it("settle 1X2 : home win → bets home gagnent, draw/away perdent", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(buildCompletedMatch());
    mocked.proBetMarket.findMany.mockResolvedValue([
      {
        id: "mkt1",
        type: "ONE_X_TWO",
        config: { homeOdds: 2.0, drawOdds: 3.5, awayOdds: 4.0 },
      },
    ]);
    mocked.proBet.findMany.mockResolvedValue([
      {
        id: "b_home",
        userId: "u1",
        selection: "home",
        stake: 100,
        oddsAtPlace: 2.0,
      },
      {
        id: "b_draw",
        userId: "u2",
        selection: "draw",
        stake: 50,
        oddsAtPlace: 3.5,
      },
      {
        id: "b_away",
        userId: "u3",
        selection: "away",
        stake: 200,
        oddsAtPlace: 4.0,
      },
    ]);

    const out = await settleMarketsForMatch(MATCH_ID);
    expect(out.settled).toBe(1);
    expect(out.summaries).toHaveLength(1);
    const s = out.summaries[0];
    expect(s.winningSelection).toBe("home");
    expect(s.wonCount).toBe(1);
    expect(s.lostCount).toBe(2);
    expect(s.totalStake).toBe(350);
    // payout = round(100 * 2) = 200
    expect(s.totalPayout).toBe(200);

    // u1 (home) credité 200, u2/u3 non.
    expect(mockedCredit).toHaveBeenCalledTimes(1);
    expect(mockedCredit).toHaveBeenCalledWith("u1", 200, "WIN", "b_home");

    // proBet.update : 3 fois (1 won + 2 lost)
    expect(mocked.proBet.update).toHaveBeenCalledTimes(3);
    // proBetSettlement créée
    expect(mocked.proBetSettlement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          marketId: "mkt1",
          winningSelection: "home",
          totalStake: 350,
          totalPayout: 200,
          betCount: 3,
        }),
      }),
    );
    // market passe à settled
    expect(mocked.proBetMarket.update).toHaveBeenCalledWith({
      where: { id: "mkt1" },
      data: { status: "settled" },
    });
  });

  it("OVER_UNDER_TD : line=2.5, td=4 → over gagne", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      buildCompletedMatch({ touchdownCount: 4 }),
    );
    mocked.proBetMarket.findMany.mockResolvedValue([
      {
        id: "mkt_ou",
        type: "OVER_UNDER_TD",
        config: { line: 2.5, overOdds: 1.7, underOdds: 2.1 },
      },
    ]);
    mocked.proBet.findMany.mockResolvedValue([
      {
        id: "b_o",
        userId: "u1",
        selection: "over",
        stake: 100,
        oddsAtPlace: 1.7,
      },
    ]);
    const out = await settleMarketsForMatch(MATCH_ID);
    expect(out.summaries[0].winningSelection).toBe("over");
    expect(mockedCredit).toHaveBeenCalledWith(
      "u1",
      170, // round(100 * 1.7)
      "WIN",
      "b_o",
    );
  });

  it("CAS_COUNT : line=0.5, cas=0 → under gagne", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      buildCompletedMatch({ casualtyCount: 0 }),
    );
    mocked.proBetMarket.findMany.mockResolvedValue([
      {
        id: "mkt_cas",
        type: "CAS_COUNT",
        config: { line: 0.5, overOdds: 1.6, underOdds: 2.3 },
      },
    ]);
    mocked.proBet.findMany.mockResolvedValue([]);
    const out = await settleMarketsForMatch(MATCH_ID);
    expect(out.summaries[0].winningSelection).toBe("under");
  });

  it("NUFFLE_OCCURS : nuffle=0 → no gagne", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      buildCompletedMatch({ nuffleCount: 0 }),
    );
    mocked.proBetMarket.findMany.mockResolvedValue([
      {
        id: "mkt_nuf",
        type: "NUFFLE_OCCURS",
        config: { yesOdds: 1.5, noOdds: 2.4 },
      },
    ]);
    mocked.proBet.findMany.mockResolvedValue([]);
    const out = await settleMarketsForMatch(MATCH_ID);
    expect(out.summaries[0].winningSelection).toBe("no");
  });

  it("idempotent : skip si ProBetSettlement existe déjà", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(buildCompletedMatch());
    mocked.proBetMarket.findMany.mockResolvedValue([
      {
        id: "mkt1",
        type: "ONE_X_TWO",
        config: { homeOdds: 2, drawOdds: 3, awayOdds: 4 },
      },
    ]);
    mocked.proBetSettlement.findUnique.mockResolvedValue({ id: "exist" });

    const out = await settleMarketsForMatch(MATCH_ID);
    expect(out.settled).toBe(0);
    expect(out.skipped).toBe(1);
    expect(mocked.proBet.findMany).not.toHaveBeenCalled();
    expect(mockedCredit).not.toHaveBeenCalled();
  });

  it("skip si winningSelection introuvable (counter null)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      buildCompletedMatch({ touchdownCount: null }),
    );
    mocked.proBetMarket.findMany.mockResolvedValue([
      {
        id: "mkt_ou",
        type: "OVER_UNDER_TD",
        config: { line: 2.5, overOdds: 1.7, underOdds: 2.1 },
      },
    ]);
    const out = await settleMarketsForMatch(MATCH_ID);
    expect(out.settled).toBe(0);
    expect(out.skipped).toBe(1);
  });

  it("parse config string sqlite mirror", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      buildCompletedMatch({ touchdownCount: 1 }),
    );
    mocked.proBetMarket.findMany.mockResolvedValue([
      {
        id: "mkt_ou",
        type: "OVER_UNDER_TD",
        config: '{"line":0.5,"overOdds":1.5,"underOdds":2.5}',
      },
    ]);
    mocked.proBet.findMany.mockResolvedValue([]);
    const out = await settleMarketsForMatch(MATCH_ID);
    expect(out.summaries[0].winningSelection).toBe("over"); // td=1 > 0.5
  });
});

describe("sweepUnsettledMarkets — sprint 1.D.5", () => {
  it("renvoie 0/0/0 si aucun candidat", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    const out = await sweepUnsettledMarkets();
    expect(out).toEqual({ matchesInspected: 0, settled: 0, failed: 0 });
  });

  it("agrège settled / failed par match", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([
      { id: "m1" },
      { id: "m2" },
    ]);
    // m1 OK, m2 throw. Q.B.3 consomme un findUnique supplementaire
    // pour fan predictions ; on lui sert null pour skip propre.
    mocked.proLeagueMatch.findUnique
      .mockResolvedValueOnce(buildCompletedMatch({ id: "m1" }))
      .mockResolvedValueOnce(null) // Q.B.3 fullMatch pour m1 → skip
      .mockResolvedValueOnce(null); // m2 introuvable → throw
    mocked.proBetMarket.findMany.mockResolvedValue([
      {
        id: "mkt1",
        type: "ONE_X_TWO",
        config: { homeOdds: 2, drawOdds: 3, awayOdds: 4 },
      },
    ]);
    mocked.proBet.findMany.mockResolvedValue([]);

    const out = await sweepUnsettledMarkets();
    expect(out.matchesInspected).toBe(2);
    expect(out.settled).toBe(1);
    expect(out.failed).toBe(1);
  });
});
