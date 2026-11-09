/**
 * Suppression d'une journée : règle pure (aucun Prisma).
 */
import { describe, expect, it } from "vitest";
import {
  decideRoundRemoval,
  isPlayoffRound,
  normalizeRoundName,
  type RoundRemovalInput,
  type RoundRemovalPairing,
} from "./league-round-removal";

function pairing(over: Partial<RoundRemovalPairing> = {}): RoundRemovalPairing {
  return {
    status: "scheduled",
    hasMatch: false,
    sheetStatus: null,
    predictions: 0,
    ...over,
  };
}

function input(over: Partial<RoundRemovalInput> = {}): RoundRemovalInput {
  return {
    round: { kind: "regular", bracketSlot: null },
    seasonStatus: "in_progress",
    pairings: [pairing(), pairing()],
    scoredMatches: 0,
    ...over,
  };
}

describe("decideRoundRemoval", () => {
  it("journée vide : autorisée, rien à emporter", () => {
    expect(decideRoundRemoval(input({ pairings: [] }))).toEqual({
      allowed: true,
      pairingsRemoved: 0,
      draftSheetsRemoved: 0,
      predictionsRemoved: 0,
    });
  });

  it("rencontres à jouer, brouillons et pronostics : autorisée et dénombrée", () => {
    const decision = decideRoundRemoval(
      input({
        pairings: [
          pairing({ sheetStatus: "draft", predictions: 3 }),
          pairing({ status: "cancelled", predictions: 1 }),
          pairing(),
        ],
      }),
    );
    expect(decision).toEqual({
      allowed: true,
      pairingsRemoved: 3,
      draftSheetsRemoved: 1,
      predictionsRemoved: 4,
    });
  });

  it.each([
    ["saison clôturée", input({ seasonStatus: "completed" }), "season_completed"],
    [
      "play-off par kind",
      input({ round: { kind: "playoff", bracketSlot: null } }),
      "playoff_round",
    ],
    [
      "play-off par slot (tour créé à la main, kind regular)",
      input({ round: { kind: "regular", bracketSlot: "final" } }),
      "playoff_round",
    ],
    ["rencontre en cours", input({ pairings: [pairing({ status: "in_progress" })] }), "pairing_engaged"],
    ["rencontre jouée", input({ pairings: [pairing({ status: "played" })] }), "pairing_engaged"],
    ["forfait domicile", input({ pairings: [pairing({ status: "forfeit_home" })] }), "pairing_engaged"],
    ["forfait extérieur", input({ pairings: [pairing({ status: "forfeit_away" })] }), "pairing_engaged"],
    ["match lancé", input({ pairings: [pairing({ hasMatch: true })] }), "match_linked"],
    ["match reporté au classement", input({ scoredMatches: 1 }), "match_scored"],
    ["feuille soumise domicile", input({ pairings: [pairing({ sheetStatus: "submitted_home" })] }), "sheet_submitted"],
    ["feuille soumise des deux côtés", input({ pairings: [pairing({ sheetStatus: "both_submitted" })] }), "sheet_submitted"],
    ["feuille validée", input({ pairings: [pairing({ sheetStatus: "validated" })] }), "sheet_submitted"],
    ["feuille invalidée", input({ pairings: [pairing({ sheetStatus: "invalidated" })] }), "sheet_submitted"],
  ] as const)("%s ⇒ refus %s", (_label, given, code) => {
    const decision = decideRoundRemoval(given);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe(code);
      expect(decision.message.length).toBeGreaterThan(0);
    }
  });

  it("la saison clôturée l'emporte sur les autres refus", () => {
    const decision = decideRoundRemoval(
      input({
        seasonStatus: "completed",
        round: { kind: "playoff", bracketSlot: "final" },
        pairings: [pairing({ status: "played" })],
      }),
    );
    expect(decision).toMatchObject({ allowed: false, code: "season_completed" });
  });
});

describe("isPlayoffRound", () => {
  it("reconnaît le kind OU le slot", () => {
    expect(isPlayoffRound({ kind: "regular", bracketSlot: null })).toBe(false);
    expect(isPlayoffRound({ kind: "playoff", bracketSlot: null })).toBe(true);
    expect(isPlayoffRound({ kind: "regular", bracketSlot: "sf1" })).toBe(true);
  });
});

describe("normalizeRoundName", () => {
  it("undefined = inchangé, vide ou blanc = défaut (null), sinon rogné", () => {
    expect(normalizeRoundName(undefined)).toBeUndefined();
    expect(normalizeRoundName(null)).toBeNull();
    expect(normalizeRoundName("")).toBeNull();
    expect(normalizeRoundName("   ")).toBeNull();
    expect(normalizeRoundName("  Derby  ")).toBe("Derby");
  });
});
