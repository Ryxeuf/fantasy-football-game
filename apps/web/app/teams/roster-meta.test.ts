import { describe, it, expect } from "vitest";
import {
  ROSTER_META,
  getRosterMeta,
  BEGINNER_FRIENDLY_SLUGS,
  DIFFICULTY_RANK,
  DIFFICULTY_LABELS,
  PLAYSTYLE_LABELS,
} from "./roster-meta";

// Les 30 rosters officiels Saison 3 (clés de SEASON_THREE_ROSTERS).
const EXPECTED_SLUGS = [
  "old_world_alliance",
  "amazon",
  "underworld",
  "dark_elf",
  "wood_elf",
  "chaos_chosen",
  "gnome",
  "goblin",
  "halfling",
  "high_elf",
  "lizardmen",
  "necromantic_horror",
  "human",
  "khorne",
  "undead",
  "chaos_dwarf",
  "dwarf",
  "imperial_nobility",
  "norse",
  "nurgle",
  "ogre",
  "black_orc",
  "orc",
  "chaos_renegade",
  "tomb_kings",
  "skaven",
  "slann",
  "snotling",
  "elven_union",
  "vampire",
];

describe("ROSTER_META", () => {
  it("couvre les 30 rosters officiels", () => {
    expect(Object.keys(ROSTER_META).sort()).toEqual([...EXPECTED_SLUGS].sort());
  });

  it("fournit une parité fr/en pour chaque résumé", () => {
    for (const [slug, meta] of Object.entries(ROSTER_META)) {
      expect(meta.shortFr.length, `${slug} shortFr`).toBeGreaterThan(0);
      expect(meta.shortEn.length, `${slug} shortEn`).toBeGreaterThan(0);
    }
  });

  it("n'utilise que des difficultés et styles connus", () => {
    for (const [slug, meta] of Object.entries(ROSTER_META)) {
      expect(DIFFICULTY_LABELS.fr[meta.difficulty], `${slug} difficulty`).toBeTruthy();
      expect(PLAYSTYLE_LABELS.fr[meta.playStyle], `${slug} playStyle`).toBeTruthy();
    }
  });
});

describe("getRosterMeta", () => {
  it("retourne la métadonnée curée pour un slug connu", () => {
    expect(getRosterMeta("skaven").playStyle).toBe("agile");
  });

  it("retourne un repli sûr pour un slug inconnu", () => {
    const meta = getRosterMeta("inconnu_xyz");
    expect(meta.difficulty).toBe("intermediate");
    expect(meta.starPlayers).toEqual([]);
  });
});

describe("BEGINNER_FRIENDLY_SLUGS", () => {
  it("liste au moins quelques équipes accessibles aux débutants", () => {
    expect(BEGINNER_FRIENDLY_SLUGS.length).toBeGreaterThanOrEqual(3);
    expect(BEGINNER_FRIENDLY_SLUGS).toContain("human");
  });

  it("ne contient que des équipes marquées beginnerFriendly", () => {
    for (const slug of BEGINNER_FRIENDLY_SLUGS) {
      expect(ROSTER_META[slug].beginnerFriendly).toBe(true);
    }
  });
});

describe("DIFFICULTY_RANK", () => {
  it("ordonne du plus accessible au plus exigeant", () => {
    expect(DIFFICULTY_RANK.beginner).toBeLessThan(DIFFICULTY_RANK.intermediate);
    expect(DIFFICULTY_RANK.intermediate).toBeLessThan(DIFFICULTY_RANK.advanced);
  });
});
