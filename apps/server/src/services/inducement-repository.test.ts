/**
 * Lot 6.1 — le catalogue de Coups de Pouce vient de la base.
 *
 * Prix, plafonds, remises et conditions vivaient dans `core/inducements.ts` :
 * corriger un prix demandait un déploiement, et les trois chemins de jeu
 * (en ligne, local, feuille de ligue) lisaient le même catalogue figé.
 * Ce fichier verrouille la lecture DB-first, le repli et le refus des lignes
 * incohérentes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: { inducement: { findMany: vi.fn() } },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

import {
  canPurchaseInducement,
  getInducementCost,
  getInducementMaxQuantity,
  INDUCEMENT_CATALOGUE,
  type InducementContext,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import {
  invalidateInducementCache,
  loadInducementCatalogue,
  parseRuleCsv,
  rowToDefinition,
} from "./inducement-repository";

const db = prisma as unknown as {
  inducement: { findMany: ReturnType<typeof vi.fn> };
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    slug: "bribe",
    nameFr: "Pots-de-vin",
    nameEn: "Bribes",
    descriptionFr: "Description en base.",
    descriptionEn: null,
    baseCost: 70_000,
    maxQuantity: 2,
    discountRule: null,
    discountRoster: null,
    discountCost: null,
    ruleMaxRule: null,
    ruleMaxQuantity: null,
    requiresAnyRule: null,
    requiresRoster: null,
    requiresApothecary: false,
    variableCost: false,
    ...overrides,
  };
}

function ctx(
  catalogue: InducementContext["catalogue"],
  overrides: Partial<InducementContext> = {},
): InducementContext {
  return {
    teamId: "A",
    regionalRules: [],
    hasApothecary: false,
    rosterSlug: "human",
    catalogue,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  invalidateInducementCache();
});

describe("loadInducementCatalogue", () => {
  it("sert le prix de la base, pas celui du catalogue compilé", async () => {
    db.inducement.findMany.mockResolvedValue([row()]);

    const catalogue = await loadInducementCatalogue("season_3");
    expect(getInducementCost("bribe", ctx(catalogue))).toBe(70_000);

    const compiled = INDUCEMENT_CATALOGUE.find((d) => d.slug === "bribe")!;
    expect(compiled.baseCost).toBe(100_000);
  });

  it("applique la remise et le plafond majoré déclarés en base", async () => {
    db.inducement.findMany.mockResolvedValue([
      row({
        discountRule: "chantage_et_corruption",
        discountCost: 35_000,
        ruleMaxRule: "chantage_et_corruption",
        ruleMaxQuantity: 5,
      }),
    ]);

    const catalogue = await loadInducementCatalogue("season_3");
    const corrupt = ctx(catalogue, {
      specialRules: ["chantage_et_corruption"],
    });
    expect(getInducementCost("bribe", corrupt)).toBe(35_000);
    expect(getInducementMaxQuantity("bribe", corrupt)).toBe(5);
    expect(getInducementMaxQuantity("bribe", ctx(catalogue))).toBe(2);
  });

  it("évalue les conditions d'achat déclarées en base", async () => {
    db.inducement.findMany.mockResolvedValue([
      row({
        slug: "coup_de_pouce_maison",
        requiresAnyRule: "maitres_de_la_non_vie, deferlement",
        requiresRoster: "necromantic_horror",
      }),
    ]);

    const catalogue = await loadInducementCatalogue("season_3");
    const def = catalogue[0];
    expect(
      canPurchaseInducement(
        def,
        ctx(catalogue, {
          rosterSlug: "necromantic_horror",
          specialRules: ["deferlement"],
        }),
      ),
    ).toBe(true);
    // Le roster ne suffit pas sans l'une des règles requises.
    expect(
      canPurchaseInducement(
        def,
        ctx(catalogue, { rosterSlug: "necromantic_horror" }),
      ),
    ).toBe(false);
  });

  it("ignore une ligne incohérente plutôt que de la servir", async () => {
    db.inducement.findMany.mockResolvedValue([
      row(),
      row({ slug: "cassee", baseCost: -10 }),
      row({ slug: "plafond_nul", maxQuantity: 0 }),
    ]);

    const catalogue = await loadInducementCatalogue("season_3");
    expect(catalogue.map((d) => d.slug)).toEqual(["bribe"]);
  });

  it("retombe sur le catalogue compilé quand la table est vide", async () => {
    db.inducement.findMany.mockResolvedValue([]);
    await expect(loadInducementCatalogue("season_3")).resolves.toBe(
      INDUCEMENT_CATALOGUE,
    );
  });

  it("retombe sur le catalogue compilé quand la base est injoignable", async () => {
    db.inducement.findMany.mockRejectedValue(new Error("no db"));
    await expect(loadInducementCatalogue("season_3")).resolves.toBe(
      INDUCEMENT_CATALOGUE,
    );
  });
});

describe("rowToDefinition", () => {
  it("mappe les conditions et le prix variable", () => {
    const def = rowToDefinition(
      row({
        requiresApothecary: true,
        variableCost: true,
        requiresAnyRule: "a,b",
      }),
    );
    expect(def).toMatchObject({
      requiresApothecary: true,
      variableCost: true,
      requiresAnyRule: ["a", "b"],
    });
  });

  it("n'expose pas une remise sans son coût", () => {
    const def = rowToDefinition(
      row({ discountRule: "chantage_et_corruption", discountCost: null }),
    );
    expect(def).not.toHaveProperty("discountRule");
  });

  it("refuse une ligne sans slug ou au coût négatif", () => {
    expect(rowToDefinition(row({ slug: "" }))).toBeNull();
    expect(rowToDefinition(row({ baseCost: -1 }))).toBeNull();
  });
});

describe("parseRuleCsv", () => {
  it("tolère virgules, espaces et valeurs vides", () => {
    expect(parseRuleCsv(" a, b ,, c ")).toEqual(["a", "b", "c"]);
    expect(parseRuleCsv(null)).toEqual([]);
    expect(parseRuleCsv("")).toEqual([]);
  });
});
