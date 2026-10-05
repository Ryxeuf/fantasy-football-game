/**
 * Catalogue des thèmes de dés « base d'abord » : la table surcharge le
 * compilé, ne l'étend jamais, et une ligne incohérente n'est jamais servie.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: { diceTheme: { findMany: vi.fn() } },
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { DEFAULT_DICE_THEME_ID, DICE_THEME_CATALOGUE } from "./dice-theme-catalogue";
import {
  entryToRow,
  invalidateDiceThemeCache,
  loadDiceThemeCatalogue,
  mergeDiceThemeRows,
  type DiceThemeRow,
} from "./dice-theme-repository";

const findMany = prisma.diceTheme.findMany as unknown as ReturnType<typeof vi.fn>;

function row(slug: string, over: Partial<DiceThemeRow> = {}): DiceThemeRow {
  const compiled = DICE_THEME_CATALOGUE.find((t) => t.id === slug)!;
  return { slug, ...entryToRow(compiled), ...over };
}

beforeEach(() => {
  vi.resetAllMocks();
  invalidateDiceThemeCache();
});

describe("mergeDiceThemeRows", () => {
  it("sans ligne : le catalogue compilé tel quel", () => {
    expect(mergeDiceThemeRows([])).toEqual(DICE_THEME_CATALOGUE);
  });

  it("une ligne surcharge prix, vente, libellés et ordre", () => {
    const merged = mergeDiceThemeRows([
      row("orques", { priceCrowns: 999, enabled: false, nameFr: "Peaux-Vertes", sortOrder: 0 }),
    ]);
    const orques = merged.find((t) => t.id === "orques")!;
    expect(orques).toMatchObject({ priceCrowns: 999, enabled: false, sortOrder: 0 });
    expect(orques.name.fr).toBe("Peaux-Vertes");
    // Re-trié : à sortOrder égal (0), départage par nom (« Original… » < « Peaux-Vertes »).
    expect(merged.map((t) => t.id).slice(0, 2)).toEqual([DEFAULT_DICE_THEME_ID, "orques"]);
  });

  it("libellés vides => ceux du compilé", () => {
    const merged = mergeDiceThemeRows([row("nains", { nameFr: "  ", descriptionEn: "" })]);
    const nains = merged.find((t) => t.id === "nains")!;
    expect(nains.name.fr).toBe("Nains");
    expect(nains.description.en).toBe("In Dwarves team colours.");
  });

  it("le défaut reste gratuit et en service quoi qu'en dise la base", () => {
    const merged = mergeDiceThemeRows([row(DEFAULT_DICE_THEME_ID, { priceCrowns: 50, enabled: false })]);
    const def = merged.find((t) => t.id === DEFAULT_DICE_THEME_ID)!;
    expect(def.priceCrowns).toBeNull();
    expect(def.enabled).toBe(true);
  });

  it("ligne au prix incohérent ignorée (compilé servi), slug inconnu ignoré", () => {
    const ignored: string[] = [];
    const merged = mergeDiceThemeRows(
      [row("orques", { priceCrowns: -5 }), { ...row("nains"), slug: "ghost" }],
      DICE_THEME_CATALOGUE,
      (slug) => ignored.push(slug),
    );
    expect(merged.find((t) => t.id === "orques")!.priceCrowns).toBe(400);
    expect(merged.some((t) => t.id === "ghost")).toBe(false);
    expect(ignored.sort()).toEqual(["ghost", "orques"]);
  });
});

describe("loadDiceThemeCatalogue", () => {
  it("lit la base", async () => {
    findMany.mockResolvedValue([row("glace", { priceCrowns: 10 })]);
    const catalogue = await loadDiceThemeCatalogue();
    expect(catalogue.find((t) => t.id === "glace")!.priceCrowns).toBe(10);
  });

  it("base indisponible : repli compilé journalisé, jamais d'erreur", async () => {
    findMany.mockRejectedValue(new Error("down"));
    await expect(loadDiceThemeCatalogue()).resolves.toEqual(DICE_THEME_CATALOGUE);
    expect(serverLog.error).toHaveBeenCalled();
  });

  it("le repli d'une erreur n'est pas mis en cache : la base revenue est relue", async () => {
    findMany.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce([row("glace", { priceCrowns: 10 })]);
    await loadDiceThemeCatalogue();
    const catalogue = await loadDiceThemeCatalogue();
    expect(catalogue.find((t) => t.id === "glace")!.priceCrowns).toBe(10);
  });
});
