import { beforeEach, describe, expect, it, vi } from "vitest";

// Audit round 4 : `claimDailyBonus` execute desormais le check + credit
// dans une seule $transaction Prisma. On simule en faisant que
// `prisma.$transaction(cb)` execute le callback avec un `tx` qui
// partage les memes mocks (proTransaction, proWallet) — comme ca le test
// peut configurer les retours via `mocked.proTransaction.findFirst.mockResolvedValue`
// et le code voit le meme mock dans la $transaction.
vi.mock("../prisma", () => {
  const proTransaction = { findFirst: vi.fn(), create: vi.fn() };
  const proWallet = { findUnique: vi.fn(), update: vi.fn() };
  return {
    prisma: {
      proTransaction,
      proWallet,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (cb: any) =>
        cb({ proTransaction, proWallet }),
      ),
    },
  };
});

vi.mock("./pro-wallet", () => ({
  credit: vi.fn(),
  getOrCreateWallet: vi.fn(),
}));

import { prisma } from "../prisma";
import { credit, getOrCreateWallet } from "./pro-wallet";
import {
  DAILY_BONUS_AMOUNT,
  FIRST_TIME_BONUS_AMOUNT,
  claimDailyBonus,
  getDailyBonusStatus,
  grantFirstTimeBonus,
} from "./pro-wallet-rewards";

interface MockedPrisma {
  proTransaction: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  proWallet: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

const mocked = prisma as unknown as MockedPrisma;
const mockedCredit = vi.mocked(credit);
const mockedEnsure = vi.mocked(getOrCreateWallet);

const USER = "user_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockedEnsure.mockResolvedValue({ userId: USER, crowns: 0 });
  mocked.proWallet.findUnique.mockResolvedValue({ crowns: 0 });
  // Re-attache le comportement par defaut du $transaction (vi.clearAllMocks
  // l'a vide).
  mocked.$transaction.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (cb: any) =>
      cb({
        proTransaction: mocked.proTransaction,
        proWallet: mocked.proWallet,
      }),
  );
});

describe("grantFirstTimeBonus — sprint 1.D.6", () => {
  it("crédite 1000 si jamais réclamé", async () => {
    mocked.proTransaction.findFirst.mockResolvedValue(null);
    mockedCredit.mockResolvedValue(1000);

    const out = await grantFirstTimeBonus(USER);
    expect(out.granted).toBe(true);
    expect(out.amount).toBe(FIRST_TIME_BONUS_AMOUNT);
    expect(out.balance).toBe(1000);
    expect(out.nextEligibleAt).toBeNull();
    expect(mockedCredit).toHaveBeenCalledWith(
      USER,
      1000,
      "REWARD",
      "first_signup",
    );
  });

  it("idempotent : ne crédit pas si déjà réclamé", async () => {
    mocked.proTransaction.findFirst.mockResolvedValue({ id: "tx_old" });
    mocked.proWallet.findUnique.mockResolvedValue({ crowns: 1500 });

    const out = await grantFirstTimeBonus(USER);
    expect(out.granted).toBe(false);
    expect(out.amount).toBe(0);
    expect(out.balance).toBe(1500);
    expect(mockedCredit).not.toHaveBeenCalled();
  });
});

describe("claimDailyBonus — sprint 1.D.6", () => {
  it("crédite 50 si pas de DAILY antérieur", async () => {
    mocked.proTransaction.findFirst.mockResolvedValue(null);
    // Le code lit le solde via findUnique DANS la $transaction, puis
    // update. On simule current=0 → updated=50.
    mocked.proWallet.findUnique.mockResolvedValue({ crowns: 0 });
    mocked.proWallet.update.mockResolvedValue({ crowns: 50 });
    mocked.proTransaction.create.mockResolvedValue({ id: "tx_new" });

    const out = await claimDailyBonus(USER);
    expect(out.granted).toBe(true);
    expect(out.amount).toBe(DAILY_BONUS_AMOUNT);
    expect(out.balance).toBe(50);
    expect(out.nextEligibleAt).not.toBeNull();
    expect(mocked.$transaction).toHaveBeenCalledTimes(1);
    expect(mocked.proWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER },
        data: { crowns: 50 },
      }),
    );
    expect(mocked.proTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletId: USER,
          type: "DAILY",
          amount: DAILY_BONUS_AMOUNT,
        }),
      }),
    );
  });

  it("rejette si dernier DAILY < 24h", async () => {
    const now = new Date("2026-09-15T12:00:00Z");
    const recentDaily = new Date("2026-09-15T08:00:00Z"); // 4h ago
    mocked.proTransaction.findFirst.mockResolvedValue({
      createdAt: recentDaily,
    });
    mocked.proWallet.findUnique.mockResolvedValue({ crowns: 250 });

    const out = await claimDailyBonus(USER, now);
    expect(out.granted).toBe(false);
    expect(out.amount).toBe(0);
    expect(out.balance).toBe(250);
    // nextEligibleAt = recentDaily + 24h
    expect(out.nextEligibleAt).toBe("2026-09-16T08:00:00.000Z");
    expect(mocked.proWallet.update).not.toHaveBeenCalled();
    expect(mocked.proTransaction.create).not.toHaveBeenCalled();
    expect(mockedCredit).not.toHaveBeenCalled();
  });

  it("crédite si dernier DAILY >= 24h", async () => {
    const now = new Date("2026-09-16T12:00:00Z");
    const oldDaily = new Date("2026-09-15T08:00:00Z"); // 28h ago
    mocked.proTransaction.findFirst.mockResolvedValue({
      createdAt: oldDaily,
    });
    mocked.proWallet.findUnique.mockResolvedValue({ crowns: 250 });
    mocked.proWallet.update.mockResolvedValue({ crowns: 300 });
    mocked.proTransaction.create.mockResolvedValue({ id: "tx_new" });

    const out = await claimDailyBonus(USER, now);
    expect(out.granted).toBe(true);
    expect(out.amount).toBe(DAILY_BONUS_AMOUNT);
    expect(out.balance).toBe(300);
  });
});

describe("getDailyBonusStatus — sprint 1.D.6", () => {
  it("available=true si pas de DAILY antérieur", async () => {
    mocked.proTransaction.findFirst.mockResolvedValue(null);
    const out = await getDailyBonusStatus(USER);
    expect(out.available).toBe(true);
    expect(out.nextEligibleAt).toBeNull();
  });

  it("available=true si DAILY > 24h", async () => {
    const now = new Date("2026-09-16T12:00:00Z");
    mocked.proTransaction.findFirst.mockResolvedValue({
      createdAt: new Date("2026-09-15T11:00:00Z"),
    });
    const out = await getDailyBonusStatus(USER, now);
    expect(out.available).toBe(true);
  });

  it("available=false + nextEligibleAt si DAILY < 24h", async () => {
    const now = new Date("2026-09-15T12:00:00Z");
    const recent = new Date("2026-09-15T08:00:00Z");
    mocked.proTransaction.findFirst.mockResolvedValue({
      createdAt: recent,
    });
    const out = await getDailyBonusStatus(USER, now);
    expect(out.available).toBe(false);
    expect(out.nextEligibleAt).toBe("2026-09-16T08:00:00.000Z");
  });
});
