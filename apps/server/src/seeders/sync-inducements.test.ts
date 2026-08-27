/**
 * Lot 6.1 — le seed du catalogue de Coups de Pouce est « create-if-missing ».
 *
 * La table est lue en priorité : le déploiement doit la peupler, mais un prix
 * corrigé en admin ne doit pas être écrasé au déploiement suivant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    inducement: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../services/inducement-repository", () => ({
  invalidateInducementCache: vi.fn(),
}));

import { INDUCEMENT_CATALOGUE } from "@bb/game-engine";
import { prisma } from "../prisma";
import { invalidateInducementCache } from "../services/inducement-repository";
import { definitionToRow, syncInducements } from "./sync-inducements";

const db = prisma as unknown as {
  inducement: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("syncInducements", () => {
  it("crée tout le catalogue quand la table est vide", async () => {
    db.inducement.findUnique.mockResolvedValue(null);

    const res = await syncInducements({ write: true });

    expect(res.created).toHaveLength(INDUCEMENT_CATALOGUE.length);
    expect(db.inducement.create).toHaveBeenCalledTimes(
      INDUCEMENT_CATALOGUE.length,
    );
    expect(invalidateInducementCache).toHaveBeenCalled();
  });

  it("n'écrase JAMAIS un prix édité en admin sans `force`", async () => {
    db.inducement.findUnique.mockResolvedValue({ id: "i1" });

    const res = await syncInducements({ write: true });

    expect(res.created).toHaveLength(0);
    expect(res.updated).toHaveLength(0);
    expect(res.skipped).toHaveLength(INDUCEMENT_CATALOGUE.length);
    expect(db.inducement.update).not.toHaveBeenCalled();
  });

  it("`force` réécrit depuis le catalogue du moteur", async () => {
    db.inducement.findUnique.mockResolvedValue({ id: "i1" });

    const res = await syncInducements({ write: true, force: true });

    expect(res.updated).toHaveLength(INDUCEMENT_CATALOGUE.length);
    expect(db.inducement.update).toHaveBeenCalled();
  });

  it("dry-run par défaut", async () => {
    db.inducement.findUnique.mockResolvedValue(null);

    const res = await syncInducements();

    expect(res.write).toBe(false);
    expect(res.created.length).toBeGreaterThan(0);
    expect(db.inducement.create).not.toHaveBeenCalled();
  });
});

describe("definitionToRow", () => {
  it("aplatit le plafond majoré en deux colonnes", () => {
    const bribe = INDUCEMENT_CATALOGUE.find((d) => d.slug === "bribe")!;
    expect(definitionToRow(bribe, 7)).toMatchObject({
      baseCost: bribe.baseCost,
      discountRule: "chantage_et_corruption",
      discountCost: 50_000,
      ruleMaxRule: "chantage_et_corruption",
      ruleMaxQuantity: 6,
      sortOrder: 7,
    });
  });

  it("sérialise les règles requises en CSV", () => {
    const plague = INDUCEMENT_CATALOGUE.find(
      (d) => d.slug === "plague_doctor",
    )!;
    expect(definitionToRow(plague, 0)).toMatchObject({
      requiresAnyRule: "favori_de",
      requiresRoster: "nurgle",
    });
  });

  it("reporte la condition d'apothicaire", () => {
    const apo = INDUCEMENT_CATALOGUE.find(
      (d) => d.slug === "wandering_apothecary",
    )!;
    expect(definitionToRow(apo, 0)).toMatchObject({
      requiresApothecary: true,
    });
  });
});
