/**
 * Tests pour `generateTeamName` (tâche O.8a — Sprint 22+).
 *
 * Le générateur doit :
 *  - produire une chaîne non vide pour chaque roster reconnu
 *  - être déterministe à seed constant (testabilité + reproductibilité)
 *  - utiliser des banques de mots cohérentes avec le thème (skaven →
 *    vocabulaire vermine, dwarf → vocabulaire forge, etc.)
 *  - retomber sur un fallback générique pour un roster inconnu plutôt que
 *    de jeter, pour éviter de casser un appel UI sur un slug récent.
 */

import { describe, it, expect } from "vitest";
import {
  generateTeamName,
  TEAM_NAME_FAMILIES,
  rosterToFamily,
} from "./team-name-generator";

describe("generateTeamName", () => {
  it("retourne une chaîne non vide pour chaque roster supporté", () => {
    const rosters = [
      "skaven",
      "lizardmen",
      "dwarf",
      "wood_elf",
      "dark_elf",
      "high_elf",
      "elven_union",
      "human",
      "imperial_nobility",
      "orc",
      "black_orc",
      "goblin",
      "snotling",
      "halfling",
      "ogre",
      "chaos_chosen",
      "chaos_renegade",
      "chaos_dwarf",
      "khorne",
      "nurgle",
      "undead",
      "necromantic_horror",
      "vampire",
      "tomb_kings",
      "amazon",
      "norse",
      "underworld",
      "slann",
      "gnome",
      "old_world_alliance",
    ];
    for (const roster of rosters) {
      const name = generateTeamName(roster, { seed: "test-seed-1" });
      expect(name.length).toBeGreaterThan(0);
      expect(name).not.toMatch(/undefined|null/);
    }
  });

  it("est déterministe pour une seed donnée", () => {
    const a = generateTeamName("skaven", { seed: "abc" });
    const b = generateTeamName("skaven", { seed: "abc" });
    expect(a).toBe(b);
  });

  it("produit des résultats différents pour des seeds différentes (en général)", () => {
    const seeds = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
    const names = seeds.map((s) => generateTeamName("skaven", { seed: s }));
    const unique = new Set(names);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("utilise un vocabulaire skaven cohérent", () => {
    const skavenWords = TEAM_NAME_FAMILIES.skaven.suffixes.join(" ").toLowerCase();
    expect(skavenWords).toMatch(/rat|vermin|plague|skitter|warp/);
  });

  it("utilise un vocabulaire dwarf cohérent", () => {
    const dwarfWords = TEAM_NAME_FAMILIES.dwarf.suffixes.join(" ").toLowerCase();
    expect(dwarfWords).toMatch(/forge|axe|hammer|beard|hold|stone/);
  });

  it("retombe sur la famille générique pour un roster inconnu", () => {
    const name = generateTeamName("unknown_roster", { seed: "x" });
    expect(name.length).toBeGreaterThan(0);
  });

  it("permet d'injecter un RNG personnalisé (testabilité avancée)", () => {
    const rng = () => 0; // toujours premier élément
    const name = generateTeamName("skaven", { rng });
    const firstPrefix = TEAM_NAME_FAMILIES.skaven.prefixes[0];
    const firstSuffix = TEAM_NAME_FAMILIES.skaven.suffixes[0];
    expect(name).toBe(`${firstPrefix} ${firstSuffix}`);
  });

  it("utilise rosterToFamily pour mapper un roster vers sa famille", () => {
    expect(rosterToFamily("skaven")).toBe("skaven");
    expect(rosterToFamily("imperial_nobility")).toBe("human");
    expect(rosterToFamily("black_orc")).toBe("orc");
    expect(rosterToFamily("necromantic_horror")).toBe("undead");
    expect(rosterToFamily("khorne")).toBe("chaos");
    expect(rosterToFamily("unknown_roster")).toBe("generic");
  });

  it("génère un nom au format `<Préfixe> <Suffixe>` (Title Case)", () => {
    const name = generateTeamName("skaven", { seed: "fmt" });
    expect(name).toMatch(/^[A-Z][\p{L}'-]*( [A-Z][\p{L}'-]*)+$/u);
  });
});
