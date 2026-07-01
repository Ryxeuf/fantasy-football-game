import { describe, it, expect } from "vitest";
import { getSkillCategoryLabel } from "./skill-category-labels";

describe("getSkillCategoryLabel", () => {
  it("traduit les catégories stockées en anglais vers le français", () => {
    expect(getSkillCategoryLabel("Agility", "fr")).toBe("Agilité");
    expect(getSkillCategoryLabel("General", "fr")).toBe("Générale");
    expect(getSkillCategoryLabel("Strength", "fr")).toBe("Force");
    expect(getSkillCategoryLabel("Passing", "fr")).toBe("Passe");
    expect(getSkillCategoryLabel("Extraordinary", "fr")).toBe("Extraordinaire");
  });

  it("conserve les libellés anglais quand la langue est en", () => {
    expect(getSkillCategoryLabel("Agility", "en")).toBe("Agility");
    expect(getSkillCategoryLabel("Scélérates", "en")).toBe("Villainous");
  });

  it("gère les variantes singulier/pluriel", () => {
    expect(getSkillCategoryLabel("Mutations", "fr")).toBe("Mutation");
    expect(getSkillCategoryLabel("Traits", "fr")).toBe("Trait");
  });

  it("retombe sur la valeur brute pour une catégorie inconnue", () => {
    expect(getSkillCategoryLabel("Unknown", "fr")).toBe("Unknown");
  });
});
