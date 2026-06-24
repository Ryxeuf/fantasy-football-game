import { describe, it, expect } from "vitest";
import {
  SEASON_3_RENAMED_SKILLS,
  SEASON_3_CATEGORY_CHANGES,
  SEASON_3_SKILL_DESCRIPTIONS,
} from "./static-skills-data-s3";
import { SKILLS_DEFINITIONS } from "../../../packages/game-engine/src/skills/index";

// Lot « Correctifs traits S3 » — verrouille les corrections de noms /
// catégories / textes appliquées au seed season_3. Le canon
// (game-engine/skills/index.ts) porte déjà les bons noms ; ces tables
// d'override garantissent que le seed S3 ne retombe pas sur les anciens
// noms du legacy `static-skills-data.ts`.

describe("S3 renames — noms FR corrigés au seed (A24/A25/A26/A14/A4/A15)", () => {
  const expected: Record<string, string> = {
    "pogo-stick": "Monté sur Ressort", // A24 (ex Échasse à ressort)
    "pick-me-up": "Petit Remontant", // A25 (ex Choppe-moi)
    drunkard: "Ivrogne*", // A26 (ex Poivrot)
    "breathe-fire": "Souffle Ardent", // A14 (ex Cracheur de feu)
    "hit-and-run": "Frappe-et-court", // A4/A15 (ex Frappe et Cours)
  };

  for (const [slug, nameFr] of Object.entries(expected)) {
    it(`${slug} est renommé "${nameFr}" en S3`, () => {
      expect(SEASON_3_RENAMED_SKILLS[slug]?.nameFr).toBe(nameFr);
      expect(SEASON_3_RENAMED_SKILLS[slug]?.nameEn).toBeTruthy();
    });

    it(`${slug} : le canon game-engine porte déjà le bon nom FR`, () => {
      const def = SKILLS_DEFINITIONS.find((s) => s.slug === slug);
      expect(def?.nameFr).toBe(nameFr);
    });
  }
});

describe("S3 — Frappe-et-court est une Compétence d'Agilité, plus un Trait (A4/A15)", () => {
  it("override de catégorie hit-and-run -> Agility", () => {
    expect(SEASON_3_CATEGORY_CHANGES["hit-and-run"]).toBe("Agility");
  });
  it("le canon classe déjà hit-and-run en Agility", () => {
    const def = SKILLS_DEFINITIONS.find((s) => s.slug === "hit-and-run");
    expect(def?.category).toBe("Agility");
  });
});

describe("A21 — Prendre Racine : jet seulement si Debout", () => {
  it("le texte S3 du seed mentionne la condition Debout + le 2+", () => {
    const desc = SEASON_3_SKILL_DESCRIPTIONS["take-root"]?.description ?? "";
    expect(desc).toContain("Debout");
    expect(desc).toContain("2+");
  });

  it("le canon take-root mentionne désormais la condition Debout", () => {
    const def = SKILLS_DEFINITIONS.find((s) => s.slug === "take-root");
    expect(def?.description).toContain("Debout");
  });
});
