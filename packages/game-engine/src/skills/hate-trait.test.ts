import { describe, it, expect } from "vitest";
import {
  HATE_ROLL_TARGET,
  hateRollSucceeds,
  normalizeKeyword,
  parseKeywordsCsv,
  eligibleHateKeywords,
  pickHateKeyword,
  hateSlugForKeyword,
  isHateSkillSlug,
  buildHateSkillDefinition,
} from "./hate-trait";
import { KEYWORDS_SEASON3 } from "../rosters/keywords-season3";
import { SKILLS_DEFINITIONS } from "./index";

describe("hateRollSucceeds", () => {
  it("accorde le trait sur 4+ (1D6)", () => {
    expect(HATE_ROLL_TARGET).toBe(4);
    expect([1, 2, 3].map(hateRollSucceeds)).toEqual([false, false, false]);
    expect([4, 5, 6].map(hateRollSucceeds)).toEqual([true, true, true]);
  });

  it("refuse un jet non fini (garde defensive)", () => {
    expect(hateRollSucceeds(Number.NaN)).toBe(false);
  });
});

describe("normalizeKeyword / parseKeywordsCsv", () => {
  it("rapproche accents, casse et separateurs", () => {
    expect(normalizeKeyword("Trois-quart")).toBe("troisquart");
    expect(normalizeKeyword("trois quart")).toBe("troisquart");
    expect(normalizeKeyword("Spécial")).toBe("special");
    expect(normalizeKeyword("Homme-bête")).toBe("hommebete");
  });

  it("decoupe un CSV de mots-cles en tokens propres", () => {
    expect(parseKeywordsCsv("Humain, Trois-quart")).toEqual([
      "Humain",
      "Trois-quart",
    ]);
    expect(parseKeywordsCsv(null)).toEqual([]);
    expect(parseKeywordsCsv("  ,, ")).toEqual([]);
  });
});

describe("eligibleHateKeywords", () => {
  it("exclut les mots-cles de POSTE", () => {
    for (const poste of [
      "Gros Bras",
      "Bloqueur",
      "Blitzer",
      "Receveur",
      "Trois-quart",
      "Coureur",
      "Spécial",
      "Lanceur",
    ]) {
      expect(eligibleHateKeywords(poste)).toEqual([]);
    }
  });

  it("exclut aussi la forme anglaise Blocker", () => {
    expect(eligibleHateKeywords("Blocker")).toEqual([]);
  });

  it("garde les mots-cles de lignee dans l'ordre du catalogue", () => {
    expect(eligibleHateKeywords("Humain, Zombie, Mort-Vivant, Trois-quart")).toEqual([
      "Humain",
      "Zombie",
      "Mort-Vivant",
    ]);
  });

  it("dedoublonne sur la forme normalisee", () => {
    expect(eligibleHateKeywords("Nain, nain, NAIN")).toEqual(["Nain"]);
  });
});

describe("pickHateKeyword", () => {
  it("retient la lignee (premier mot-cle du catalogue)", () => {
    // Tueur de Trolls : « Nain, Spécial » -> X = Nain.
    expect(pickHateKeyword(KEYWORDS_SEASON3["dwarf_tueur_de_trolls"])).toBe(
      "Nain",
    );
    // Troll entraine : « Troll, Gros Bras » -> X = Troll.
    expect(pickHateKeyword(KEYWORDS_SEASON3["goblin_troll_entraine"])).toBe(
      "Troll",
    );
  });

  it("retourne null quand le joueur n'a que des mots-cles de poste", () => {
    expect(pickHateKeyword("Blitzer, Coureur")).toBeNull();
    expect(pickHateKeyword(null)).toBeNull();
  });
});

describe("hateSlugForKeyword", () => {
  it("reutilise les variantes deja au catalogue plutot que d'en creer un doublon", () => {
    expect(hateSlugForKeyword("Troll")).toBe("hate-troll");
    expect(hateSlugForKeyword("Nain")).toBe("hate-dwarf");
    const catalogued = new Set(SKILLS_DEFINITIONS.map((s) => s.slug));
    expect(catalogued.has("hate-troll")).toBe(true);
    expect(catalogued.has("hate-dwarf")).toBe(true);
  });

  it("slugifie les autres mots-cles", () => {
    expect(hateSlugForKeyword("Humain")).toBe("hate-humain");
    expect(hateSlugForKeyword("Homme Lézard")).toBe("hate-homme-lezard");
    expect(hateSlugForKeyword("Homme-bête")).toBe("hate-homme-bete");
  });

  it("refuse de fabriquer un slug depuis un mot-cle de poste", () => {
    expect(hateSlugForKeyword("Blitzer")).toBeNull();
    expect(hateSlugForKeyword("  ")).toBeNull();
  });
});

describe("isHateSkillSlug", () => {
  it("reconnait la famille Haine", () => {
    expect(isHateSkillSlug("hate")).toBe(true);
    expect(isHateSkillSlug("hate-troll")).toBe(true);
    expect(isHateSkillSlug("hate-homme-lezard")).toBe(true);
    expect(isHateSkillSlug("block")).toBe(false);
  });
});

describe("buildHateSkillDefinition", () => {
  it("compose un trait passif, Saison 3, jamais selectionnable", () => {
    const def = buildHateSkillDefinition("Orque");
    expect(def).toMatchObject({
      slug: "hate-orque",
      nameFr: "Haine (Orque)",
      nameEn: "Hate (Orque)",
      category: "Trait",
      isPassive: true,
      season3Only: true,
      excludedFromSelection: true,
    });
    expect(def?.description).toContain("Mot-clé Orque");
  });

  it("refuse un mot-cle exclu", () => {
    expect(buildHateSkillDefinition("Trois-quart")).toBeNull();
  });
});

describe("catalogue existant", () => {
  it("toutes les variantes de Haine du registre sont hors selection", () => {
    const hates = SKILLS_DEFINITIONS.filter((s) => isHateSkillSlug(s.slug));
    expect(hates.length).toBeGreaterThan(0);
    for (const s of hates) {
      expect(s.excludedFromSelection).toBe(true);
    }
  });
});
