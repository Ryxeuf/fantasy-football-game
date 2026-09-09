import { describe, it, expect } from "vitest";
import {
  SKILL_CATEGORY_COLORS,
  getSkillAccessPalette,
  getSkillCategoryColor,
  getSkillCategoryPalette,
  getSkillCategorySolidColor,
} from "./skill-category-colors";

/** Le code couleur officiel, tel qu'il doit se lire dans les classes. */
const OFFICIAL: ReadonlyArray<readonly [string, string, string]> = [
  ["General", "G", "blue"],
  ["Agility", "A", "yellow"],
  ["Strength", "S", "red"],
  ["Mutation", "M", "green"],
  ["Passing", "P", "white"],
  ["Scélérates", "K", "purple"],
];

describe("code couleur officiel des compétences", () => {
  it.each(OFFICIAL)(
    "peint %s en %s",
    (category, _code, hue) => {
      const palette = getSkillCategoryPalette(category);
      expect(palette.base).toContain(hue === "white" ? "bg-white" : `-${hue}-`);
    },
  );

  it.each(OFFICIAL)(
    "donne au code d'accès de %s la MÊME teinte que la catégorie",
    (category, code) => {
      expect(getSkillAccessPalette(code)).toBe(getSkillCategoryPalette(category));
    },
  );

  it("traite F comme l'alias français de la Force", () => {
    expect(getSkillAccessPalette("F")).toBe(getSkillAccessPalette("S"));
    expect(getSkillAccessPalette("g")).toBe(getSkillAccessPalette("G"));
  });

  it("donne une teinte DISTINCTE à chacune des six catégories", () => {
    const bases = OFFICIAL.map(([c]) => getSkillCategoryPalette(c).base);
    expect(new Set(bases).size).toBe(OFFICIAL.length);
  });
});

describe("lisibilité", () => {
  it("n'écrit jamais en blanc sur le jaune de l'Agilité", () => {
    const agility = getSkillCategoryPalette("Agility");
    expect(agility.base).not.toContain("text-white");
    expect(agility.solid).not.toContain("text-white");
  });

  it("détache la Passe (blanche) par une bordure et un texte sombre", () => {
    const passing = getSkillCategoryPalette("Passing");
    // Un badge blanc sur une carte blanche n'existe que par sa bordure.
    expect(passing.border).toContain("border-gray-400");
    expect(passing.base).toContain("text-gray-900");
    expect(passing.solid).toContain("border-gray-900");
  });

  it("porte un texte foncé sur chaque fond clair", () => {
    for (const [category] of OFFICIAL) {
      const { base } = getSkillCategoryPalette(category);
      expect(base).toMatch(/text-(?:\w+)-9(?:00|50)\b/);
    }
  });

  it("porte un texte clair OU très foncé sur chaque fond soutenu", () => {
    for (const [category] of OFFICIAL) {
      const { solid } = getSkillCategoryPalette(category);
      expect(solid).toMatch(/text-white|text-(?:\w+)-9(?:00|50)\b/);
    }
  });
});

describe("getSkillCategoryColor", () => {
  it("ajoute la bordure quand elle est demandée", () => {
    expect(getSkillCategoryColor("General", true)).toBe(
      "bg-blue-100 text-blue-900 border-blue-400",
    );
    expect(getSkillCategoryColor("General")).toBe("bg-blue-100 text-blue-900");
  });

  it("garde les Scélérates distinctes des Traits", () => {
    expect(getSkillCategoryColor("Scélérates")).not.toBe(
      getSkillCategoryColor("Trait"),
    );
    expect(getSkillCategoryColor("Scélérates")).not.toContain("gray");
  });

  it("couvre les variantes plurielles et le singulier des données", () => {
    expect(getSkillCategoryColor("Mutations")).toBe(
      getSkillCategoryColor("Mutation"),
    );
    expect(getSkillCategoryColor("Traits")).toBe(getSkillCategoryColor("Trait"));
    expect(getSkillCategoryColor("Scélérate")).toBe(
      getSkillCategoryColor("Scélérates"),
    );
  });

  it("laisse les Traits et Règles de Star Player hors code couleur (gris)", () => {
    for (const key of ["Trait", "Traits", "StarPlayerRule"]) {
      expect(SKILL_CATEGORY_COLORS[key].base).toContain("gray");
    }
  });

  it("retombe sur le gris neutre pour une catégorie inconnue ou absente", () => {
    expect(getSkillCategoryColor("Inconnue")).toBe("bg-gray-100 text-gray-600");
    expect(getSkillCategoryColor(null)).toBe("bg-gray-100 text-gray-600");
    expect(getSkillCategoryColor(undefined, true)).toBe(
      "bg-gray-100 text-gray-600 border-gray-300",
    );
    expect(getSkillAccessPalette(null).base).toBe("bg-gray-100 text-gray-600");
  });
});

describe("getSkillCategorySolidColor", () => {
  it("rend la variante pleine de la catégorie", () => {
    expect(getSkillCategorySolidColor("Strength")).toBe(
      "bg-red-600 text-white border-red-700",
    );
  });

  it("retombe sur le gris neutre pour une catégorie inconnue", () => {
    expect(getSkillCategorySolidColor("Inconnue")).toBe(
      "bg-gray-600 text-white border-gray-700",
    );
  });
});
