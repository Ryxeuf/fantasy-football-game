/**
 * Non-régression : indexation des accès compétences (primaire/secondaire) par
 * position pour la fiche d'équipe. Garantit que les badges d'accès affichés
 * par ligne de joueur retrouvent la bonne position et tolèrent les données
 * partielles (positions sans accès renseigné, roster pas encore chargé).
 */
import { describe, it, expect } from "vitest";
import { buildSkillAccessByPosition } from "./roster-skill-access";

describe("buildSkillAccessByPosition", () => {
  it("indexe l'accès primaire/secondaire par slug de position", () => {
    const map = buildSkillAccessByPosition([
      { slug: "goblin_bomba", primarySkills: "P,K", secondarySkills: "G,S" },
      {
        slug: "goblin_gobelin",
        primarySkills: "A,K",
        secondarySkills: "G,S,P",
      },
    ]);
    expect(map.size).toBe(2);
    expect(map.get("goblin_bomba")).toEqual({
      primary: "P,K",
      secondary: "G,S",
    });
    expect(map.get("goblin_gobelin")?.primary).toBe("A,K");
  });

  it("normalise les champs d'accès absents en null", () => {
    const map = buildSkillAccessByPosition([{ slug: "lizardmen_saurus" }]);
    expect(map.get("lizardmen_saurus")).toEqual({
      primary: null,
      secondary: null,
    });
  });

  it("ignore les entrées sans slug exploitable", () => {
    const map = buildSkillAccessByPosition([
      { slug: "", primarySkills: "G" },
      { primarySkills: "A" } as { primarySkills: string },
      { slug: "ok", primarySkills: "G" },
    ]);
    expect(map.size).toBe(1);
    expect(map.has("ok")).toBe(true);
  });

  it("tolère null / undefined (roster non chargé)", () => {
    expect(buildSkillAccessByPosition(null).size).toBe(0);
    expect(buildSkillAccessByPosition(undefined).size).toBe(0);
  });
});
