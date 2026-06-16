import { describe, it, expect } from "vitest";
import {
  translateKeywordToken,
  translateKeywordsCsv,
} from "./keyword-translations";

describe("translateKeywordToken", () => {
  it("traduit lignées et types officiels", () => {
    expect(translateKeywordToken("Elfe")).toBe("Elf");
    expect(translateKeywordToken("Trois-quart")).toBe("Lineman");
    expect(translateKeywordToken("Gros Bras")).toBe("Big Guy");
    expect(translateKeywordToken("Sbire")).toBe("Thrall");
  });

  it("absorbe les variantes de graphie de la source", () => {
    expect(translateKeywordToken("Homme-Lézard")).toBe("Lizardman");
    expect(translateKeywordToken("Homme Lézard")).toBe("Lizardman");
    expect(translateKeywordToken("Homme-arbre")).toBe("Treeman");
    expect(translateKeywordToken("Homme-Arbre")).toBe("Treeman");
  });

  it("laisse un token inconnu inchangé (repli FR)", () => {
    expect(translateKeywordToken("Inconnu")).toBe("Inconnu");
  });
});

describe("translateKeywordsCsv", () => {
  it("traduit le CSV en EN", () => {
    expect(translateKeywordsCsv("Elfe, Trois-quart", "en")).toBe("Elf, Lineman");
  });

  it("renvoie le FR inchangé hors EN", () => {
    expect(translateKeywordsCsv("Elfe, Trois-quart", "fr")).toBe(
      "Elfe, Trois-quart",
    );
  });

  it("préserve null", () => {
    expect(translateKeywordsCsv(null, "en")).toBeNull();
  });
});
