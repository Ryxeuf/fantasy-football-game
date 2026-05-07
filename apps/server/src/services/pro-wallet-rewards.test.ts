import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTransaction: { findFirst: vi.fn() },
    proWallet: { findUnique: vi.fn() },
  },
}));

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
  proTransaction: { findFirst: ReturnType<typeof vi.fn> };
  proWallet: { findUnique: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;
const mockedCredit = vi.mocked(credit);
const mockedEnsure = vi.mocked(getOrCreateWallet);

const USER = "user_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockedEnsure.mockResolvedValue({ userId: USER, crowns: 0 });
  mocked.proWallet.findUnique.mockResolvedValue({ crowns: 0 });
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
    mockedCredit.mockResolvedValue(50);

    const out = await claimDailyBonus(USER);
    expect(out.granted).toBe(true);
    expect(out.amount).toBe(DAILY_BONUS_AMOUNT);
    expect(out.balance).toBe(50);
    expect(out.nextEligibleAt).not.toBeNull();
    expect(mockedCredit).toHaveBeenCalledWith(USER, 50, "DAILY");
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
    expect(mockedCredit).not.toHaveBeenCalled();
  });

  it("crédite si dernier DAILY >= 24h", async () => {
    const now = new Date("2026-09-16T12:00:00Z");
    const oldDaily = new Date("2026-09-15T08:00:00Z"); // 28h ago
    mocked.proTransaction.findFirst.mockResolvedValue({
      createdAt: oldDaily,
    });
    mockedCredit.mockResolvedValue(300);

    const out = await claimDailyBonus(USER, now);
    expect(out.granted).toBe(true);
    expect(out.amount).toBe(DAILY_BONUS_AMOUNT);
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
