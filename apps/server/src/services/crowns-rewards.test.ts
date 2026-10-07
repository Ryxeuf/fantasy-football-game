import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `prisma.$transaction(cb)` exécute le callback avec un `tx` qui partage les
// mêmes mocks : le test configure les retours une fois, le code les voit
// dedans comme dehors.
vi.mock("../prisma", () => {
  const leagueMatchSheet = { findMany: vi.fn() };
  const userAchievement = { findMany: vi.fn() };
  const proTransaction = { findFirst: vi.fn(), create: vi.fn() };
  const proWallet = { update: vi.fn() };
  const crownsReward = { findMany: vi.fn(), groupBy: vi.fn(), create: vi.fn() };
  const user = { findUnique: vi.fn() };
  const client = {
    user,
    leagueMatchSheet,
    userAchievement,
    proTransaction,
    proWallet,
    crownsReward,
  };
  return {
    prisma: {
      ...client,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (cb: any) => cb(client)),
    },
  };
});

vi.mock("./pro-wallet", () => ({ getOrCreateWallet: vi.fn() }));
vi.mock("./pro-wallet-rewards", () => ({ FIRST_TIME_BONUS_REF: "first_signup" }));
vi.mock("./achievements", () => ({
  ACHIEVEMENTS_CATALOG: [{ slug: "first-friend" }, { slug: "oracle" }],
}));

import { prisma } from "../prisma";
import { getOrCreateWallet } from "./pro-wallet";
import { DEFAULT_CROWNS_REWARD_SCHEDULE as S } from "./crowns-rewards-rules";
import {
  loadAchievementRewardCandidates,
  listCrownsRewardsForAdmin,
  loadRewardBreakdowns,
  loadSheetRewardCandidates,
  reconcileCrownsRewards,
  resetCrownsRewardsDebounce,
} from "./crowns-rewards";

type Fn = ReturnType<typeof vi.fn>;
interface MockedPrisma {
  user: { findUnique: Fn };
  leagueMatchSheet: { findMany: Fn };
  userAchievement: { findMany: Fn };
  proTransaction: { findFirst: Fn; create: Fn };
  proWallet: { update: Fn };
  crownsReward: { findMany: Fn; groupBy: Fn; create: Fn };
  $transaction: Fn;
}
const db = prisma as unknown as MockedPrisma;

const ME = "coach-me";
const OTHER = "coach-other";

function leagueSheet(
  id: string,
  seasonId: string,
  homeOwner: string,
  awayOwner: string,
  day = 1,
) {
  return {
    id,
    validatedAt: new Date(Date.UTC(2026, 8, day)),
    pairing: {
      round: { seasonId },
      homeParticipant: { team: { ownerId: homeOwner } },
      awayParticipant: { team: { ownerId: awayOwner } },
    },
    cupPairing: null,
  };
}

function cupSheet(id: string, cupId: string, homeOwner: string, awayOwner: string | null) {
  return {
    id,
    validatedAt: new Date(Date.UTC(2026, 8, 2)),
    pairing: null,
    cupPairing: {
      round: { cupId },
      homeTeam: { ownerId: homeOwner },
      awayTeam: awayOwner ? { ownerId: awayOwner } : null,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCrownsRewardsDebounce();
  db.leagueMatchSheet.findMany.mockResolvedValue([]);
  db.userAchievement.findMany.mockResolvedValue([]);
  db.proTransaction.findFirst.mockResolvedValue(null);
  db.proTransaction.create.mockResolvedValue({ id: "tx-1" });
  db.crownsReward.findMany.mockResolvedValue([]);
  db.crownsReward.groupBy.mockResolvedValue([]);
  db.crownsReward.create.mockResolvedValue({});
  db.proWallet.update.mockResolvedValue({ crowns: 0 });
  vi.mocked(getOrCreateWallet).mockResolvedValue({ userId: ME, crowns: 0 } as never);
  db.$transaction.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (cb: any) => cb(db),
  );
});

describe("loadSheetRewardCandidates", () => {
  it("ne lit que les feuilles VALIDÉES où le coach possède un côté", async () => {
    await loadSheetRewardCandidates(ME);
    const arg = db.leagueMatchSheet.findMany.mock.calls[0][0];
    expect(arg.where.status).toBe("validated");
    expect(arg.where.OR).toHaveLength(4);
    expect(JSON.stringify(arg.where.OR)).toContain(ME);
  });

  it("rattache une feuille de ligue à sa saison et une de coupe à sa coupe", async () => {
    db.leagueMatchSheet.findMany.mockResolvedValue([
      leagueSheet("s1", "season-1", ME, OTHER),
      cupSheet("s2", "cup-1", OTHER, ME),
    ]);
    const candidates = await loadSheetRewardCandidates(ME);
    expect(candidates.map((c) => [c.sourceKey, c.periodKey])).toEqual([
      ["sheet:s1:home", "season:season-1"],
      ["sheet:s2:away", "cup:cup-1"],
    ]);
  });

  it("exclut une feuille dont les deux côtés appartiennent au même compte", async () => {
    db.leagueMatchSheet.findMany.mockResolvedValue([leagueSheet("s1", "season-1", ME, ME)]);
    expect(await loadSheetRewardCandidates(ME)).toEqual([]);
  });

  it("exclut une feuille de coupe sans adversaire", async () => {
    db.leagueMatchSheet.findMany.mockResolvedValue([cupSheet("s1", "cup-1", ME, null)]);
    expect(await loadSheetRewardCandidates(ME)).toEqual([]);
  });
});

describe("loadAchievementRewardCandidates", () => {
  it("ignore un succès absent du catalogue", async () => {
    db.userAchievement.findMany.mockResolvedValue([{ slug: "oracle" }, { slug: "retired-slug" }]);
    const candidates = await loadAchievementRewardCandidates(ME);
    expect(candidates).toEqual([{ kind: "achievement", sourceKey: `achievement:${ME}:oracle` }]);
  });
});

describe("reconcileCrownsRewards", () => {
  it("premier passage : une opération, une ligne par récompense, un incrément", async () => {
    db.leagueMatchSheet.findMany.mockResolvedValue([leagueSheet("s1", "season-1", ME, OTHER)]);
    db.userAchievement.findMany.mockResolvedValue([{ slug: "oracle" }]);

    const outcome = await reconcileCrownsRewards(ME);

    const total = S.signup + S.achievement + S.sheet;
    expect(outcome).toEqual({ credited: total, written: 3, conflict: false, skipped: false });
    expect(getOrCreateWallet).toHaveBeenCalledWith(ME);
    expect(db.proTransaction.create).toHaveBeenCalledTimes(1);
    const op = db.proTransaction.create.mock.calls[0][0].data;
    expect(op).toMatchObject({ walletId: ME, type: "REWARD", amount: total });
    expect(op.ref).toMatch(/^rewards:/);
    const rows = db.crownsReward.create.mock.calls.map((c) => c[0].data);
    expect(rows.map((r) => [r.sourceKey, r.amount, r.transactionId])).toEqual([
      [`signup:${ME}`, S.signup, "tx-1"],
      [`achievement:${ME}:oracle`, S.achievement, "tx-1"],
      ["sheet:s1:home", S.sheet, "tx-1"],
    ]);
    expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBe(total);
    expect(db.proWallet.update).toHaveBeenCalledWith({
      where: { userId: ME },
      data: { crowns: { increment: total } },
    });
  });

  it("second passage : rien n'est dû, rien n'est écrit", async () => {
    db.leagueMatchSheet.findMany.mockResolvedValue([leagueSheet("s1", "season-1", ME, OTHER)]);
    db.crownsReward.findMany.mockResolvedValue([
      { sourceKey: "sheet:s1:home" },
      { sourceKey: `signup:${ME}` },
    ]);
    const outcome = await reconcileCrownsRewards(ME);
    expect(outcome.credited).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.proTransaction.findFirst).not.toHaveBeenCalled();
  });

  it("bonus déjà perçu en Pro League : marqueur à 0, sans opération ni incrément", async () => {
    db.proTransaction.findFirst.mockResolvedValue({ id: "old-bonus" });
    const outcome = await reconcileCrownsRewards(ME);
    expect(outcome).toEqual({ credited: 0, written: 1, conflict: false, skipped: false });
    expect(db.proTransaction.create).not.toHaveBeenCalled();
    expect(db.proWallet.update).not.toHaveBeenCalled();
    expect(db.crownsReward.create.mock.calls[0][0].data).toMatchObject({
      sourceKey: `signup:${ME}`,
      amount: 0,
      transactionId: null,
    });
  });

  it("applique le plafond à partir de ce qui a déjà été versé dans la saison", async () => {
    db.crownsReward.findMany.mockResolvedValue([{ sourceKey: `signup:${ME}` }]);
    db.leagueMatchSheet.findMany.mockResolvedValue([leagueSheet("s9", "season-1", OTHER, ME)]);
    db.crownsReward.groupBy.mockResolvedValue([
      { periodKey: "season:season-1", _sum: { amount: S.seasonSheetCap - 10 } },
    ]);
    const outcome = await reconcileCrownsRewards(ME);
    expect(outcome.credited).toBe(10);
    expect(db.crownsReward.groupBy.mock.calls[0][0].where).toEqual({
      userId: ME,
      periodKey: { in: ["season:season-1"] },
    });
    expect(db.crownsReward.create.mock.calls[0][0].data).toMatchObject({
      sourceKey: "sheet:s9:away",
      amount: 10,
      baseAmount: S.sheet,
    });
  });

  it("passage concurrent (P2002) : annulé sans erreur", async () => {
    db.$transaction.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const outcome = await reconcileCrownsRewards(ME);
    expect(outcome).toEqual({ credited: 0, written: 0, conflict: true, skipped: false });
  });

  it("toute autre erreur remonte à l'appelant", async () => {
    db.$transaction.mockRejectedValue(new Error("db down"));
    await expect(reconcileCrownsRewards(ME)).rejects.toThrow("db down");
  });

  describe("débounce", () => {
    const previous = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = previous;
    });

    it("en production, un second passage dans la minute est sauté", async () => {
      process.env.NODE_ENV = "production";
      await reconcileCrownsRewards(ME, 1_000);
      const second = await reconcileCrownsRewards(ME, 30_000);
      expect(second.skipped).toBe(true);
      expect(db.leagueMatchSheet.findMany).toHaveBeenCalledTimes(1);
      const third = await reconcileCrownsRewards(ME, 62_000);
      expect(third.skipped).toBe(false);
    });

    it("hors production, aucun débounce", async () => {
      process.env.NODE_ENV = "test";
      await reconcileCrownsRewards(ME, 1_000);
      const second = await reconcileCrownsRewards(ME, 1_001);
      expect(second.skipped).toBe(false);
    });
  });
});

describe("loadRewardBreakdowns", () => {
  it("ne lit le registre que pour les opérations de passage", async () => {
    const out = await loadRewardBreakdowns([
      { id: "t1", type: "SINK", ref: "dice-theme:glace" },
      { id: "t2", type: "REWARD", ref: "first_signup" },
    ]);
    expect(out.size).toBe(0);
    expect(db.crownsReward.findMany).not.toHaveBeenCalled();
  });

  it("détaille chaque passage, plafonnées comprises", async () => {
    db.crownsReward.findMany.mockResolvedValue([
      { transactionId: "t-a", kind: "sheet", amount: 25, baseAmount: 25 },
      { transactionId: "t-a", kind: "sheet", amount: 0, baseAmount: 25 },
      { transactionId: "t-a", kind: "achievement", amount: 50, baseAmount: 50 },
      { transactionId: "t-b", kind: "signup", amount: 250, baseAmount: 250 },
    ]);
    const out = await loadRewardBreakdowns([
      { id: "t-a", type: "REWARD", ref: "rewards:1" },
      { id: "t-b", type: "REWARD", ref: "rewards:2" },
    ]);
    expect(db.crownsReward.findMany.mock.calls[0][0].where).toEqual({
      transactionId: { in: ["t-a", "t-b"] },
    });
    expect(out.get("t-a")).toEqual({ sheets: 1, achievements: 1, signup: false, capped: 1 });
    expect(out.get("t-b")).toEqual({ sheets: 0, achievements: 0, signup: true, capped: 0 });
  });
});

describe("listCrownsRewardsForAdmin", () => {
  it("coach inconnu : null, sans lire le registre", async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect(await listCrownsRewardsForAdmin("ghost")).toBeNull();
    expect(db.crownsReward.findMany).not.toHaveBeenCalled();
  });

  it("50 plus récentes, dates en ISO", async () => {
    db.user.findUnique.mockResolvedValue({ id: ME });
    db.crownsReward.findMany.mockResolvedValue([
      {
        id: "r1",
        sourceKey: "sheet:s1:home",
        kind: "sheet",
        periodKey: "season:x",
        amount: 0,
        baseAmount: 25,
        createdAt: new Date("2026-10-06T10:00:00Z"),
      },
    ]);
    const rows = await listCrownsRewardsForAdmin(ME);
    expect(rows).toEqual([
      expect.objectContaining({ id: "r1", amount: 0, createdAt: "2026-10-06T10:00:00.000Z" }),
    ]);
    expect(db.crownsReward.findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: ME },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });
});
