import { describe, expect, it } from "vitest";
import { chapters } from "../../compendium/data";
import { getSheet } from "./sheets";
import { PHASES, TURN_ACTIONS, checkableStepIds, getPhase } from "./sequences";

describe("PHASES", () => {
  it("décrit les trois phases dans l'ordre chronologique", () => {
    expect(PHASES.map((p) => p.id)).toEqual(["avant", "pendant", "apres"]);
  });

  it("n'a que des identifiants d'étape uniques, toutes phases confondues", () => {
    const ids = PHASES.flatMap((p) => p.steps.map((s) => `${p.id}/${s.id}`));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ne référence que des fiches existantes", () => {
    for (const phase of PHASES) {
      for (const step of phase.steps) {
        for (const sheetId of step.sheets ?? []) {
          expect(getSheet(sheetId), `${phase.id}/${step.id} → ${sheetId}`).toBeDefined();
        }
      }
    }
  });

  it("ne référence que des chapitres existants du compendium", () => {
    const slugs = new Set(chapters.map((c) => c.slug));
    for (const phase of PHASES) {
      for (const step of phase.steps) {
        if (step.chapterSlug) {
          expect(slugs.has(step.chapterSlug), `${phase.id}/${step.id}`).toBe(true);
        }
      }
    }
  });

  it("garde des résumés courts, lisibles au-dessus d'un plateau", () => {
    for (const phase of PHASES) {
      for (const step of phase.steps) {
        expect(step.summary.length, `${phase.id}/${step.id}`).toBeLessThanOrEqual(220);
        expect(step.summary.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("getPhase", () => {
  it("retrouve une phase par son identifiant", () => {
    expect(getPhase("pendant")?.title).toBe("Pendant le match");
  });

  it("renvoie undefined pour un identifiant inconnu", () => {
    expect(getPhase("mi-temps")).toBeUndefined();
  });
});

describe("checkableStepIds", () => {
  it("liste les étapes des phases cochables", () => {
    expect(checkableStepIds(PHASES[0])).toContain("meteo");
  });

  it("ne renvoie rien pour une phase non cochable", () => {
    expect(checkableStepIds(PHASES[1])).toEqual([]);
  });
});

describe("TURN_ACTIONS", () => {
  it("liste les cinq actions limitées à une par tour", () => {
    expect(TURN_ACTIONS.map((a) => a.id)).toEqual([
      "blitz",
      "passe",
      "remise",
      "botter",
      "agression",
    ]);
  });
});
