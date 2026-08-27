/**
 * Non-régression : indexation des accès compétences (primaire/secondaire) par
 * position pour la fiche d'équipe. Garantit que les badges d'accès affichés
 * par ligne de joueur retrouvent la bonne position et tolèrent les données
 * partielles (positions sans accès renseigné, roster pas encore chargé).
 */
import { describe, it, expect } from "vitest";
import {
  buildSkillAccessByPosition,
  buildPositionMetaByPosition,
  makePositionResolvers,
} from "./roster-skill-access";

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

describe("buildPositionMetaByPosition", () => {
  it("parse les compétences de base (DB) en slugs et indexe les mots-clés", () => {
    const map = buildPositionMetaByPosition([
      {
        slug: "old_world_alliance_ogre",
        skills: "cerveau_lent, chataigne, crane_epais",
        keywords: "Ogre, Gros Bras",
        keywordsEn: "Ogre, Big Guy",
      },
    ]);
    const meta = map.get("old_world_alliance_ogre");
    expect(meta?.baseSkills).toEqual([
      "cerveau_lent",
      "chataigne",
      "crane_epais",
    ]);
    expect(meta?.keywords).toBe("Ogre, Gros Bras");
    expect(meta?.keywordsEn).toBe("Ogre, Big Guy");
  });

  it("retourne une liste vide de compétences de base si aucune", () => {
    const map = buildPositionMetaByPosition([
      { slug: "skaven_lineman", skills: "", keywords: null },
    ]);
    expect(map.get("skaven_lineman")?.baseSkills).toEqual([]);
    expect(map.get("skaven_lineman")?.keywords).toBeNull();
  });

  it("indexe l'illustration du poste (portrait par défaut des cartes)", () => {
    const map = buildPositionMetaByPosition([
      {
        slug: "amazon_guerriere_aigle",
        imageUrl: "/images/positions/amazon_guerriere_aigle.png",
      },
      { slug: "skaven_lineman" },
    ]);
    expect(map.get("amazon_guerriere_aigle")?.imageUrl).toBe(
      "/images/positions/amazon_guerriere_aigle.png",
    );
    expect(map.get("skaven_lineman")?.imageUrl).toBeNull();
  });

  it("ignore les entrées sans slug et tolère null/undefined", () => {
    expect(buildPositionMetaByPosition(null).size).toBe(0);
    expect(
      buildPositionMetaByPosition([{ skills: "block" } as { skills: string }])
        .size,
    ).toBe(0);
  });
});

/**
 * Audit statique vs base — lot 5 (W1, W11) : le coût d'embauche et le libellé
 * d'un poste viennent de `Position.cost` / `Position.displayName` (base). Le
 * catalogue compilé du moteur ne sert plus que de repli, sinon la colonne
 * « Coût », la carte PNG et le PDF divergent de la VE servie par l'API.
 */
describe("makePositionResolvers", () => {
  const meta = buildPositionMetaByPosition([
    {
      slug: "human_lineman",
      displayName: "Trois-quarts (corrigé)",
      // `Position.cost` est en kpo en base, la VE se compte en po.
      cost: 60,
      skills: "",
    },
    // Poste sans coût ni libellé côté API (payload partiel).
    { slug: "human_blitzer", skills: "block" },
  ]);
  const fallback = {
    cost: () => 999_000,
    displayName: (slug: string) => `FB-${slug}`,
  };

  it("sert le coût de la base, converti en po", () => {
    const r = makePositionResolvers(meta, fallback);
    expect(r.costPo("human_lineman", "human")).toBe(60_000);
  });

  it("sert le libellé de la base", () => {
    const r = makePositionResolvers(meta, fallback);
    expect(r.displayName("human_lineman")).toBe("Trois-quarts (corrigé)");
  });

  it("retombe sur le catalogue quand la base ne porte pas la valeur", () => {
    const r = makePositionResolvers(meta, fallback);
    expect(r.costPo("human_blitzer", "human")).toBe(999_000);
    expect(r.displayName("human_blitzer")).toBe("FB-human_blitzer");
  });

  it("retombe sur le catalogue pour un poste absent de la carte", () => {
    const r = makePositionResolvers(meta, fallback);
    expect(r.costPo("inconnu", "human")).toBe(999_000);
    expect(r.displayName("inconnu")).toBe("FB-inconnu");
  });

  it("un coût de 0 en base est une valeur, pas une absence", () => {
    const zero = buildPositionMetaByPosition([
      { slug: "journeyman", displayName: "Journalier", cost: 0, skills: "" },
    ]);
    expect(makePositionResolvers(zero, fallback).costPo("journeyman", "x")).toBe(
      0,
    );
  });
});
