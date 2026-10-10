import { describe, it, expect } from "vitest";
import {
  coerceCupInducementMode,
  cupInducementModeChoices,
  defaultCupInducementMode,
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

  it("la liste autorisée : sans règlement et hors `none`", () => {
    expect(showsAllowedInducements("build", BB11)).toBe(true);
    expect(showsAllowedInducements("match", BB11)).toBe(true);
    expect(showsAllowedInducements("none", BB11)).toBe(false);
    expect(showsAllowedInducements("build", PACK)).toBe(false);
  });

  it("lit la valeur servie, `null` si inconnue", () => {
    expect(parseCupInducementMode("match")).toBe("match");
    expect(parseCupInducementMode("free")).toBeNull();
    expect(parseCupInducementMode(undefined)).toBeNull();
  });
});
