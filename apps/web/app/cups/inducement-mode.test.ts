import { describe, it, expect } from "vitest";
import {
  coerceCupInducementMode,
  cupInducementModeChoices,
  defaultCupInducementMode,
  cupInducementListDiff,
  defaultCupInducementSlugs,
  effectiveCupInducementSlugs,
  normalizeCupAllowedInducements,
  packInducementSlugs,
  parseCupInducementMode,
  showsAllowedInducements,
} from "./inducement-mode";

const BB11 = { format: "bb11", hasTournamentRuleset: false };
const SEVENS = { format: "sevens", hasTournamentRuleset: false };
const PACK = { format: "bb11", hasTournamentRuleset: true };

describe("régime des coups de pouce d'une coupe (formulaire)", () => {
  it("BB11 : trois choix, `build` par défaut", () => {
    expect(cupInducementModeChoices(BB11)).toEqual({
      modes: ["build", "match", "none"],
      locked: false,
    });
    expect(defaultCupInducementMode(BB11)).toBe("build");
  });

  it("Sept : pas de `build`, avant-match par défaut", () => {
    expect(cupInducementModeChoices(SEVENS).modes).toEqual(["match", "none"]);
    expect(defaultCupInducementMode(SEVENS)).toBe("match");
    expect(coerceCupInducementMode("build", SEVENS)).toBe("match");
    expect(coerceCupInducementMode("none", SEVENS)).toBe("none");
  });

  it("règlement : `build` imposé et verrouillé", () => {
    expect(cupInducementModeChoices(PACK)).toEqual({ modes: ["build"], locked: true });
    expect(coerceCupInducementMode("none", PACK)).toBe("build");
  });

  it("la liste se règle dès que la coupe vend des coups de pouce, règlement compris", () => {
    expect(showsAllowedInducements("build", BB11)).toBe(true);
    expect(showsAllowedInducements("match", BB11)).toBe(true);
    expect(showsAllowedInducements("none", BB11)).toBe(false);
    expect(showsAllowedInducements("build", PACK)).toBe(true);
  });

  it("lit la valeur servie, `null` si inconnue", () => {
    expect(parseCupInducementMode("match")).toBe("match");
    expect(parseCupInducementMode("free")).toBeNull();
    expect(parseCupInducementMode(undefined)).toBeNull();
  });
});

describe("liste de coups de pouce administrée par le commissaire", () => {
  const CATALOGUE = ["team_mascot", "bloodweiser_kegs", "bribe", "weather_mage"];
  const PACK_RULES = [
    { slug: "team_mascot", cost: 25_000 },
    { slug: "bribe", cost: 100_000 },
  ];
  const PACK_SLUGS = ["team_mascot", "bribe"];

  it("liste par défaut : celle du règlement, sinon tout le catalogue", () => {
    expect(packInducementSlugs(PACK_RULES)).toEqual(PACK_SLUGS);
    expect(packInducementSlugs(undefined)).toBeNull();
    expect(defaultCupInducementSlugs(PACK_SLUGS, CATALOGUE)).toEqual(PACK_SLUGS);
    expect(defaultCupInducementSlugs(null, CATALOGUE)).toEqual(CATALOGUE);
  });

  it("cases cochées : la liste du commissaire, sinon le défaut", () => {
    expect(effectiveCupInducementSlugs(null, PACK_SLUGS)).toEqual(PACK_SLUGS);
    expect(effectiveCupInducementSlugs(["bribe"], PACK_SLUGS)).toEqual(["bribe"]);
  });

  it("une liste égale au défaut s'enregistre `null`, quel que soit l'ordre", () => {
    expect(normalizeCupAllowedInducements(["bribe", "team_mascot"], PACK_SLUGS)).toBeNull();
    expect(normalizeCupAllowedInducements(null, PACK_SLUGS)).toBeNull();
    expect(normalizeCupAllowedInducements(["bribe"], PACK_SLUGS)).toEqual(["bribe"]);
    // Vide = aucun coup de pouce, jamais « la liste par défaut ».
    expect(normalizeCupAllowedInducements([], PACK_SLUGS)).toEqual([]);
  });

  it("écart au règlement : ajouts et retraits", () => {
    expect(
      cupInducementListDiff(["team_mascot", "weather_mage"], PACK_SLUGS),
    ).toEqual({ added: ["weather_mage"], removed: ["bribe"] });
  });
});
