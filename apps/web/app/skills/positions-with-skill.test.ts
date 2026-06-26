import { describe, it, expect } from "vitest";
import {
  positionsWithStartingSkill,
  groupPositionsByRoster,
  type ApiPositionLite,
} from "./positions-with-skill";

const POSITIONS: ApiPositionLite[] = [
  {
    slug: "skaven_lineman",
    displayName: "Joueur de ligne",
    skills: "",
    rosterSlug: "skaven",
    rosterName: "Skavens",
  },
  {
    slug: "skaven_gutter_runner",
    displayName: "Coureur d'égouts",
    skills: "dodge",
    rosterSlug: "skaven",
    rosterName: "Skavens",
  },
  {
    slug: "wood_elf_catcher",
    displayName: "Receveur",
    skills: "catch,dodge,sprint",
    rosterSlug: "wood_elf",
    rosterName: "Elfes Sylvains",
  },
  {
    slug: "amazon_blitzer",
    displayName: "Ogre *",
    skills: "dodge,block",
    rosterSlug: "amazon",
    rosterName: "Amazones",
  },
];

describe("positionsWithStartingSkill", () => {
  it("ne garde que les positions démarrant avec la compétence", () => {
    const result = positionsWithStartingSkill(POSITIONS, "dodge");
    expect(result.map((p) => p.segment)).toBeDefined();
    // 3 positions ont "dodge" en compétence de départ (pas le lineman).
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.rosterSlug)).toBe(true);
  });

  it("construit le segment d'URL en retirant le préfixe roster", () => {
    const result = positionsWithStartingSkill(POSITIONS, "catch");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      rosterSlug: "wood_elf",
      segment: "catcher",
      displayName: "Receveur",
    });
  });

  it("nettoie le marqueur big-guy du nom affiché", () => {
    const result = positionsWithStartingSkill(POSITIONS, "block");
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe("Ogre");
  });

  it("trie par nom de roster puis nom de position", () => {
    const result = positionsWithStartingSkill(POSITIONS, "dodge");
    const rosters = result.map((p) => p.rosterName);
    expect(rosters).toEqual([...rosters].sort((a, b) => a.localeCompare(b, "fr")));
  });

  it("retourne vide pour une compétence inconnue ou un slug vide", () => {
    expect(positionsWithStartingSkill(POSITIONS, "wrestle")).toEqual([]);
    expect(positionsWithStartingSkill(POSITIONS, "")).toEqual([]);
  });
});

describe("groupPositionsByRoster", () => {
  it("groupe les positions par roster", () => {
    const groups = groupPositionsByRoster(POSITIONS, "dodge");
    // 3 rosters distincts (skaven, wood_elf, amazon).
    expect(groups).toHaveLength(3);
    const skaven = groups.find((g) => g.rosterSlug === "skaven");
    expect(skaven?.positions).toHaveLength(1);
    expect(skaven?.rosterName).toBe("Skavens");
  });
});
