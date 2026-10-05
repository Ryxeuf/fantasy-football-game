import { describe, expect, it } from "vitest";
import type { AdminDiceTheme } from "../../lib/admin-dice-themes";
import { filterAdminDiceThemes, summarizeDiceThemes } from "./summary";

function theme(id: string, over: Partial<AdminDiceTheme> = {}): AdminDiceTheme {
  return {
    id,
    collection: "team",
    priceCrowns: 400,
    enabled: true,
    sortOrder: 0,
    name: { fr: id, en: id },
    description: { fr: "", en: "" },
    isDefault: false,
    inDatabase: true,
    compiled: { priceCrowns: 400, enabled: true, name: { fr: id, en: id } },
    stats: { owners: 0, purchases: 0, gifts: 0, selectedBy: 0, revenueCrowns: 0 },
    ...over,
  };
}

const THEMES = [
  theme("nuffle", { collection: "classic", priceCrowns: null, isDefault: true, name: { fr: "Original", en: "Original" } }),
  theme("glace", { collection: "classic", priceCrowns: 250, stats: { owners: 2, purchases: 1, gifts: 1, selectedBy: 1, revenueCrowns: 250 } }),
  theme("elus-chaos", { name: { fr: "Élus du Chaos", en: "Chaos Chosen" }, enabled: false, stats: { owners: 3, purchases: 3, gifts: 0, selectedBy: 2, revenueCrowns: 1200 } }),
];

describe("admin thèmes de dés — résumé et filtres", () => {
  it("totalise thèmes, mises en vente, acquisitions, choix et recette", () => {
    expect(summarizeDiceThemes(THEMES)).toEqual({
      total: 3,
      onSale: 1,
      owners: 5,
      selectedBy: 3,
      revenueCrowns: 1450,
    });
  });

  it("filtre par collection et par vente", () => {
    expect(filterAdminDiceThemes(THEMES, "classic", "").map((t) => t.id)).toEqual(["nuffle", "glace"]);
    expect(filterAdminDiceThemes(THEMES, "on-sale", "").map((t) => t.id)).toEqual(["glace"]);
    expect(filterAdminDiceThemes(THEMES, "off-sale", "").map((t) => t.id)).toEqual(["elus-chaos"]);
  });

  it("recherche sans casse ni accents, sur l'id et les noms", () => {
    expect(filterAdminDiceThemes(THEMES, "all", "elus").map((t) => t.id)).toEqual(["elus-chaos"]);
    expect(filterAdminDiceThemes(THEMES, "all", "CHOSEN").map((t) => t.id)).toEqual(["elus-chaos"]);
    expect(filterAdminDiceThemes(THEMES, "all", "glac").map((t) => t.id)).toEqual(["glace"]);
  });
});
