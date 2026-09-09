import { describe, it, expect } from "vitest";
import {
  SKILL_CATEGORY_COLORS,
  getSkillCategoryColor,
} from "./skill-category-colors";

describe("getSkillCategoryColor", () => {
  it("donne aux Scélérates une couleur DISTINCTE des Traits", () => {
    const villain = getSkillCategoryColor("Scélérates");
    const trait = getSkillCategoryColor("Trait");
    expect(villain).not.toBe(trait);
    // Le bug : les Scélérates tombaient sur le gris du cas par défaut.
    expect(villain).not.toContain("gray");
    expect(villain).toContain("amber");
  });

  it("donne aux Scélérates une couleur distincte de TOUTES les autres", () => {
    const villain = getSkillCategoryColor("Scélérates");
    const others = Object.entries(SKILL_CATEGORY_COLORS)
      .filter(([key]) => key !== "Scélérates")
      .map(([, value]) => value.base);
    expect(others).not.toContain(villain);
  });

  it("ajoute la bordure quand elle est demandée", () => {
    expect(getSkillCategoryColor("Scélérates", true)).toBe(
      "bg-amber-100 text-amber-800 border-amber-400",
    );
    expect(getSkillCategoryColor("Scélérates")).toBe(
      "bg-amber-100 text-amber-800",
    );
  });

  it("conserve les couleurs historiques des catégories connues", () => {
    expect(getSkillCategoryColor("General")).toBe("bg-blue-100 text-blue-800");
    expect(getSkillCategoryColor("Agility")).toBe("bg-green-100 text-green-800");
    expect(getSkillCategoryColor("Strength")).toBe("bg-red-100 text-red-800");
    expect(getSkillCategoryColor("Passing")).toBe(
      "bg-purple-100 text-purple-800",
    );
    expect(getSkillCategoryColor("Mutation")).toBe(
      "bg-orange-100 text-orange-800",
    );
    expect(getSkillCategoryColor("Trait")).toBe("bg-gray-100 text-gray-800");
  });

  it("couvre les variantes plurielles des données", () => {
    expect(getSkillCategoryColor("Mutations")).toBe(
      getSkillCategoryColor("Mutation"),
    );
    expect(getSkillCategoryColor("Traits")).toBe(getSkillCategoryColor("Trait"));
  });

  it("retombe sur le gris neutre pour une catégorie inconnue ou absente", () => {
    expect(getSkillCategoryColor("Inconnue")).toBe("bg-gray-100 text-gray-600");
    expect(getSkillCategoryColor(null)).toBe("bg-gray-100 text-gray-600");
    expect(getSkillCategoryColor(undefined, true)).toBe(
      "bg-gray-100 text-gray-600 border-gray-300",
    );
  });
});
