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
    "mighty-blow-1": "Châtaigne", // correctif fiches SP (ex Châtaigne (+1) / Coup Puissant (+1))
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

describe("Esquive en Force — texte 2025 (une fois par Tour, trois paliers de Force)", () => {
  const s3 = SEASON_3_SKILL_DESCRIPTIONS["break-tackle"];

  it("la surcharge S3 porte les trois paliers et la limite par Tour (FR)", () => {
    const desc = s3?.description ?? "";
    expect(desc).toContain("Une fois par Tour");
    expect(desc).toMatch(/\+1[^.]*Force de 3 ou moins/);
    expect(desc).toMatch(/\+2[^.]*Force de 4[^ ]/);
    expect(desc).toMatch(/\+3[^.]*Force de 5 ou plus/);
    expect(desc).not.toContain("activation");
  });

  it("la surcharge S3 porte aussi le texte anglais", () => {
    const en = s3?.descriptionEn ?? "";
    expect(en).toContain("Once per turn");
    expect(en).toContain("+3");
    expect(en).toContain("5 or more");
  });

  it("le slug existe au canon (le seed et la mise à jour prod l'appliquent)", () => {
    // `seed.ts` et `scripts/update-skills-and-rules-from-ocr.ts` parcourent
    // SEASON_3_SKILL_DESCRIPTIONS par slug : il suffit que le slug soit
    // celui du canon pour que la description servie change.
    expect(
      SKILLS_DEFINITIONS.find((s) => s.slug === "break-tackle"),
    ).toBeTruthy();
    expect(Object.keys(SEASON_3_SKILL_DESCRIPTIONS)).toContain("break-tackle");
  });
});

describe("Textes 2020 remplacés par le texte 2025 (audit des compétences S3)", () => {
  const fr = (slug: string) =>
    SEASON_3_SKILL_DESCRIPTIONS[slug]?.description ?? "";
  const en = (slug: string) =>
    SEASON_3_SKILL_DESCRIPTIONS[slug]?.descriptionEn ?? "";

  it("Minus : -1 pour INTERCEPTER (plus de +1 à l'adversaire qui interfère)", () => {
    expect(fr("stunty")).toContain("-1");
    expect(fr("stunty")).toContain("Intercepter");
    expect(fr("stunty")).not.toContain("+1");
    expect(en("stunty")).toContain("-1");
  });

  it("Grande Gueule : Action Spéciale de Croquement sur 3+, plus de relance de réception", () => {
    expect(fr("monstrous-mouth")).toContain("Croquement");
    expect(fr("monstrous-mouth")).toContain("3+");
    expect(fr("monstrous-mouth")).toContain("Arracher le Ballon");
    expect(fr("monstrous-mouth")).not.toMatch(/relancer/i);
    expect(en("monstrous-mouth")).toContain("Chomp");
  });

  it("Lancer de Coéquipier : plus de condition de Force 5", () => {
    expect(fr("throw-team-mate")).not.toContain("Force");
    expect(en("throw-team-mate")).not.toContain("Strength");
  });

  it("Cerveau Lent (2+) et Gros Débile (4+, +2 si soutenu) : le joueur devient Déconcentré", () => {
    expect(fr("bone-head")).toContain("2+");
    expect(fr("bone-head")).toContain("Déconcentré");
    expect(fr("really-stupid")).toContain("4+");
    expect(fr("really-stupid")).toContain("+2");
    expect(fr("really-stupid")).toContain("Déconcentré");
  });

  it("Joueur Déloyal : le +1 est écrit en toutes lettres", () => {
    expect(fr("dirty-player-1")).toContain("+1");
    expect(en("dirty-player-1")).toContain("+1");
  });

  it("chaque slug corrigé existe au canon", () => {
    for (const slug of [
      "stunty",
      "monstrous-mouth",
      "throw-team-mate",
      "bone-head",
      "really-stupid",
      "dirty-player-1",
    ]) {
      expect(SKILLS_DEFINITIONS.find((s) => s.slug === slug)).toBeTruthy();
    }
  });
});
