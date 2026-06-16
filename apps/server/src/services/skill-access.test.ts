/**
 * Tests du helper d'accès compétences primaire/secondaire (C2).
 * Couvre les fonctions pures (mapping catégorie, normalisation F→S, parse CSV,
 * décision d'accès) + `categoryCodeForSkill` avec prisma mocké.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: { skill: { findFirst: vi.fn() } },
}));

import { prisma } from "../prisma";
import {
  dbCategoryToCode,
  normalizeAccessLetter,
  parseAccessCsv,
  checkSkillAccess,
  categoryCodeForSkill,
  toCanonicalAccessCsv,
} from "./skill-access";

type MockFn = ReturnType<typeof vi.fn>;
const skillFind = prisma.skill.findFirst as MockFn;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("dbCategoryToCode", () => {
  it("mappe les catégories pickables vers leur code", () => {
    expect(dbCategoryToCode("General")).toBe("G");
    expect(dbCategoryToCode("Agility")).toBe("A");
    expect(dbCategoryToCode("Strength")).toBe("S");
    expect(dbCategoryToCode("Passing")).toBe("P");
    expect(dbCategoryToCode("Mutation")).toBe("M");
    expect(dbCategoryToCode("Scélérates")).toBe("K"); // Sournoiserie
  });

  it("renvoie null pour les catégories non pickables ou nulles", () => {
    expect(dbCategoryToCode("Trait")).toBeNull();
    expect(dbCategoryToCode("Extraordinary")).toBeNull();
    expect(dbCategoryToCode(null)).toBeNull();
    expect(dbCategoryToCode(undefined)).toBeNull();
  });
});

describe("normalizeAccessLetter", () => {
  it("replie F (Force, FR) sur S (Strength)", () => {
    expect(normalizeAccessLetter("F")).toBe("S");
    expect(normalizeAccessLetter("f")).toBe("S");
  });

  it("garde les autres codes canoniques (dont K = Sournoiserie)", () => {
    for (const c of ["G", "A", "S", "P", "M", "K"]) {
      expect(normalizeAccessLetter(c)).toBe(c);
    }
    expect(normalizeAccessLetter(" a ")).toBe("A");
    expect(normalizeAccessLetter("k")).toBe("K");
  });

  it("renvoie null pour une lettre inconnue", () => {
    expect(normalizeAccessLetter("X")).toBeNull();
    expect(normalizeAccessLetter("")).toBeNull();
  });
});

describe("parseAccessCsv", () => {
  it("parse un CSV en Set de codes (avec normalisation F→S)", () => {
    expect([...parseAccessCsv("G,S")].sort()).toEqual(["G", "S"]);
    expect([...parseAccessCsv("G,F")].sort()).toEqual(["G", "S"]); // F→S
    expect([...parseAccessCsv("SF")].sort()).toEqual(["S"]); // doublon S/F fusionné
  });

  it("renvoie un Set vide pour null/undefined/''", () => {
    expect(parseAccessCsv(null).size).toBe(0);
    expect(parseAccessCsv(undefined).size).toBe(0);
    expect(parseAccessCsv("").size).toBe(0);
  });
});

describe("checkSkillAccess", () => {
  const access = { primarySkills: "G,S", secondarySkills: "A" };

  it("ok quand la skill est dans le pool primaire (type primary)", () => {
    expect(
      checkSkillAccess({ type: "primary", skillCode: "S", ...access }),
    ).toBe("ok");
    expect(
      checkSkillAccess({ type: "random-primary", skillCode: "G", ...access }),
    ).toBe("ok");
  });

  it("ok quand la skill est dans le pool secondaire (type secondary)", () => {
    expect(
      checkSkillAccess({ type: "secondary", skillCode: "A", ...access }),
    ).toBe("ok");
    expect(
      checkSkillAccess({
        type: "random-secondary",
        skillCode: "A",
        ...access,
      }),
    ).toBe("ok");
  });

  it("out-of-pool quand la catégorie n'est pas dans le pool du type", () => {
    expect(
      checkSkillAccess({ type: "primary", skillCode: "A", ...access }),
    ).toBe("out-of-pool"); // A est secondaire, pas primaire
    expect(
      checkSkillAccess({ type: "secondary", skillCode: "S", ...access }),
    ).toBe("out-of-pool");
  });

  it("ok pour une skill Sournoiserie (K) si K est dans le pool", () => {
    expect(
      checkSkillAccess({
        type: "primary",
        skillCode: "K",
        primarySkills: "A,S,K",
        secondarySkills: "G",
      }),
    ).toBe("ok");
    expect(
      checkSkillAccess({
        type: "primary",
        skillCode: "K",
        primarySkills: "G,S",
        secondarySkills: "A",
      }),
    ).toBe("out-of-pool");
  });

  it("out-of-pool quand la skill n'est pas catégorisable (skillCode null)", () => {
    expect(
      checkSkillAccess({ type: "primary", skillCode: null, ...access }),
    ).toBe("out-of-pool");
  });

  it("no-data quand les deux colonnes sont null (validation désactivée)", () => {
    expect(
      checkSkillAccess({
        type: "primary",
        skillCode: "M",
        primarySkills: null,
        secondarySkills: null,
      }),
    ).toBe("no-data");
  });

  it("traite '' comme renseigné mais vide (position animale sans primaire)", () => {
    // primaire vide, secondaire A : un pick primaire est hors-pool.
    expect(
      checkSkillAccess({
        type: "primary",
        skillCode: "A",
        primarySkills: "",
        secondarySkills: "A",
      }),
    ).toBe("out-of-pool");
    // mais un pick secondaire A est ok.
    expect(
      checkSkillAccess({
        type: "secondary",
        skillCode: "A",
        primarySkills: "",
        secondarySkills: "A",
      }),
    ).toBe("ok");
  });
});

describe("toCanonicalAccessCsv", () => {
  it("ordonne et dédoublonne en CSV canonique (G,A,S,P,M,K)", () => {
    expect(toCanonicalAccessCsv("S,G")).toBe("G,S");
    expect(toCanonicalAccessCsv("a g")).toBe("G,A");
    expect(toCanonicalAccessCsv("M,P,A,S,G")).toBe("G,A,S,P,M");
    expect(toCanonicalAccessCsv("K,G,A")).toBe("G,A,K"); // Sournoiserie en fin
  });
  it("replie F→S et dédoublonne", () => {
    expect(toCanonicalAccessCsv("G,F")).toBe("G,S");
    expect(toCanonicalAccessCsv("SF")).toBe("S");
  });
  it("renvoie '' pour une saisie vide ou invalide", () => {
    expect(toCanonicalAccessCsv("")).toBe("");
    expect(toCanonicalAccessCsv("XYZ")).toBe("");
  });
});

describe("categoryCodeForSkill", () => {
  it("résout le code via la table Skill (slug + ruleset)", async () => {
    skillFind.mockResolvedValue({ category: "Strength" });
    const code = await categoryCodeForSkill("mighty-blow", "season_3");
    expect(code).toBe("S");
    expect(skillFind).toHaveBeenCalledWith({
      where: { slug: "mighty-blow", ruleset: "season_3" },
      select: { category: true },
    });
  });

  it("renvoie null si la skill est introuvable", async () => {
    skillFind.mockResolvedValue(null);
    expect(await categoryCodeForSkill("inconnue", "season_3")).toBeNull();
  });

  it("renvoie null si la catégorie n'est pas pickable", async () => {
    skillFind.mockResolvedValue({ category: "Trait" });
    expect(await categoryCodeForSkill("loner", "season_3")).toBeNull();
  });
});
