/**
 * Non-régression : le Bombardier du Bomba gobelin ne doit PAS s'afficher en
 * double "Arme Secrète".
 *
 * Le Bomba a, par règle BB, à la fois la compétence `bombardier` ET le trait
 * `secret-weapon`. Un ancien alias `"bombardier" -> "secret-weapon"` dans la
 * table FR→EN écrasait `bombardier`, faisant apparaître "Arme Secrète" deux
 * fois (et masquant "Bombardier"). `bombardier` est désormais une vraie
 * compétence du game-engine : `parseSkills` doit le conserver tel quel.
 */
import { describe, it, expect } from "vitest";
import { parseSkills } from "./skills-data";

describe("parseSkills — non-régression Bomba gobelin", () => {
  it("Season 3 : conserve bombardier et ne duplique pas secret-weapon", () => {
    const slugs = parseSkills("secret-weapon,bombardier,dodge,titchy");
    expect(slugs).toEqual(["secret-weapon", "bombardier", "dodge", "titchy"]);
    // Le bug doublait secret-weapon : on garantit une seule occurrence.
    expect(slugs.filter((s) => s === "secret-weapon")).toHaveLength(1);
    expect(slugs).toContain("bombardier");
  });

  it("Season 2 : bombardier non écrasé, secret-weapon unique", () => {
    const slugs = parseSkills("bombardier,dodge,secret-weapon,stunty");
    expect(slugs).toEqual(["bombardier", "dodge", "secret-weapon", "stunty"]);
    expect(slugs.filter((s) => s === "secret-weapon")).toHaveLength(1);
  });

  it("bombardier seul résout vers le slug bombardier", () => {
    expect(parseSkills("bombardier")).toEqual(["bombardier"]);
  });

  it("secret-weapon reste résolu indépendamment", () => {
    expect(parseSkills("secret-weapon")).toEqual(["secret-weapon"]);
  });
});
