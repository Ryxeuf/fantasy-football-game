import { describe, expect, it } from "vitest";
import { randomSkillSlugs } from "./random-skills";

describe("randomSkillSlugs", () => {
  it("rend les compétences au hasard (isRandom ou type random-*)", () => {
    const raw = JSON.stringify([
      { skillSlug: "block", type: "primary", isRandom: false, at: 1 },
      { skillSlug: "dodge", type: "random-primary", isRandom: true, at: 2 },
      { skillSlug: "guard", type: "random-secondary", isRandom: false, at: 3 },
      { skillSlug: "tackle", type: "secondary", isRandom: true, at: 4 },
    ]);
    expect(randomSkillSlugs(raw)).toEqual(["dodge", "guard", "tackle"]);
  });

  it("ignore les caractéristiques (pas de skillSlug)", () => {
    expect(
      randomSkillSlugs([
        { type: "characteristic", stat: "ag", d8: 7, isRandom: true, at: 1 },
      ]),
    ).toEqual([]);
  });

  it("accepte un tableau natif (Postgres) et dédoublonne", () => {
    expect(
      randomSkillSlugs([
        { skillSlug: "dodge", type: "random-primary", isRandom: true },
        { skillSlug: "dodge", type: "random-primary", isRandom: true },
      ]),
    ).toEqual(["dodge"]);
  });

  it.each([null, undefined, "", "[]", "pas du json", "{}", 42, { a: 1 }])(
    "donnée absente ou illisible (%s) ⇒ liste vide",
    (raw) => {
      expect(randomSkillSlugs(raw)).toEqual([]);
    },
  );

  it("ignore les entrées malformées", () => {
    expect(
      randomSkillSlugs([null, 3, "x", { skillSlug: "", isRandom: true }, { skillSlug: 5, isRandom: true }]),
    ).toEqual([]);
  });
});
