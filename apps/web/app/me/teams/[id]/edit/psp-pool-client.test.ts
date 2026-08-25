/**
 * Helpers purs du pool de PSP de construction.
 */
import { describe, it, expect } from "vitest";
import {
  advancementLabel,
  fundingFor,
  parsePlayerAdvancements,
} from "./psp-pool-client";

describe("fundingFor", () => {
  it("puise dans le pool tant qu'il couvre le coût", () => {
    expect(fundingFor(6, 20, 0)).toEqual({ source: "pool", affordable: true });
    expect(fundingFor(6, 6, 0)).toEqual({ source: "pool", affordable: true });
  });

  it("retombe sur les SPP du joueur quand le pool ne suffit pas", () => {
    expect(fundingFor(6, 5, 10)).toEqual({ source: "player", affordable: true });
  });

  it("refuse quand aucune source ne couvre le coût", () => {
    // Les deux sources ne se cumulent PAS : c'est la règle serveur.
    expect(fundingFor(10, 5, 6)).toEqual({
      source: "player",
      affordable: false,
    });
  });
});

describe("parsePlayerAdvancements", () => {
  it("lit la chaîne JSON et le tableau natif", () => {
    const raw = [{ type: "primary", skillSlug: "block" }];
    expect(parsePlayerAdvancements(JSON.stringify(raw))).toEqual(raw);
    expect(parsePlayerAdvancements(raw)).toEqual(raw);
  });

  it("renvoie [] sur une donnée illisible", () => {
    expect(parsePlayerAdvancements("{{")).toEqual([]);
    expect(parsePlayerAdvancements(null)).toEqual([]);
    expect(parsePlayerAdvancements(undefined)).toEqual([]);
  });
});

describe("advancementLabel", () => {
  it("préfère le nom de la compétence au slug", () => {
    expect(
      advancementLabel({ type: "primary", skillSlug: "block" }, "Blocage"),
    ).toBe("Blocage (Principale)");
    expect(advancementLabel({ type: "secondary", skillSlug: "dodge" })).toBe(
      "dodge (Secondaire)",
    );
  });

  it("nomme la caractéristique améliorée", () => {
    expect(advancementLabel({ type: "characteristic", stat: "ma" })).toBe(
      "Caractéristique +1 MA",
    );
  });

  it("gère un tirage aléatoire", () => {
    expect(
      advancementLabel({ type: "random-primary", skillSlug: "sprint" }, "Sprint"),
    ).toBe("Sprint (Principale au hasard)");
  });
});
