import { describe, it, expect } from "vitest";
import {
  competitionBackLabel,
  competitionHref,
  isCupCompetition,
  matchSheetHref,
} from "./competition-links";

describe("competition-links", () => {
  it("reconnaît une coupe, et rien d'autre", () => {
    expect(isCupCompetition("cup")).toBe(true);
    expect(isCupCompetition("league")).toBe(false);
    // Serveur antérieur au champ : on retombe sur la ligue, comportement
    // historique de la feuille de match.
    expect(isCupCompetition(undefined)).toBe(false);
    expect(isCupCompetition(null)).toBe(false);
  });

  it("pointe la bonne page de compétition", () => {
    expect(competitionHref("cup", "c1")).toBe("/cups/c1");
    expect(competitionHref("league", "L1")).toBe("/leagues/L1");
    expect(competitionHref(undefined, "L1")).toBe("/leagues/L1");
  });

  it("adapte le libellé du lien retour", () => {
    expect(competitionBackLabel("cup", "World Cup")).toBe(
      "← Retour à la coupe « World Cup »",
    );
    expect(competitionBackLabel("league", "Ma Ligue")).toBe(
      "← Retour à la ligue « Ma Ligue »",
    );
    expect(competitionBackLabel("cup", null)).toBe("← Retour à la coupe");
    expect(competitionBackLabel("league")).toBe("← Retour à la ligue");
  });

  it("pointe la feuille de match sous le bon préfixe", () => {
    expect(matchSheetHref("cup", "p1")).toBe("/cups/pairings/p1/sheet");
    expect(matchSheetHref("league", "p1")).toBe("/leagues/pairings/p1/sheet");
    expect(matchSheetHref(undefined, "p1")).toBe("/leagues/pairings/p1/sheet");
  });
});
