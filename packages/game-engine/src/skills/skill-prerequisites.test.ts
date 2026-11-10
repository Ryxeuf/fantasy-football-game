import { describe, it, expect } from "vitest";
import { SKILLS_DEFINITIONS } from "./index";
import {
  meetsSkillPrerequisites,
  parseRequiredSkills,
} from "./skill-prerequisites";

describe("parseRequiredSkills", () => {
  it("rend une liste vide sans contrainte", () => {
    expect(parseRequiredSkills(null)).toEqual([]);
    expect(parseRequiredSkills(undefined)).toEqual([]);
    expect(parseRequiredSkills("")).toEqual([]);
  });

  it("nettoie et dédoublonne", () => {
    expect(parseRequiredSkills(" throw_team_mate, throw-team-mate,,stunty")).toEqual([
      "throw-team-mate",
      "stunty",
    ]);
  });
});

describe("meetsSkillPrerequisites", () => {
  it("laisse passer une compétence sans contrainte", () => {
    expect(meetsSkillPrerequisites(null, [])).toBe(true);
    expect(meetsSkillPrerequisites("", ["block"])).toBe(true);
  });

  it("refuse si le joueur n'a pas le prérequis", () => {
    expect(meetsSkillPrerequisites("throw-team-mate", ["brawler", "grab"])).toBe(false);
  });

  it("accepte si le joueur a le prérequis, même écrit à l'ancienne", () => {
    expect(meetsSkillPrerequisites("throw-team-mate", ["throw_team_mate"])).toBe(true);
  });

  it("traite plusieurs slugs comme des alternatives", () => {
    expect(meetsSkillPrerequisites("secret-weapon,stunty", ["stunty"])).toBe(true);
    expect(meetsSkillPrerequisites("secret-weapon,stunty", ["block"])).toBe(false);
  });

  it("ne compte pas Botte de Coéquipier pour Lancer de Coéquipier", () => {
    expect(meetsSkillPrerequisites("throw-team-mate", ["kick-team-mate"])).toBe(false);
  });
});

describe("registre des compétences", () => {
  const requiredBySlug = Object.fromEntries(
    SKILLS_DEFINITIONS.filter((s) => s.requiredSkills).map((s) => [
      s.slug,
      s.requiredSkills,
    ]),
  );

  it("déclare les prérequis du livre", () => {
    expect(requiredBySlug).toEqual({
      "strong-arm": ["throw-team-mate"],
      bullseye: ["throw-team-mate"],
      saboteur: ["secret-weapon"],
      "fatal-flight": ["stunty"],
    });
  });

  it("ne référence que des compétences connues", () => {
    const known = new Set(SKILLS_DEFINITIONS.map((s) => s.slug));
    for (const required of Object.values(requiredBySlug)) {
      for (const slug of required ?? []) expect(known.has(slug)).toBe(true);
    }
  });
});
