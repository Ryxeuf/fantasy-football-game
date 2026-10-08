import { describe, it, expect } from "vitest";
import { sheetEntryProfile } from "./sheet-entry-profile";
import { EVENT_KIND_OPTIONS } from "../leagues/pairings/[id]/sheet/event-fields";

const SIMPLIFIED_CUP = {
  competitionKind: "cup" as const,
  competitionRules: { entryMode: "simplified" },
};

describe("sheetEntryProfile — saisie complète", () => {
  it("sert la feuille de ligue telle quelle", () => {
    const p = sheetEntryProfile({ competitionKind: "league" });
    expect(p.mode).toBe("full");
    expect(p.eventKinds).toBe(EVENT_KIND_OPTIONS);
    expect(p).toMatchObject({
      halfAndTurn: true,
      injuryDetails: true,
      passReceiver: true,
      kickoffDetails: true,
      kindHints: true,
      preMatch: "full",
      journeymanPosition: true,
      raiseDead: true,
      markAggressionEliminated: false,
    });
  });

  it("garde une ligue en saisie complète même si un mode simplifié lui était servi", () => {
    const p = sheetEntryProfile({
      competitionKind: "league",
      competitionRules: { entryMode: "simplified" },
    });
    expect(p.mode).toBe("full");
  });

  it("lit une coupe sans mode servi (serveur antérieur) en saisie complète", () => {
    expect(sheetEntryProfile({ competitionKind: "cup" }).mode).toBe("full");
    expect(
      sheetEntryProfile({ competitionKind: "cup", competitionRules: {} }).mode,
    ).toBe("full");
    expect(
      sheetEntryProfile({
        competitionKind: "cup",
        competitionRules: { entryMode: "full" },
      }).mode,
    ).toBe("full");
  });

  it("lit une réponse sans compétition (serveur antérieur) en saisie complète", () => {
    expect(sheetEntryProfile({}).mode).toBe("full");
  });
});

describe("sheetEntryProfile — saisie simplifiée d'une coupe", () => {
  const p = sheetEntryProfile(SIMPLIFIED_CUP);

  it("ne propose que les cinq types que la coupe compte, dans l'ordre de la ligue", () => {
    expect(p.mode).toBe("simplified");
    expect(p.eventKinds.map((k) => k.value)).toEqual([
      "touchdown",
      "casualty",
      "pass_complete",
      "interception",
      "aggression",
    ]);
  });

  it("reprend les libellés de la ligue, seule l'agression devient « Élimination sur Agression »", () => {
    const fullLabel = (value: string) =>
      EVENT_KIND_OPTIONS.find((k) => k.value === value)?.label;
    for (const k of p.eventKinds) {
      if (k.value === "aggression") {
        expect(k.label).toBe("Élimination sur Agression");
      } else {
        expect(k.label).toBe(fullLabel(k.value));
      }
    }
  });

  it("retire mi-temps, tour, gravité, réceptionneur, coup d'envoi et rappels de PSP", () => {
    expect(p).toMatchObject({
      halfAndTurn: false,
      injuryDetails: false,
      passReceiver: false,
      kickoffDetails: false,
      kindHints: false,
    });
  });

  it("réduit l'avant-match au forfait et retire journaliers et mort relevé", () => {
    expect(p.preMatch).toBe("forfeit-only");
    expect(p.journeymanPosition).toBe(false);
    expect(p.raiseDead).toBe(false);
  });

  it("marque une agression comme sortie, faute de gravité à saisir", () => {
    expect(p.markAggressionEliminated).toBe(true);
  });
});
