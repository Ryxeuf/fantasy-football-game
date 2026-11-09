/**
 * Suppression d'une saison : règle pure, en table.
 */
import { describe, expect, it } from "vitest";
import {
  decideSeasonDeletion,
  type SeasonDeletionInput,
} from "./league-season-deletion-rules";

const NOTHING = {
  validatedSheets: 0,
  scoredMatches: 0,
  resultPairings: 0,
  postMatchSequences: 0,
};
const COMMISSIONER = { isCommissioner: true, isAdmin: false };
const ADMIN = { isCommissioner: false, isAdmin: true };
const COACH = { isCommissioner: false, isAdmin: false };

function input(over: Partial<SeasonDeletionInput> = {}): SeasonDeletionInput {
  return { actor: COMMISSIONER, ...NOTHING, ...over };
}

describe("decideSeasonDeletion", () => {
  it.each([
    ["commissaire, rien de joué", input(), true],
    ["admin non commissaire, rien de joué", input({ actor: ADMIN }), true],
  ] as const)("%s ⇒ autorisée", (_l, given, allowed) => {
    expect(decideSeasonDeletion(given).allowed).toBe(allowed);
  });

  it.each([
    ["coach non commissaire", input({ actor: COACH }), "forbidden"],
    ["feuille validée", input({ validatedSheets: 1 }), "sheets_validated"],
    ["résultat saisi hors feuille", input({ resultPairings: 2 }), "results_recorded"],
    ["match reporté au classement", input({ scoredMatches: 1 }), "matches_scored"],
    ["séquence d'après-match", input({ postMatchSequences: 1 }), "post_match_sequences"],
  ] as const)("%s ⇒ refus %s", (_l, given, code) => {
    const decision = decideSeasonDeletion(given);
    expect(decision).toMatchObject({ allowed: false, code });
  });

  it("un refus joué renvoie vers la clôture ou l'archivage", () => {
    const decision = decideSeasonDeletion(input({ validatedSheets: 3 }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.message).toContain("3 feuille(s)");
      expect(decision.message).toMatch(/cloturez-la/);
      expect(decision.message).toMatch(/archivez la ligue/);
    }
  });

  it("l'autorisation passe avant le contenu (un coach n'apprend rien)", () => {
    expect(
      decideSeasonDeletion(input({ actor: COACH, validatedSheets: 5 })),
    ).toMatchObject({ allowed: false, code: "forbidden" });
  });

  it("un admin ne contourne pas la règle des effets joués", () => {
    expect(
      decideSeasonDeletion(input({ actor: ADMIN, resultPairings: 1 })),
    ).toMatchObject({ allowed: false, code: "results_recorded" });
  });
});
