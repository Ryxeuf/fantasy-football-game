/**
 * Rattrapage automatique des sorties d'une saison : balayage, marquage,
 * idempotence et tolérance aux pannes.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueMatchSheet: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("./league-sheet-casualty-resync", () => ({
  resyncValidatedSheetCasualties: vi.fn(),
}));

import { prisma } from "../prisma";
import { resyncValidatedSheetCasualties } from "./league-sheet-casualty-resync";
import { CASUALTY_RULE_VERSION } from "./league-match-summary";
import { healSeasonCasualties } from "./league-season-casualty-heal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockResync = vi.mocked(resyncValidatedSheetCasualties);

/** Un plan de resynchronisation minimal, `changed` au choix. */
function outcome(changed: boolean) {
  return {
    skipped: false as const,
    applied: changed,
    plan: {
      pairingId: "pair-1",
      matchId: "m1",
      casualties: {
        before: { home: 5, away: 0 },
        after: { home: 4, away: 0 },
      },
      players: [],
      bonus: null,
      changed,
      snapshot: {} as never,
    },
  };
}

describe("healSeasonCasualties", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.leagueMatchSheet.update.mockResolvedValue({});
  });

  it("ne fait rien quand aucune feuille n'est périmée", async () => {
    mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([]);
    const report = await healSeasonCasualties("S1");
    expect(report).toEqual({ scanned: 0, repaired: 0, marked: 0 });
    expect(mockResync).not.toHaveBeenCalled();
    expect(mockPrisma.leagueMatchSheet.update).not.toHaveBeenCalled();
  });

  // Le balayage ne doit ramener QUE les feuilles validées dont le marqueur
  // manque ou date d'une règle antérieure : après le passage, la lecture du
  // classement ne coûte plus qu'une requête sans résultat.
  it("ne balaie que les feuilles validées au marqueur périmé", async () => {
    mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([]);
    await healSeasonCasualties("S1");
    const where = mockPrisma.leagueMatchSheet.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("validated");
    expect(where.pairing).toEqual({ round: { seasonId: "S1" } });
    expect(where.OR).toEqual([
      { casualtyRuleVersion: null },
      { casualtyRuleVersion: { lt: CASUALTY_RULE_VERSION } },
    ]);
  });

  it("resynchronise puis marque une feuille périmée", async () => {
    mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([
      { id: "sheet-1", pairingId: "pair-1" },
    ]);
    mockResync.mockResolvedValue(outcome(true));

    const report = await healSeasonCasualties("S1");

    expect(mockResync).toHaveBeenCalledWith("pair-1", { apply: true });
    expect(report).toEqual({ scanned: 1, repaired: 1, marked: 1 });
    expect(mockPrisma.leagueMatchSheet.update).toHaveBeenCalledWith({
      where: { id: "sheet-1" },
      data: { casualtyRuleVersion: CASUALTY_RULE_VERSION },
    });
  });

  // Une feuille déjà juste (validée avant la colonne mais après la règle) ne
  // compte pas comme réparée, mais doit quand même être marquée.
  it("marque une feuille déjà à jour sans la compter réparée", async () => {
    mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([
      { id: "sheet-1", pairingId: "pair-1" },
    ]);
    mockResync.mockResolvedValue(outcome(false));

    const report = await healSeasonCasualties("S1");

    expect(report).toEqual({ scanned: 1, repaired: 0, marked: 1 });
    expect(mockPrisma.leagueMatchSheet.update).toHaveBeenCalledTimes(1);
  });

  // Un refus DÉFINITIF (rien ne le fera changer d'avis) est marqué : sinon
  // la feuille serait retentée à chaque consultation du classement.
  it.each(["season-completed", "snapshot-missing", "not-a-league"] as const)(
    "marque une feuille dont le rattrapage est refusé (%s)",
    async (reason) => {
      mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([
        { id: "sheet-1", pairingId: "pair-1" },
      ]);
      mockResync.mockResolvedValue({ skipped: true, reason });

      const report = await healSeasonCasualties("S1");

      expect(report).toEqual({ scanned: 1, repaired: 0, marked: 1 });
    },
  );

  // `sheet-not-validated` n'est PAS définitif : une feuille invalidée peut
  // être revalidée, et c'est la validation qui posera le marqueur.
  it("ne marque pas une feuille non validée", async () => {
    mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([
      { id: "sheet-1", pairingId: "pair-1" },
    ]);
    mockResync.mockResolvedValue({
      skipped: true,
      reason: "sheet-not-validated",
    });

    const report = await healSeasonCasualties("S1");

    expect(report).toEqual({ scanned: 1, repaired: 0, marked: 0 });
    expect(mockPrisma.leagueMatchSheet.update).not.toHaveBeenCalled();
  });

  // Une feuille en échec ne doit ni bloquer les suivantes, ni lever : le
  // classement se sert quand même. Elle reste non marquée, donc retentée.
  it("isole l'échec d'une feuille et poursuit le balayage", async () => {
    mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([
      { id: "sheet-1", pairingId: "pair-1" },
      { id: "sheet-2", pairingId: "pair-2" },
    ]);
    mockResync
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(outcome(true));

    const report = await healSeasonCasualties("S1");

    expect(report).toEqual({ scanned: 2, repaired: 1, marked: 1 });
    expect(mockPrisma.leagueMatchSheet.update).toHaveBeenCalledWith({
      where: { id: "sheet-2" },
      data: { casualtyRuleVersion: CASUALTY_RULE_VERSION },
    });
  });

  // Colonne absente (miroir SQLite d'un test, base pas encore poussée) : on
  // sert le classement tel quel plutôt que de le refuser.
  it("ne lève pas quand le balayage lui-même échoue", async () => {
    mockPrisma.leagueMatchSheet.findMany.mockRejectedValue(
      new Error("no such column"),
    );
    await expect(healSeasonCasualties("S1")).resolves.toEqual({
      scanned: 0,
      repaired: 0,
      marked: 0,
    });
  });

  // Une feuille de coupe n'a pas de `pairingId` de ligue : rien à rattraper.
  it("ignore une ligne sans pairingId de ligue", async () => {
    mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([
      { id: "sheet-cup", pairingId: null },
    ]);
    const report = await healSeasonCasualties("S1");
    expect(report).toEqual({ scanned: 0, repaired: 0, marked: 0 });
    expect(mockResync).not.toHaveBeenCalled();
  });
});
