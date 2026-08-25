/**
 * Règles pures de l'allocateur d'améliorations au build : accès, doublons,
 * compétences déjà possédées, barème PSP standard vs règlement de tournoi,
 * surcoût Élite et quota de cumul.
 */

import { describe, expect, it } from "vitest";
import {
  groupByCategory,
  matchesSearch,
  parseAccessCodes,
  parseSkillSlugs,
  planSppTotal,
  planVeSurcharge,
  skillOptionsFor,
  skillSppCost,
  stackingUsage,
  veSurchargeFor,
  type BuildAdvancement,
  type SkillCatalogItem,
} from "./build-advancement-rules";

const CATALOG: SkillCatalogItem[] = [
  { slug: "block", nameFr: "Blocage", category: "General", isElite: true },
  { slug: "tackle", nameFr: "Tacle", category: "General" },
  { slug: "pro", nameFr: "Pro", category: "General", excludedFromSelection: true },
  { slug: "dodge", nameFr: "Esquive", category: "Agility", isElite: true },
  { slug: "guard", nameFr: "Garde", category: "Strength", isElite: true },
];

const OGRE = {
  slug: "ogre_blocker",
  displayName: "Bloqueur Ogre",
  skills: "bone-head,mighty-blow-1,thick-skull,tackle",
  primarySkills: "F,S",
  secondarySkills: "G,A",
};

describe("parseAccessCodes / parseSkillSlugs", () => {
  it("accepte CSV et chaîne compacte, F alias de S", () => {
    expect([...parseAccessCodes("G,A")].sort()).toEqual(["A", "G"]);
    expect([...parseAccessCodes("GS")].sort()).toEqual(["G", "S"]);
    expect([...parseAccessCodes("F")]).toEqual(["S"]);
    expect([...parseAccessCodes(null)]).toEqual([]);
  });

  it("découpe les compétences de base d'un poste", () => {
    expect(parseSkillSlugs("block, dodge")).toEqual(["block", "dodge"]);
    expect(parseSkillSlugs(null)).toEqual([]);
  });
});

describe("skillOptionsFor", () => {
  it("limite aux catégories accessibles au type demandé", () => {
    // Principale de l'Ogre = F(→S) : seule Garde (Force) est proposée.
    const primary = skillOptionsFor({
      catalog: CATALOG,
      position: OGRE,
      type: "primary",
      slot: 0,
      pickedSlugs: [],
    });
    expect(primary.map((o) => o.skill.slug)).toEqual(["guard"]);

    // Secondaire = G, A.
    const secondary = skillOptionsFor({
      catalog: CATALOG,
      position: OGRE,
      type: "secondary",
      slot: 0,
      pickedSlugs: [],
    });
    expect(secondary.map((o) => o.skill.slug).sort()).toEqual([
      "block",
      "dodge",
      "pro",
      "tackle",
    ]);
  });

  it("bloque une compétence déjà possédée par le poste", () => {
    const options = skillOptionsFor({
      catalog: CATALOG,
      position: OGRE,
      type: "secondary",
      slot: 0,
      pickedSlugs: [],
    });
    expect(options.find((o) => o.skill.slug === "tackle")?.blocked).toBe("owned");
  });

  it("bloque une compétence déjà choisie sur ce joueur", () => {
    const options = skillOptionsFor({
      catalog: CATALOG,
      position: OGRE,
      type: "secondary",
      slot: 1,
      pickedSlugs: ["block"],
    });
    expect(options.find((o) => o.skill.slug === "block")?.blocked).toBe("picked");
  });

  it("bloque une compétence retirée de la sélection", () => {
    const options = skillOptionsFor({
      catalog: CATALOG,
      position: OGRE,
      type: "secondary",
      slot: 0,
      pickedSlugs: [],
    });
    expect(options.find((o) => o.skill.slug === "pro")?.blocked).toBe("excluded");
  });

  it("ouvre toutes les catégories quand l'accès n'est pas renseigné", () => {
    const options = skillOptionsFor({
      catalog: CATALOG,
      position: { slug: "s2", displayName: "S2" },
      type: "primary",
      slot: 0,
      pickedSlugs: [],
    });
    expect(options).toHaveLength(CATALOG.length);
  });

  it("expose la catégorie et le statut Élite", () => {
    const [guard] = skillOptionsFor({
      catalog: CATALOG,
      position: OGRE,
      type: "primary",
      slot: 0,
      pickedSlugs: [],
    });
    expect(guard.category).toBe("S");
    expect(guard.isElite).toBe(true);
  });
});

describe("barème PSP", () => {
  it("suit le barème BB2025 hors règlement", () => {
    expect(skillSppCost(0, "primary", "block")).toBe(6);
    expect(skillSppCost(1, "primary", "block")).toBe(8);
    expect(skillSppCost(0, "secondary", "block")).toBe(10);
    expect(skillSppCost(1, "secondary", "block")).toBe(12);
  });

  it("totalise un plan avec un coût croissant par joueur", () => {
    const plan: BuildAdvancement[] = [
      { positionSlug: "a", ordinal: 0, type: "primary", skillSlug: "block" },
      { positionSlug: "a", ordinal: 0, type: "primary", skillSlug: "tackle" },
      { positionSlug: "a", ordinal: 1, type: "secondary", skillSlug: "dodge" },
    ];
    expect(planSppTotal(plan)).toBe(6 + 8 + 10);
  });
});

describe("surcoût de Valeur d'Équipe", () => {
  it("ajoute 10 000 po pour une compétence Élite", () => {
    expect(veSurchargeFor("primary", false)).toBe(20_000);
    expect(veSurchargeFor("primary", true)).toBe(30_000);
    expect(veSurchargeFor("secondary", true)).toBe(50_000);
  });

  it("totalise le surcoût VE d'un plan", () => {
    const plan: BuildAdvancement[] = [
      { positionSlug: "a", ordinal: 0, type: "primary", skillSlug: "block" },
      { positionSlug: "a", ordinal: 1, type: "primary", skillSlug: "tackle" },
    ];
    expect(planVeSurcharge(plan, new Set(["block"]))).toBe(30_000 + 20_000);
  });
});

describe("quota de cumul", () => {
  const plan: BuildAdvancement[] = [
    { positionSlug: "a", ordinal: 0, type: "primary", skillSlug: "block" },
    { positionSlug: "a", ordinal: 0, type: "primary", skillSlug: "tackle" },
  ];

  it("illimité hors règlement", () => {
    expect(stackingUsage(plan)).toEqual({
      used: 1,
      max: Number.POSITIVE_INFINITY,
    });
  });

});

describe("recherche et regroupement", () => {
  const options = skillOptionsFor({
    catalog: CATALOG,
    position: { slug: "any", displayName: "Any" },
    type: "primary",
    slot: 0,
    pickedSlugs: [],
  });

  it("cherche sur le nom FR, le nom EN et le slug", () => {
    const block = options.find((o) => o.skill.slug === "block")!;
    expect(matchesSearch(block, "bloc")).toBe(true);
    expect(matchesSearch(block, "BLOCK")).toBe(true);
    expect(matchesSearch(block, "esqu")).toBe(false);
    expect(matchesSearch(block, "   ")).toBe(true);
  });

  it("groupe par catégorie dans l'ordre canonique", () => {
    expect(groupByCategory(options).map((g) => g.code)).toEqual(["G", "A", "S"]);
  });
});
