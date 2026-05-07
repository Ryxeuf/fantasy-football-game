import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proBetMarket: { findMany: vi.fn(), findUnique: vi.fn() },
    proBet: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("./pro-wallet", () => ({
  debit: vi.fn(),
  InsufficientFundsError: class InsufficientFundsError extends Error {
    code = "WALLET_INSUFFICIENT_FUNDS";
    available = 0;
    requested = 0;
  },
}));

import { prisma } from "../prisma";
import { debit } from "./pro-wallet";
import {
  BetValidationError,
  MarketNotFoundError,
  listMarketsForMatch,
  listMyBets,
  placeBet,
} from "./pro-bet";

interface MockedPrisma {
  proBetMarket: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  proBet: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

const mocked = prisma as unknown as MockedPrisma;
const mockedDebit = vi.mocked(debit);

const USER = "user_1";
const VALID_TOKEN = "ckabc12345xyz";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listMarketsForMatch — sprint 1.D.4", () => {
  it("renvoie [] si aucun market", async () => {
    mocked.proBetMarket.findMany.mockResolvedValue([]);
    const out = await listMarketsForMatch("m1");
    expect(out).toEqual([]);
  });

  it("formate les markets avec config Json natif", async () => {
    mocked.proBetMarket.findMany.mockResolvedValue([
      {
        id: "mkt1",
        matchId: "m1",
        type: "ONE_X_TWO",
        config: { homeOdds: 1.9, drawOdds: 3.5, awayOdds: 4.0 },
        status: "open",
        closesAt: new Date("2026-09-15T21:00:00Z"),
      },
    ]);
    const out = await listMarketsForMatch("m1");
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("ONE_X_TWO");
    expect(out[0].config.homeOdds).toBe(1.9);
    expect(out[0].closesAt).toBe("2026-09-15T21:00:00.000Z");
  });

  it("parse config string (sqlite mirror)", async () => {
    mocked.proBetMarket.findMany.mockResolvedValue([
      {
        id: "mkt2",
        matchId: "m1",
        type: "NUFFLE_OCCURS",
        config: '{"yesOdds":1.5,"noOdds":2.4}',
        status: "open",
        closesAt: new Date(),
      },
    ]);
    const out = await listMarketsForMatch("m1");
    expect(out[0].config.yesOdds).toBe(1.5);
  });
});

describe("placeBet — sprint 1.D.4", () => {
  function buildOpenMarket(overrides: Record<string, unknown> = {}) {
    return {
      id: "mkt1",
      matchId: "m1",
      type: "ONE_X_TWO",
      config: { homeOdds: 2.0, drawOdds: 3.5, awayOdds: 4.0 },
      status: "open",
      closesAt: new Date(Date.now() + 3_600_000),
      ...overrides,
    };
  }

  function buildBetRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "b1",
      userId: USER,
      marketId: "mkt1",
      selection: "home",
      stake: 100,
      oddsAtPlace: 2.0,
      status: "pending",
      payoutAmount: null,
      clientToken: VALID_TOKEN,
      createdAt: new Date(),
      market: { type: "ONE_X_TWO", matchId: "m1" },
      ...overrides,
    };
  }

  it("rejette clientToken trop court", async () => {
    await expect(
      placeBet({
        userId: USER,
        marketId: "mkt1",
        selection: "home",
        stake: 100,
        oddsAtPlace: 2.0,
        clientToken: "short",
      }),
    ).rejects.toThrow(BetValidationError);
  });

  it("idempotent : renvoie le bet existant si clientToken déjà vu", async () => {
    mocked.proBet.findUnique.mockResolvedValue(buildBetRow());
    const out = await placeBet({
      userId: USER,
      marketId: "mkt1",
      selection: "home",
      stake: 999, // ignoré, on renvoie l'existant
      oddsAtPlace: 999,
      clientToken: VALID_TOKEN,
    });
    expect(out.id).toBe("b1");
    expect(mocked.proBet.create).not.toHaveBeenCalled();
    expect(mockedDebit).not.toHaveBeenCalled();
  });

  async function expectCode(
    promise: Promise<unknown>,
    code: string,
  ): Promise<void> {
    try {
      await promise;
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(BetValidationError);
      expect((err as BetValidationError).code).toBe(code);
    }
  }

  it("rejette stake invalide", async () => {
    mocked.proBet.findUnique.mockResolvedValue(null);
    await expectCode(
      placeBet({
        userId: USER,
        marketId: "mkt1",
        selection: "home",
        stake: 0,
        oddsAtPlace: 2.0,
        clientToken: VALID_TOKEN,
      }),
      "INVALID_STAKE",
    );
    await expectCode(
      placeBet({
        userId: USER,
        marketId: "mkt1",
        selection: "home",
        stake: 9_999_999,
        oddsAtPlace: 2.0,
        clientToken: VALID_TOKEN,
      }),
      "INVALID_STAKE",
    );
    await expectCode(
      placeBet({
        userId: USER,
        marketId: "mkt1",
        selection: "home",
        stake: 1.5,
        oddsAtPlace: 2.0,
        clientToken: VALID_TOKEN,
      }),
      "INVALID_STAKE",
    );
  });

  it("rejette oddsAtPlace < 1.05", async () => {
    mocked.proBet.findUnique.mockResolvedValue(null);
    await expectCode(
      placeBet({
        userId: USER,
        marketId: "mkt1",
        selection: "home",
        stake: 100,
        oddsAtPlace: 1.0,
        clientToken: VALID_TOKEN,
      }),
      "INVALID_ODDS",
    );
  });

  it("MarketNotFoundError si market inexistant", async () => {
    mocked.proBet.findUnique.mockResolvedValue(null);
    mocked.proBetMarket.findUnique.mockResolvedValue(null);
    await expect(
      placeBet({
        userId: USER,
        marketId: "mkt_unknown",
        selection: "home",
        stake: 100,
        oddsAtPlace: 2.0,
        clientToken: VALID_TOKEN,
      }),
    ).rejects.toThrow(MarketNotFoundError);
  });

  it("rejette market closed", async () => {
    mocked.proBet.findUnique.mockResolvedValue(null);
    mocked.proBetMarket.findUnique.mockResolvedValue(
      buildOpenMarket({ status: "closed" }),
    );
    await expectCode(
      placeBet({
        userId: USER,
        marketId: "mkt1",
        selection: "home",
        stake: 100,
        oddsAtPlace: 2.0,
        clientToken: VALID_TOKEN,
      }),
      "MARKET_CLOSED",
    );
  });

  it("rejette si closesAt déjà passé", async () => {
    mocked.proBet.findUnique.mockResolvedValue(null);
    mocked.proBetMarket.findUnique.mockResolvedValue(
      buildOpenMarket({ closesAt: new Date(Date.now() - 60_000) }),
    );
    await expectCode(
      placeBet({
        userId: USER,
        marketId: "mkt1",
        selection: "home",
        stake: 100,
        oddsAtPlace: 2.0,
        clientToken: VALID_TOKEN,
      }),
      "MARKET_CLOSED",
    );
  });

  it("rejette selection invalide pour le type", async () => {
    mocked.proBet.findUnique.mockResolvedValue(null);
    mocked.proBetMarket.findUnique.mockResolvedValue(buildOpenMarket());
    await expectCode(
      placeBet({
        userId: USER,
        marketId: "mkt1",
        selection: "yes", // invalide pour ONE_X_TWO
        stake: 100,
        oddsAtPlace: 2.0,
        clientToken: VALID_TOKEN,
      }),
      "INVALID_SELECTION",
    );
  });

  it("rejette stale odds (drift > 2%)", async () => {
    mocked.proBet.findUnique.mockResolvedValue(null);
    mocked.proBetMarket.findUnique.mockResolvedValue(buildOpenMarket());
    await expectCode(
      placeBet({
        userId: USER,
        marketId: "mkt1",
        selection: "home",
        stake: 100,
        oddsAtPlace: 2.5, // home odds = 2.0 → drift 25%
        clientToken: VALID_TOKEN,
      }),
      "STALE_ODDS",
    );
  });

  it("accepte un drift < 2%", async () => {
    mocked.proBet.findUnique.mockResolvedValue(null);
    mocked.proBetMarket.findUnique.mockResolvedValue(buildOpenMarket());
    mockedDebit.mockResolvedValue(900);
    mocked.proBet.create.mockResolvedValue(
      buildBetRow({ oddsAtPlace: 2.01 }),
    );
    const out = await placeBet({
      userId: USER,
      marketId: "mkt1",
      selection: "home",
      stake: 100,
      oddsAtPlace: 2.01, // drift 0.5% — OK
      clientToken: VALID_TOKEN,
    });
    expect(out.id).toBe("b1");
    expect(mockedDebit).toHaveBeenCalledWith(USER, 100, "BET");
  });

  it("place pari OK : debit + create + renvoie summary", async () => {
    mocked.proBet.findUnique.mockResolvedValue(null);
    mocked.proBetMarket.findUnique.mockResolvedValue(buildOpenMarket());
    mockedDebit.mockResolvedValue(900);
    mocked.proBet.create.mockResolvedValue(buildBetRow());

    const out = await placeBet({
      userId: USER,
      marketId: "mkt1",
      selection: "home",
      stake: 100,
      oddsAtPlace: 2.0,
      clientToken: VALID_TOKEN,
    });

    expect(out.id).toBe("b1");
    expect(out.marketType).toBe("ONE_X_TWO");
    expect(out.matchId).toBe("m1");
    expect(out.selection).toBe("home");
    expect(out.stake).toBe(100);
    expect(out.status).toBe("pending");
    expect(mockedDebit).toHaveBeenCalledWith(USER, 100, "BET");
    expect(mocked.proBet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER,
          marketId: "mkt1",
          stake: 100,
          oddsAtPlace: 2.0,
          clientToken: VALID_TOKEN,
          status: "pending",
        }),
      }),
    );
  });
});

describe("listMyBets — sprint 1.D.4", () => {
  it("rejette limit invalide", async () => {
    await expect(listMyBets(USER, 0)).rejects.toThrow(BetValidationError);
    await expect(listMyBets(USER, 1000)).rejects.toThrow(BetValidationError);
  });

  it("[] si aucun pari", async () => {
    mocked.proBet.findMany.mockResolvedValue([]);
    expect(await listMyBets(USER)).toEqual([]);
  });

  it("formate les rows en summary", async () => {
    mocked.proBet.findMany.mockResolvedValue([
      {
        id: "b1",
        userId: USER,
        marketId: "mkt1",
        selection: "home",
        stake: 100,
        oddsAtPlace: 2.0,
        status: "won",
        payoutAmount: 200,
        clientToken: VALID_TOKEN,
        createdAt: new Date(),
        market: { type: "ONE_X_TWO", matchId: "m1" },
      },
    ]);
    const out = await listMyBets(USER, 10);
    expect(out).toHaveLength(1);
    expect(out[0].marketType).toBe("ONE_X_TWO");
    expect(out[0].status).toBe("won");
    expect(out[0].payoutAmount).toBe(200);
  });
});
