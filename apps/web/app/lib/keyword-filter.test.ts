import { describe, it, expect } from "vitest";
import {
  collectKeywordOptions,
  entityKeywords,
  filterByKeywords,
  normalizeKeyword,
} from "./keyword-filter";

const GRIFF = { keywords: "Humain, Blitzer", keywordsEn: "Human, Blitzer" };
const MORG = { keywords: "Ogre, Gros Bras", keywordsEn: "Ogre, Big Guy" };
const ZUG = { keywords: "Humain, Bloqueur", keywordsEn: "Human, Blocker" };
const SANS_MOTS = { keywords: null, keywordsEn: null };

describe("keyword-filter (helpers partagés positions ↔ star players)", () => {
  it("normalise casse, accents et tirets", () => {
    expect(normalizeKeyword("Homme-Lézard")).toBe(
      normalizeKeyword("homme lezard"),
    );
    expect(normalizeKeyword("  Gros Bras ")).toBe("gros bras");
  });

  it("découpe le CSV selon la langue, avec repli FR", () => {
    expect(entityKeywords(GRIFF, "fr")).toEqual(["Humain", "Blitzer"]);
    expect(entityKeywords(GRIFF, "en")).toEqual(["Human", "Blitzer"]);
    // Pas de traduction disponible ⇒ repli sur le FR.
    expect(entityKeywords({ keywords: "Zoat, Gros Bras" }, "en")).toEqual([
      "Zoat",
      "Gros Bras",
    ]);
    expect(entityKeywords(SANS_MOTS, "fr")).toEqual([]);
  });

  it("collecte les options distinctes triées", () => {
    expect(collectKeywordOptions([GRIFF, MORG, ZUG, SANS_MOTS], "fr")).toEqual([
      "Blitzer",
      "Bloqueur",
      "Gros Bras",
      "Humain",
      "Ogre",
    ]);
    expect(collectKeywordOptions([GRIFF, MORG], "en")).toEqual([
      "Big Guy",
      "Blitzer",
      "Human",
      "Ogre",
    ]);
  });

  it("dédoublonne les variantes de graphie (première rencontrée gagne)", () => {
    const options = collectKeywordOptions(
      [
        { keywords: "Homme-Lézard, Bloqueur" },
        { keywords: "Homme Lezard, Blitzer" },
      ],
      "fr",
    );
    expect(
      options.filter((o) => normalizeKeyword(o) === "homme lezard"),
    ).toEqual(["Homme-Lézard"]);
  });

  it("filtre en ET logique, sélection vide = tout", () => {
    const all = [GRIFF, MORG, ZUG];
    expect(filterByKeywords(all, [], "fr")).toHaveLength(3);
    expect(filterByKeywords(all, ["Humain"], "fr")).toEqual([GRIFF, ZUG]);
    expect(filterByKeywords(all, ["Humain", "Blitzer"], "fr")).toEqual([GRIFF]);
    expect(filterByKeywords(all, ["Humain", "Gros Bras"], "fr")).toEqual([]);
    expect(filterByKeywords(all, ["Human"], "en")).toEqual([GRIFF, ZUG]);
  });
});
