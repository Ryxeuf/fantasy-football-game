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

describe("A49-A52 — textes S3 officiels (photos p.128/135/136 du livre)", () => {
  it("A49 — Rétablissement : relevé gratuit (3 cases) + échec = reste À Terre", () => {
    const desc = SEASON_3_SKILL_DESCRIPTIONS["jump-up"]?.description ?? "";
    expect(desc).toContain("3 cases");
    expect(desc).toContain("+1");
    expect(desc).toContain("reste À Terre");
    expect(SEASON_3_SKILL_DESCRIPTIONS["jump-up"]?.descriptionEn).toBeTruthy();
  });

  it("A50 — Saut : une case adjacente, malus réduits de 1 (min -1), incompatible Monté sur Ressort", () => {
    const desc = SEASON_3_SKILL_DESCRIPTIONS["leap"]?.description ?? "";
    expect(desc).toContain("case adjacente");
    expect(desc).toContain("Bondir");
    expect(desc).toContain("-1");
    expect(desc).toContain("Monté sur Ressort");
    expect(SEASON_3_SKILL_DESCRIPTIONS["leap"]?.descriptionEn).toBeTruthy();
  });

  it("A51 — Sprint : « une fois de plus » que la normale (pas « trois plutôt que deux »)", () => {
    const desc = SEASON_3_SKILL_DESCRIPTIONS["sprint"]?.description ?? "";
    expect(desc).toContain("une fois de plus");
    expect(desc).not.toContain("trois");
    expect(SEASON_3_SKILL_DESCRIPTIONS["sprint"]?.descriptionEn).toBeTruthy();
  });

  it("A52 — Frappe Précise : Déviation D3 au lieu de D6 (plus de division par deux)", () => {
    const desc = SEASON_3_SKILL_DESCRIPTIONS["kick"]?.description ?? "";
    expect(desc).toContain("D3");
    expect(desc).toContain("D6");
    expect(desc).not.toContain("diviser par deux");
    expect(SEASON_3_SKILL_DESCRIPTIONS["kick"]?.descriptionEn).toBeTruthy();
  });

  it("les quatre slugs existent dans le canon game-engine", () => {
    for (const slug of ["jump-up", "leap", "sprint", "kick"]) {
      expect(SKILLS_DEFINITIONS.find((s) => s.slug === slug)).toBeTruthy();
    }
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
