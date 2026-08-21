/**
 * Champs conditionnels du formulaire d'évènement — en particulier :
 * l'évènement « Temporisation » (stalling) doit proposer la listbox
 * « Gravité de la blessure » (comme « Autre élimination »), sans champ
 * Cible (auto-élimination : la victime est le joueur qui temporise).
 */
import { describe, it, expect } from "vitest";
import { INJURY_BEARING_KINDS, TARGET_BEARING_KINDS } from "./event-fields";

describe("event-fields — Temporisation", () => {
  it("stalling porte la gravité de blessure (listbox affichée)", () => {
    expect(INJURY_BEARING_KINDS.has("stalling")).toBe(true);
  });

  it("stalling reste sans champ Cible (auto-élimination)", () => {
    expect(TARGET_BEARING_KINDS.has("stalling")).toBe(false);
  });

  it("les kinds historiques porteurs de blessure sont inchangés", () => {
    for (const kind of [
      "casualty",
      "aggression",
      "crowd_surge",
      "other_elim",
      "special_elim",
    ] as const) {
      expect(INJURY_BEARING_KINDS.has(kind), kind).toBe(true);
    }
    for (const kind of [
      "kickoff",
      "touchdown",
      "pass_complete",
      "interception",
      "expulsion",
      "team_throw",
      "ttm_landing",
    ] as const) {
      expect(INJURY_BEARING_KINDS.has(kind), kind).toBe(false);
    }
  });
});
