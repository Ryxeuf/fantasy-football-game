import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    proWallet: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      aggregate: vi.fn(),
    },
    proTransaction: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    featureFlag: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  CREATE_MISSING_BATCH,
  CrownsAdminError,
  createCoachWallet,
  createMissingWallets,
  getCrownsOverview,
  listCoachWallets,
  listCrownsLedger,
  summarizeCrownsFlows,
  walletStatusWhere,
} from "./crowns-admin";
import { PRO_TX_TYPES } from "./pro-wallet";
import { CROWNS_TX_TYPES } from "../schemas/crowns-admin.schemas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;
const D = new Date("2026-10-05T10:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("types du journal", () => {
  it("le schéma admin et le service wallet listent les mêmes types", () => {
    expect([...CROWNS_TX_TYPES]).toEqual([...PRO_TX_TYPES]);
  });
});

describe("walletStatusWhere", () => {
  it("traduit le filtre en relation 1-1 Prisma", () => {
    expect(walletStatusWhere("all")).toEqual({});
    expect(walletStatusWhere("with")).toEqual({ proWallet: { isNot: null } });
    expect(walletStatusWhere("without")).toEqual({ proWallet: { is: null } });
  });
});

describe("listCoachWallets", () => {
  it("distingue les coachs avec et sans wallet, compteurs sur la recherche", async () => {
    db.user.count
      .mockResolvedValueOnce(1) // total filtré
      .mockResolvedValueOnce(3) // tous
      .mockResolvedValueOnce(2); // avec wallet
    db.user.findMany.mockResolvedValueOnce([
      { id: "u1", email: "a@x", coachName: "A", createdAt: D, proWallet: null },
    ]);

    const page = await listCoachWallets({ status: "without", search: "a", page: 2, limit: 10 });

    expect(page.counts).toEqual({ all: 3, with: 2, without: 1 });
    expect(page.items[0].wallet).toBeNull();
    const args = db.user.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ proWallet: { is: null } });
    expect(args.where.OR).toHaveLength(2);
    expect(args.skip).toBe(10);
    // Les compteurs ignorent le filtre de statut, pas la recherche.
    expect(db.user.count.mock.calls[1][0].where).not.toHaveProperty("proWallet");
    expect(db.user.count.mock.calls[1][0].where.OR).toHaveLength(2);
  });

  it("expose solde, dates et nombre de transactions d'un wallet", async () => {
    db.user.count.mockResolvedValue(1);
    db.user.findMany.mockResolvedValueOnce([
      {
        id: "u1",
        email: "a@x",
        coachName: "A",
        createdAt: D,
        proWallet: { crowns: 250, createdAt: D, updatedAt: D, _count: { transactions: 4 } },
      },
    ]);
    const page = await listCoachWallets({ status: "all", page: 1, limit: 25 });
    expect(page.items[0].wallet).toEqual({
      crowns: 250,
      createdAt: D.toISOString(),
      updatedAt: D.toISOString(),
      transactions: 4,
    });
  });
});

describe("createCoachWallet", () => {
  it("crée un wallet à 0 sans transaction", async () => {
    db.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    db.proWallet.findUnique.mockResolvedValueOnce(null);
    db.proWallet.create.mockResolvedValueOnce({ userId: "u1", crowns: 0, createdAt: D });

    const r = await createCoachWallet("u1");

    expect(r).toEqual({ created: true, wallet: { userId: "u1", crowns: 0, createdAt: D.toISOString() } });
    expect(db.proWallet.create.mock.calls[0][0].data).toEqual({ userId: "u1" });
  });

  it("idempotent : un wallet existant est renvoyé tel quel", async () => {
    db.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    db.proWallet.findUnique.mockResolvedValueOnce({ userId: "u1", crowns: 90, createdAt: D });
    const r = await createCoachWallet("u1");
    expect(r.created).toBe(false);
    expect(r.wallet.crowns).toBe(90);
    expect(db.proWallet.create).not.toHaveBeenCalled();
  });

  it("course : P2002 => wallet relu, pas d'erreur", async () => {
    db.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    db.proWallet.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: "u1", crowns: 0, createdAt: D });
    db.proWallet.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    const r = await createCoachWallet("u1");
    expect(r.created).toBe(false);
  });

  it("coach inconnu => CrownsAdminError user-not-found", async () => {
    db.user.findUnique.mockResolvedValueOnce(null);
    await expect(createCoachWallet("ghost")).rejects.toMatchObject({
      name: "CrownsAdminError",
      code: "user-not-found",
    });
    await expect(createCoachWallet("ghost")).rejects.toBeInstanceOf(CrownsAdminError);
  });
});

describe("createMissingWallets", () => {
  it("crée par lots jusqu'à épuisement et compte le reste", async () => {
    const full = Array.from({ length: CREATE_MISSING_BATCH }, (_, i) => ({ id: `u${i}` }));
    db.user.findMany.mockResolvedValueOnce(full).mockResolvedValueOnce([{ id: "last" }]);
    db.proWallet.createMany
      .mockResolvedValueOnce({ count: CREATE_MISSING_BATCH })
      .mockResolvedValueOnce({ count: 1 });
    db.user.count.mockResolvedValueOnce(0);

    const r = await createMissingWallets();

    expect(r).toEqual({ created: CREATE_MISSING_BATCH + 1, remaining: 0 });
    expect(db.proWallet.createMany.mock.calls[1][0]).toEqual({ data: [{ userId: "last" }] });
    // Jamais `skipDuplicates` : absent du miroir SQLite.
    expect(db.proWallet.createMany.mock.calls[0][0]).not.toHaveProperty("skipDuplicates");
  });

  it("rien à faire : aucun createMany", async () => {
    db.user.findMany.mockResolvedValueOnce([]);
    db.user.count.mockResolvedValueOnce(0);
    expect(await createMissingWallets()).toEqual({ created: 0, remaining: 0 });
    expect(db.proWallet.createMany).not.toHaveBeenCalled();
  });

  it("lot en conflit (P2002) => rejoué coach par coach", async () => {
    db.user.findMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
    db.proWallet.createMany.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    db.user.findUnique.mockResolvedValue({ id: "x" });
    // a : créé entre-temps par un autre ; b : à créer.
    db.proWallet.findUnique
      .mockResolvedValueOnce({ userId: "a", crowns: 0, createdAt: D })
      .mockResolvedValueOnce(null);
    db.proWallet.create.mockResolvedValueOnce({ userId: "b", crowns: 0, createdAt: D });
    db.user.count.mockResolvedValueOnce(0);

    expect(await createMissingWallets()).toEqual({ created: 1, remaining: 0 });
  });
});

describe("createMissingWallets — compte supprimé en cours de lot", () => {
  it("P2003 => rejoué coach par coach, le compte disparu est ignoré", async () => {
    db.user.findMany.mockResolvedValueOnce([{ id: "gone" }, { id: "b" }]);
    db.proWallet.createMany.mockRejectedValueOnce(Object.assign(new Error("fk"), { code: "P2003" }));
    db.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "b" });
    db.proWallet.findUnique.mockResolvedValueOnce(null);
    db.proWallet.create.mockResolvedValueOnce({ userId: "b", crowns: 0, createdAt: D });
    db.user.count.mockResolvedValueOnce(0);

    expect(await createMissingWallets()).toEqual({ created: 1, remaining: 0 });
  });

  it("autre erreur Prisma => propagée", async () => {
    db.user.findMany.mockResolvedValueOnce([{ id: "a" }]);
    db.proWallet.createMany.mockRejectedValueOnce(Object.assign(new Error("boom"), { code: "P1001" }));
    await expect(createMissingWallets()).rejects.toThrow("boom");
  });
});

describe("summarizeCrownsFlows", () => {
  it("fusionne crédits et débits d'un même type, trie par volume", () => {
    const flows = summarizeCrownsFlows([
      { type: "SINK", positive: false, count: 2, sum: -650 },
      { type: "ADMIN_ADJUST", positive: true, count: 3, sum: 3000 },
      { type: "ADMIN_ADJUST", positive: false, count: 1, sum: -100 },
      { type: "DAILY", positive: true, count: 4, sum: 200 },
    ]);
    expect(flows).toEqual([
      { type: "ADMIN_ADJUST", count: 4, credited: 3000, debited: 100, net: 2900 },
      { type: "SINK", count: 2, credited: 0, debited: 650, net: -650 },
      { type: "DAILY", count: 4, credited: 200, debited: 0, net: 200 },
    ]);
  });
});

describe("getCrownsOverview", () => {
  function mockOverview(flag: unknown) {
    db.proWallet.aggregate.mockResolvedValueOnce({ _sum: { crowns: 1600 }, _count: { _all: 3 } });
    db.user.count.mockResolvedValueOnce(2);
    db.proTransaction.groupBy.mockResolvedValue([]);
    db.proWallet.findMany.mockResolvedValueOnce([
      { userId: "u1", crowns: 1000, user: { coachName: "A", email: "a@x" } },
    ]);
    db.featureFlag.findUnique.mockResolvedValueOnce(flag);
  }

  it("masse, wallets, coachs sans wallet, top et flag", async () => {
    mockOverview({ enabled: false, _count: { userOverrides: 2 } });
    const o = await getCrownsOverview(30, D);
    expect(o).toMatchObject({
      supply: 1600,
      wallets: 3,
      usersWithoutWallet: 2,
      days: 30,
      topHolders: [{ userId: "u1", coachName: "A", email: "a@x", crowns: 1000 }],
      flag: { exists: true, enabled: false, userOverrides: 2 },
    });
    // Fenêtre récente : 4 groupBy (tous / récents × crédits / débits).
    expect(db.proTransaction.groupBy).toHaveBeenCalledTimes(4);
    const recent = db.proTransaction.groupBy.mock.calls.find(
      (c: Array<{ where: { createdAt?: unknown } }>) => c[0].where.createdAt,
    );
    expect(recent[0].where.createdAt.gte).toEqual(new Date("2026-09-05T10:00:00Z"));
  });

  it("ligne du flag absente => exists: false (rien à allumer dans l'UI)", async () => {
    mockOverview(null);
    const o = await getCrownsOverview(7, D);
    expect(o.flag).toEqual({ exists: false, enabled: false, userOverrides: 0 });
  });
});

describe("listCrownsLedger", () => {
  it("filtre par type et par coach, aplatit l'auteur", async () => {
    db.proTransaction.count.mockResolvedValueOnce(1);
    db.proTransaction.findMany.mockResolvedValueOnce([
      {
        id: "t1",
        type: "SINK",
        amount: -400,
        ref: "dice-theme:orques",
        createdAt: D,
        wallet: { userId: "u1", user: { coachName: "A", email: "a@x" } },
      },
    ]);
    const page = await listCrownsLedger({ type: "SINK", search: "a", page: 1, limit: 50 });
    expect(page.items[0]).toEqual({
      id: "t1",
      type: "SINK",
      amount: -400,
      ref: "dice-theme:orques",
      createdAt: D.toISOString(),
      user: { id: "u1", coachName: "A", email: "a@x" },
    });
    const where = db.proTransaction.findMany.mock.calls[0][0].where;
    expect(where.type).toBe("SINK");
    expect(where.wallet.user.OR).toHaveLength(2);
  });

  it("sans filtre : aucun where", async () => {
    db.proTransaction.count.mockResolvedValueOnce(0);
    db.proTransaction.findMany.mockResolvedValueOnce([]);
    await listCrownsLedger({ page: 1, limit: 50 });
    expect(db.proTransaction.findMany.mock.calls[0][0].where).toEqual({});
  });
});
