/**
 * Champs conditionnels du formulaire d'évènement — en particulier :
 * l'évènement « Temporisation » (stalling) doit proposer la listbox
 * « Gravité de la blessure » (comme « Autre élimination »), sans champ
 * Cible (auto-élimination : la victime est le joueur qui temporise).
 */
import { describe, it, expect } from "vitest";
import {
  hasTargetField,
  INJURY_BEARING_KINDS,
  RECEIVER_BEARING_KINDS,
  TARGET_BEARING_KINDS,
} from "./event-fields";

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

// FDM — la passe réussie gagne un second joueur : celui qui RÉCEPTIONNE.
// Il partage la colonne `targetPlayerId` avec la « Cible », mais le picker
// doit proposer la MÊME équipe que l'acteur (c'est un coéquipier) — d'où un
// ensemble distinct de `TARGET_BEARING_KINDS`.
describe("event-fields — réceptionneur de passe", () => {
  it("pass_complete porte un réceptionneur", () => {
    expect(RECEIVER_BEARING_KINDS.has("pass_complete")).toBe(true);
  });

  it("le réceptionneur n'est pas une cible adverse", () => {
    expect(TARGET_BEARING_KINDS.has("pass_complete")).toBe(false);
  });

  it("aucun autre type d'évènement ne porte de réceptionneur", () => {
    for (const kind of [
      "kickoff",
      "touchdown",
      "casualty",
      "interception",
      "aggression",
      "expulsion",
      "crowd_surge",
      "stalling",
      "team_throw",
      "ttm_landing",
      "special_elim",
      "other_elim",
    ] as const) {
      expect(RECEIVER_BEARING_KINDS.has(kind), kind).toBe(false);
    }
  });

  it("hasTargetField couvre les cibles adverses ET les réceptionneurs", () => {
    expect(hasTargetField("pass_complete")).toBe(true);
    for (const kind of [
      "casualty",
      "aggression",
      "crowd_surge",
      "special_elim",
    ] as const) {
      expect(hasTargetField(kind), kind).toBe(true);
    }
    // Les évènements sans second joueur : le champ reste masqué et purgé.
    for (const kind of [
      "kickoff",
      "touchdown",
      "interception",
      "expulsion",
      "stalling",
      "team_throw",
      "ttm_landing",
      "other_elim",
    ] as const) {
      expect(hasTargetField(kind), kind).toBe(false);
    }
  });
});
