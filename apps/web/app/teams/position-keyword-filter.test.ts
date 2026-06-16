import { describe, it, expect } from "vitest";
import {
  normalizeKeyword,
  positionKeywords,
  collectKeywordOptions,
  filterPositionsByKeywords,
} from "./position-keyword-filter";

type P = { keywords?: string | null; keywordsEn?: string | null; slug: string };

const POSITIONS: P[] = [
  { slug: "high_elf_trois_quart", keywords: "Elfe, Trois-quart", keywordsEn: "Elf, Lineman" },
  { slug: "high_elf_blitzer", keywords: "Elfe, Blitzer", keywordsEn: "Elf, Blitzer" },
  { slug: "human_blitzer", keywords: "Humain, Blitzer", keywordsEn: "Human, Blitzer" },
  // Variante de graphie : doit dédupliquer avec "Homme-Lézard".
  { slug: "skink", keywords: "Homme Lézard, Trois-quart", keywordsEn: "Lizardman, Lineman" },
  { slug: "saurus", keywords: "Homme-Lézard, Bloqueur", keywordsEn: "Lizardman, Blocker" },
];

describe("normalizeKeyword", () => {
  it("insensible casse/accents/tirets", () => {
    expect(normalizeKeyword("Homme-Lézard")).toBe("homme lezard");
    expect(normalizeKeyword("Homme Lézard")).toBe("homme lezard");
    expect(normalizeKeyword("Trois-quart")).toBe("trois quart");
  });
});

describe("positionKeywords", () => {
  it("FR par défaut, EN si lang=en, repli FR si EN absent", () => {
    expect(positionKeywords(POSITIONS[0], "fr")).toEqual(["Elfe", "Trois-quart"]);
    expect(positionKeywords(POSITIONS[0], "en")).toEqual(["Elf", "Lineman"]);
    expect(positionKeywords({ keywords: "Elfe", keywordsEn: null }, "en")).toEqual(["Elfe"]);
  });
});

describe("collectKeywordOptions", () => {
  it("dédoublonne les variantes de graphie (Homme Lézard / Homme-Lézard)", () => {
    const opts = collectKeywordOptions(POSITIONS, "fr");
    // Une seule entrée "Homme Lézard" malgré les deux graphies.
    const lizard = opts.filter((o) => normalizeKeyword(o) === "homme lezard");
    expect(lizard).toHaveLength(1);
    expect(opts).toContain("Elfe");
    expect(opts).toContain("Blitzer");
  });
});

describe("filterPositionsByKeywords", () => {
  it("active vide ⇒ tout", () => {
    expect(filterPositionsByKeywords(POSITIONS, [], "fr")).toHaveLength(5);
  });

  it("ET logique : Elfe + Blitzer ⇒ uniquement le blitzer elfe", () => {
    const r = filterPositionsByKeywords(POSITIONS, ["Elfe", "Blitzer"], "fr");
    expect(r.map((p) => p.slug)).toEqual(["high_elf_blitzer"]);
  });

  it("variante de graphie filtrée correctement (Homme-Lézard)", () => {
    const r = filterPositionsByKeywords(POSITIONS, ["Homme-Lézard"], "fr");
    expect(r.map((p) => p.slug).sort()).toEqual(["saurus", "skink"]);
  });

  it("filtre en EN", () => {
    const r = filterPositionsByKeywords(POSITIONS, ["Blitzer"], "en");
    expect(r.map((p) => p.slug).sort()).toEqual(["high_elf_blitzer", "human_blitzer"]);
  });
});
