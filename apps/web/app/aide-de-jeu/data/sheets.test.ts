import { describe, expect, it } from "vitest";
import { chapters } from "../../compendium/data";
import {
  SHEETS,
  SheetSourceError,
  getSheet,
  mergeWeatherRows,
  tableFromChapter,
} from "./sheets";

describe("tableFromChapter", () => {
  it("extrait une table existante du compendium", () => {
    const table = tableFromChapter(
      "coup-d-envoi",
      "Événements de coup d'envoi (2D6)",
    );
    expect(table.columns).toEqual(["2D6", "Événement"]);
    expect(table.rows.length).toBeGreaterThan(0);
  });

  it("lève si le caption n'existe pas dans le chapitre", () => {
    expect(() => tableFromChapter("coup-d-envoi", "Table inventée")).toThrow(
      SheetSourceError,
    );
  });

  it("lève si le chapitre n'existe pas", () => {
    expect(() => tableFromChapter("chapitre-inconnu", "Peu importe")).toThrow(
      SheetSourceError,
    );
  });
});

describe("catalogue des fiches", () => {
  it("construit toutes les fiches sans erreur de source", () => {
    expect(SHEETS.length).toBeGreaterThanOrEqual(14);
  });

  it("n'a que des identifiants uniques", () => {
    const ids = SHEETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("donne à chaque fiche au moins un onglet non vide", () => {
    for (const sheet of SHEETS) {
      expect(sheet.variants.length, sheet.id).toBeGreaterThan(0);
      for (const variant of sheet.variants) {
        expect(variant.table.columns.length, `${sheet.id}/${variant.id}`).toBeGreaterThan(0);
        expect(variant.table.rows.length, `${sheet.id}/${variant.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("ne référence que des chapitres existants du compendium", () => {
    const slugs = new Set(chapters.map((c) => c.slug));
    for (const sheet of SHEETS) {
      if (sheet.chapterSlug) expect(slugs.has(sheet.chapterSlug), sheet.id).toBe(true);
    }
  });

  it("aligne le nombre de colonnes et de cellules de chaque ligne", () => {
    for (const sheet of SHEETS) {
      for (const variant of sheet.variants) {
        for (const row of variant.table.rows) {
          expect(row.length, `${sheet.id}/${variant.id}`).toBe(
            variant.table.columns.length,
          );
        }
      }
    }
  });

  it("expose la météo avec un onglet par type de terrain", () => {
    const meteo = getSheet("meteo");
    expect(meteo?.variants.length).toBe(12);
    expect(meteo?.variants[0].label).toBe("Classique");
  });

  it("expose les seize prières à Nuffle", () => {
    const prieres = getSheet("prieres-nuffle");
    expect(prieres?.variants[0].table.rows.length).toBe(16);
  });

  it("renvoie undefined pour un identifiant inconnu", () => {
    expect(getSheet("fiche-qui-n-existe-pas")).toBeUndefined();
  });
});

describe("mergeWeatherRows", () => {
  it("fusionne les scores consécutifs partageant la même condition", () => {
    const rows = mergeWeatherRows({
      2: { condition: "Canicule", description: "a" },
      3: { condition: "Soleil", description: "b" },
      4: { condition: "Parfait", description: "c" },
      5: { condition: "Parfait", description: "c" },
      6: { condition: "Parfait", description: "c" },
      7: { condition: "Parfait", description: "c" },
      8: { condition: "Parfait", description: "c" },
      9: { condition: "Parfait", description: "c" },
      10: { condition: "Parfait", description: "c" },
      11: { condition: "Pluie", description: "d" },
      12: { condition: "Blizzard", description: "e" },
    });

    expect(rows).toEqual([
      ["2", "Canicule", "a"],
      ["3", "Soleil", "b"],
      ["4-10", "Parfait", "c"],
      ["11", "Pluie", "d"],
      ["12", "Blizzard", "e"],
    ]);
  });

  it("garde un score isolé sans le transformer en plage", () => {
    const rows = mergeWeatherRows({
      2: { condition: "A", description: "x" },
      3: { condition: "B", description: "y" },
    });
    expect(rows).toEqual([
      ["2", "A", "x"],
      ["3", "B", "y"],
    ]);
  });
});
