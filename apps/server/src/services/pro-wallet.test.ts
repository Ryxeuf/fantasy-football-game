import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proWallet: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    proTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  InsufficientFundsError,
  InvalidAmountError,
  InvalidTxTypeError,
  credit,
  debit,
  getBalance,
  getOrCreateWallet,
  getRecentTransactions,
} from "./pro-wallet";

interface MockedPrisma {
  proWallet: {
    upsert: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  proTransaction: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

const mocked = prisma as unknown as MockedPrisma;

const USER = "user_1";

beforeEach(() => {
  vi.clearAllMocks();
  // Default $transaction passthrough
  mocked.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
});

describe("getOrCreateWallet — sprint 1.D.1", () => {
  it("upsert + renvoie le snapshot", async () => {
    mocked.proWallet.upsert.mockResolvedValue({
      userId: USER,
      crowns: 0,
    });
    const out = await getOrCreateWallet(USER);
    expect(out).toEqual({ userId: USER, crowns: 0 });
    expect(mocked.proWallet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER },
        create: { userId: USER },
        update: {},
      }),
    );
  });
});

describe("getBalance — sprint 1.D.1", () => {
  it("0 si pas de wallet (pas d'erreur)", async () => {
    mocked.proWallet.findUnique.mockResolvedValue(null);
    expect(await getBalance(USER)).toBe(0);
  });

  it("renvoie le solde courant", async () => {
    mocked.proWallet.findUnique.mockResolvedValue({ crowns: 1500 });
    expect(await getBalance(USER)).toBe(1500);
  });
});

describe("debit — sprint 1.D.1", () => {
  it("rejette amount <= 0 ou non entier", async () => {
    await expect(debit(USER, 0, "BET")).rejects.toThrow(InvalidAmountError);
    await expect(debit(USER, -5, "BET")).rejects.toThrow(InvalidAmountError);
    await expect(debit(USER, 1.5, "BET")).rejects.toThrow(InvalidAmountError);
  });

  it("rejette type invalide", async () => {
    await expect(
      // @ts-expect-error type invalide volontaire pour test
      debit(USER, 100, "FOOBAR"),
    ).rejects.toThrow(InvalidTxTypeError);
  });

  it("InsufficientFundsError si solde < amount", async () => {
    mocked.proWallet.upsert.mockResolvedValue({ userId: USER, crowns: 50 });
    mocked.proWallet.findUnique.mockResolvedValue({ crowns: 50 });

    await expect(debit(USER, 100, "BET")).rejects.toThrow(
      InsufficientFundsError,
    );
    expect(mocked.proWallet.update).not.toHaveBeenCalled();
    expect(mocked.proTransaction.create).not.toHaveBeenCalled();
  });

  it("debit OK : update + transaction écrites atomiquement", async () => {
    mocked.proWallet.upsert.mockResolvedValue({ userId: USER, crowns: 1000 });
    mocked.proWallet.findUnique.mockResolvedValue({ crowns: 1000 });
    mocked.proWallet.update.mockResolvedValue({ crowns: 750 });
    mocked.proTransaction.create.mockResolvedValue({});

    const newBalance = await debit(USER, 250, "BET", "bet_xyz");

    expect(newBalance).toBe(750);
    expect(mocked.proWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER },
        data: { crowns: 750 },
      }),
    );
    expect(mocked.proTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletId: USER,
          type: "BET",
          amount: -250,
          ref: "bet_xyz",
        }),
      }),
    );
  });

  it("debit sans ref : ref=null en DB", async () => {
    mocked.proWallet.upsert.mockResolvedValue({ userId: USER, crowns: 100 });
    mocked.proWallet.findUnique.mockResolvedValue({ crowns: 100 });
    mocked.proWallet.update.mockResolvedValue({ crowns: 50 });
    mocked.proTransaction.create.mockResolvedValue({});

    await debit(USER, 50, "BET");

    expect(mocked.proTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ref: null }),
      }),
    );
  });
});

describe("credit — sprint 1.D.1", () => {
  it("rejette amount <= 0", async () => {
    await expect(credit(USER, 0, "WIN")).rejects.toThrow(InvalidAmountError);
    await expect(credit(USER, -10, "WIN")).rejects.toThrow(InvalidAmountError);
  });

  it("crédit OK : amount positif dans ProTransaction", async () => {
    mocked.proWallet.upsert.mockResolvedValue({ userId: USER, crowns: 200 });
    mocked.proWallet.findUnique.mockResolvedValue({ crowns: 200 });
    mocked.proWallet.update.mockResolvedValue({ crowns: 700 });
    mocked.proTransaction.create.mockResolvedValue({});

    const newBalance = await credit(USER, 500, "WIN", "bet_xyz");

    expect(newBalance).toBe(700);
    expect(mocked.proTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "WIN",
          amount: 500,
          ref: "bet_xyz",
        }),
      }),
    );
  });

  it("first credit sur wallet inexistant : crée puis crédit", async () => {
    mocked.proWallet.upsert.mockResolvedValue({ userId: USER, crowns: 0 });
    mocked.proWallet.findUnique.mockResolvedValue({ crowns: 0 });
    mocked.proWallet.update.mockResolvedValue({ crowns: 1000 });
    mocked.proTransaction.create.mockResolvedValue({});

    const out = await credit(USER, 1000, "REWARD", "first_signup");

    expect(out).toBe(1000);
    expect(mocked.proWallet.upsert).toHaveBeenCalled();
  });
});

describe("getRecentTransactions — sprint 1.D.1", () => {
  it("rejette limit <= 0", async () => {
    await expect(getRecentTransactions(USER, 0)).rejects.toThrow(
      InvalidAmountError,
    );
  });

  it("renvoie [] si pas de transactions", async () => {
    mocked.proTransaction.findMany.mockResolvedValue([]);
    expect(await getRecentTransactions(USER)).toEqual([]);
  });

  it("formate les rows + ordre desc", async () => {
    const at = new Date("2026-09-01T12:00:00Z");
    mocked.proTransaction.findMany.mockResolvedValue([
      {
        id: "t1",
        type: "WIN",
        amount: 500,
        ref: "bet_x",
        createdAt: at,
      },
    ]);
    const out = await getRecentTransactions(USER, 10);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("WIN");
    expect(out[0].amount).toBe(500);
    expect(out[0].createdAt).toBe(at.toISOString());
    expect(mocked.proTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { walletId: USER },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    );
  });
});
