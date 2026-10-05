import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => {
  const prisma: Record<string, any> = {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
    userDiceTheme: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), groupBy: vi.fn() },
    diceTheme: { findMany: vi.fn(), upsert: vi.fn() },
    proWallet: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    proTransaction: { create: vi.fn(), findMany: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return { prisma };
});
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { prisma } from "../prisma";
import {
  DiceThemeAdminError,
  getCoachCosmetics,
  grantDiceTheme,
  listCoachCosmetics,
  listDiceThemesForAdmin,
  resetDiceTheme,
  revokeDiceTheme,
  setCoachDiceTheme,
  updateDiceTheme,
} from "./dice-theme-admin";
import { invalidateDiceThemeCache } from "./dice-theme-repository";

type Mock = ReturnType<typeof vi.fn>;
const db = prisma as unknown as Record<string, Record<string, Mock>> & { $transaction: Mock };

const USER = { id: "u1", email: "coach@x.fr", coachName: "Coach", diceTheme: null as string | null };

beforeEach(() => {
  vi.resetAllMocks();
  invalidateDiceThemeCache();
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  db.diceTheme.findMany.mockResolvedValue([]);
  db.userDiceTheme.groupBy.mockResolvedValue([]);
  db.user.groupBy.mockResolvedValue([]);
  db.userDiceTheme.findMany.mockResolvedValue([]);
  db.proTransaction.findMany.mockResolvedValue([]);
  db.proWallet.findUnique.mockResolvedValue({ crowns: 0 });
  db.user.findUnique.mockResolvedValue(USER);
  db.userDiceTheme.deleteMany.mockResolvedValue({ count: 1 });
});

/** Ligne d'acquisition complète (servie à la fois à la possession et au détail). */
function acquired(themeId: string, source = "purchase", priceCrowns: number | null = 400) {
  return { themeId, source, priceCrowns, grantedById: null, createdAt: new Date("2026-10-01") };
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(DiceThemeAdminError);
  await expect(p).rejects.toMatchObject({ code });
}

describe("catalogue admin", () => {
  it("liste les 36 thèmes avec statistiques agrégées (groupBy, pas de N+1)", async () => {
    db.diceTheme.findMany.mockResolvedValue([{ slug: "orques" }]);
    db.userDiceTheme.groupBy.mockResolvedValue([
      { themeId: "orques", source: "purchase", _count: { _all: 3 }, _sum: { priceCrowns: 1200 } },
      { themeId: "orques", source: "admin_grant", _count: { _all: 1 }, _sum: { priceCrowns: null } },
    ]);
    db.user.groupBy.mockResolvedValue([{ diceTheme: "orques", _count: { _all: 2 } }]);
    const themes = await listDiceThemesForAdmin();
    expect(themes).toHaveLength(36);
    const orques = themes.find((t) => t.id === "orques")!;
    expect(orques.inDatabase).toBe(true);
    expect(orques.stats).toEqual({ owners: 4, purchases: 3, gifts: 1, selectedBy: 2, revenueCrowns: 1200 });
    expect(themes.find((t) => t.id === "nuffle")!).toMatchObject({ isDefault: true, inDatabase: false });
  });

  it("édite un thème : ligne créée depuis le compilé + patch", async () => {
    await updateDiceTheme("orques", { priceCrowns: 999, enabled: false });
    expect(db.diceTheme.upsert).toHaveBeenCalledWith({
      where: { slug: "orques" },
      create: expect.objectContaining({ slug: "orques", nameFr: "Orques", priceCrowns: 999, enabled: false }),
      update: { priceCrowns: 999, enabled: false },
    });
  });

  it("le défaut ne devient ni payant ni retiré", async () => {
    await expectCode(updateDiceTheme("nuffle", { priceCrowns: 10 }), "default-theme-locked");
    await expectCode(updateDiceTheme("nuffle", { enabled: false }), "default-theme-locked");
    // Les libellés, eux, se corrigent.
    await updateDiceTheme("nuffle", { nameFr: "Dé de Nuffle" });
    expect(db.diceTheme.upsert).toHaveBeenCalledTimes(1);
  });

  it("thème inconnu : 404 métier, aucune écriture", async () => {
    await expectCode(updateDiceTheme("ghost", { enabled: false }), "unknown-theme");
    await expectCode(resetDiceTheme("ghost"), "unknown-theme");
    expect(db.diceTheme.upsert).not.toHaveBeenCalled();
  });

  it("réinitialise depuis le compilé", async () => {
    await resetDiceTheme("glace");
    expect(db.diceTheme.upsert).toHaveBeenCalledWith({
      where: { slug: "glace" },
      create: expect.objectContaining({ slug: "glace", priceCrowns: 250, enabled: true }),
      update: expect.objectContaining({ priceCrowns: 250, enabled: true, nameFr: "Glace" }),
    });
  });
});

describe("coachs", () => {
  it("liste paginée : solde, thèmes acquis, préférence", async () => {
    db.user.count.mockResolvedValue(1);
    db.user.findMany.mockResolvedValue([
      { ...USER, diceTheme: "orques", proWallet: { crowns: 150 }, _count: { diceThemes: 2 } },
    ]);
    const page = await listCoachCosmetics({ search: "coa", page: 2, limit: 10 });
    expect(page).toMatchObject({ total: 1, page: 2, limit: 10 });
    expect(page.items[0]).toEqual({
      id: "u1",
      email: "coach@x.fr",
      coachName: "Coach",
      crowns: 150,
      acquiredThemes: 2,
      diceTheme: "orques",
    });
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
  });

  it("détail : thème effectif, acquisitions, possession par thème", async () => {
    db.user.findUnique.mockResolvedValue({ ...USER, diceTheme: "orques" });
    db.userDiceTheme.findMany.mockResolvedValue([
      { themeId: "orques", source: "purchase", priceCrowns: 400, grantedById: null, createdAt: new Date("2026-10-01") },
    ]);
    db.proWallet.findUnique.mockResolvedValue({ crowns: 600 });
    const d = await getCoachCosmetics("u1");
    expect(d.crowns).toBe(600);
    expect(d.effectiveThemeId).toBe("orques");
    expect(d.acquisitions[0]).toMatchObject({ themeId: "orques", source: "purchase", known: true });
    expect(d.themes.find((t) => t.id === "orques")!.owned).toBe(true);
    expect(d.themes.find((t) => t.id === "nains")!.owned).toBe(false);
  });

  it("coach inconnu : user-not-found", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expectCode(getCoachCosmetics("ghost"), "user-not-found");
  });

  it("offre un thème (admin_grant, sans débit)", async () => {
    await grantDiceTheme("u1", "nains", "admin-1");
    expect(db.userDiceTheme.create).toHaveBeenCalledWith({
      data: { userId: "u1", themeId: "nains", source: "admin_grant", priceCrowns: null, grantedById: "admin-1" },
    });
    expect(db.proWallet.update).not.toHaveBeenCalled();
  });

  it("cadeau refusé : défaut, inconnu, déjà acquis (P2002)", async () => {
    await expectCode(grantDiceTheme("u1", "nuffle", "a"), "theme-already-owned");
    await expectCode(grantDiceTheme("u1", "ghost", "a"), "unknown-theme");
    db.userDiceTheme.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await expectCode(grantDiceTheme("u1", "nains", "a"), "theme-already-owned");
  });

  it("retire un achat AVEC remboursement et remet la préférence au défaut", async () => {
    db.user.findUnique.mockResolvedValue({ ...USER, diceTheme: "orques" });
    db.userDiceTheme.findUnique.mockResolvedValue({ id: "r1", source: "purchase", priceCrowns: 400 });
    db.userDiceTheme.findMany.mockResolvedValue([acquired("orques")]);
    db.proWallet.upsert.mockResolvedValue({ userId: "u1", crowns: 0 });
    db.proWallet.findUnique.mockResolvedValue({ crowns: 0 });
    db.proWallet.update.mockResolvedValue({ crowns: 400 });
    const { refunded } = await revokeDiceTheme("u1", "orques", { refund: true });
    expect(refunded).toBe(400);
    expect(db.userDiceTheme.deleteMany).toHaveBeenCalledWith({ where: { id: "r1" } });
    expect(db.proTransaction.create).toHaveBeenCalledWith({
      data: { walletId: "u1", type: "ADMIN_REFUND", amount: 400, ref: "dice-theme:orques" },
    });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { diceTheme: null } });
  });

  it("retire un cadeau : jamais de remboursement, préférence intacte si non choisie", async () => {
    db.userDiceTheme.findUnique.mockResolvedValue({ id: "r2", source: "admin_grant", priceCrowns: null });
    const { refunded } = await revokeDiceTheme("u1", "nains", { refund: true });
    expect(refunded).toBe(0);
    expect(db.proTransaction.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("révocation concurrente : la ligne déjà partie => theme-not-acquired, pas de remboursement", async () => {
    db.userDiceTheme.findUnique.mockResolvedValue({ id: "r1", source: "purchase", priceCrowns: 400 });
    db.userDiceTheme.findMany.mockResolvedValue([acquired("orques")]);
    db.proWallet.upsert.mockResolvedValue({ userId: "u1", crowns: 0 });
    db.userDiceTheme.deleteMany.mockResolvedValue({ count: 0 });
    await expectCode(revokeDiceTheme("u1", "orques", { refund: true }), "theme-not-acquired");
    expect(db.proTransaction.create).not.toHaveBeenCalled();
  });

  it("retrait d'un thème non acquis : theme-not-acquired", async () => {
    db.userDiceTheme.findUnique.mockResolvedValue(null);
    await expectCode(revokeDiceTheme("u1", "nains", { refund: false }), "theme-not-acquired");
  });

  it("choisit le thème d'un coach s'il le possède, ou le remet au défaut", async () => {
    await expectCode(setCoachDiceTheme("u1", "nains"), "theme-not-owned");
    await expectCode(setCoachDiceTheme("u1", "ghost"), "unknown-theme");
    db.userDiceTheme.findMany.mockResolvedValue([acquired("nains", "admin_grant", null)]);
    await setCoachDiceTheme("u1", "nains");
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { diceTheme: "nains" } });
    await setCoachDiceTheme("u1", null);
    expect(db.user.update).toHaveBeenLastCalledWith({ where: { id: "u1" }, data: { diceTheme: null } });
  });
});
