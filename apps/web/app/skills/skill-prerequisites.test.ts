import { describe, it, expect } from "vitest";
import {
  parseRequiredSkillSlugs,
  resolveSkillPrerequisites,
} from "./skill-prerequisites";

describe("parseRequiredSkillSlugs", () => {
  it("rend une liste vide sans prérequis", () => {
    expect(parseRequiredSkillSlugs(null)).toEqual([]);
    expect(parseRequiredSkillSlugs("")).toEqual([]);
  });

  it("découpe le CSV", () => {
    expect(parseRequiredSkillSlugs("stunty, secret-weapon")).toEqual([
      "stunty",
      "secret-weapon",
    ]);
  });
});

describe("resolveSkillPrerequisites", () => {
  const catalog = [
    { slug: "throw-team-mate", nameFr: "Lancer de Coéquipier", nameEn: "Throw Team-Mate" },
  ];

  it("nomme le prérequis depuis le catalogue", () => {
    expect(resolveSkillPrerequisites("throw-team-mate", catalog)).toEqual([
      { slug: "throw-team-mate", nameFr: "Lancer de Coéquipier", nameEn: "Throw Team-Mate" },
    ]);
  });

  it("affiche le slug d'un prérequis inconnu", () => {
    expect(resolveSkillPrerequisites("mystery", catalog)[0].nameFr).toBe("mystery");
  });
});
