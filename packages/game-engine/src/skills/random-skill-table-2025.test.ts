/**
 * Tests du Tableau de Compétences aléatoires p.121 (BB2025) et du tirage
 * `rollRandomPrimaryCandidates`.
 *
 * Garde-fou clé : chaque slug de la table DOIT exister dans le registre de
 * compétences (SKILLS_DEFINITIONS). Une faute de frappe dans un slug rendrait
 * la compétence inatteignable / rejetée à l'application → on la détecte ici.
 */

import { describe, it, expect } from "vitest";
import { SKILLS_DEFINITIONS, getSkillBySlug } from "./index";
import {
  RANDOM_PRIMARY_SKILL_TABLE_2025,
  rollRandomPrimaryCandidates,
  isRandomSkillCategory,
  type RandomSkillCategoryCode,
} from "./random-skill-table-2025";

const CATS: RandomSkillCategoryCode[] = ["A", "S", "G", "M", "P", "K"];

describe("RANDOM_PRIMARY_SKILL_TABLE_2025 (p.121)", () => {
  it("expose 6 catégories de 12 compétences, sans doublon", () => {
    for (const cat of CATS) {
      const list = RANDOM_PRIMARY_SKILL_TABLE_2025[cat];
      expect(list, cat).toHaveLength(12);
      expect(new Set(list).size, `doublon dans ${cat}`).toBe(12);
    }
  });

  it("chaque slug de la table existe dans le registre de compétences", () => {
    const known = new Set(SKILLS_DEFINITIONS.map((s) => s.slug));
    for (const cat of CATS) {
      for (const slug of RANDOM_PRIMARY_SKILL_TABLE_2025[cat]) {
        expect(known.has(slug), `slug inconnu: ${slug} (${cat})`).toBe(true);
        // sanity : getSkillBySlug le résout aussi.
        expect(getSkillBySlug(slug), slug).not.toBeNull();
      }
    }
  });

  it("aucun slug partagé entre deux catégories", () => {
    const seen = new Map<string, RandomSkillCategoryCode>();
    for (const cat of CATS) {
      for (const slug of RANDOM_PRIMARY_SKILL_TABLE_2025[cat]) {
        expect(
          seen.has(slug),
          `${slug} présent dans ${seen.get(slug)} ET ${cat}`,
        ).toBe(false);
        seen.set(slug, cat);
      }
    }
  });

  it("isRandomSkillCategory discrimine les codes valides", () => {
    expect(isRandomSkillCategory("G")).toBe(true);
    expect(isRandomSkillCategory("K")).toBe(true);
    expect(isRandomSkillCategory("Z")).toBe(false);
    expect(isRandomSkillCategory("")).toBe(false);
  });
});

describe("rollRandomPrimaryCandidates", () => {
  it("renvoie 2 candidats distincts de la catégorie par défaut", () => {
    const out = rollRandomPrimaryCandidates({
      category: "G",
      ownedSlugs: [],
      seed: "seed-1",
    });
    expect(out).toHaveLength(2);
    expect(out[0]).not.toBe(out[1]);
    for (const s of out) {
      expect(RANDOM_PRIMARY_SKILL_TABLE_2025.G).toContain(s);
    }
  });

  it("est déterministe pour un même seed, différent pour un autre", () => {
    const a = rollRandomPrimaryCandidates({
      category: "A",
      ownedSlugs: [],
      seed: "abc",
    });
    const b = rollRandomPrimaryCandidates({
      category: "A",
      ownedSlugs: [],
      seed: "abc",
    });
    expect(a).toEqual(b);
    const c = rollRandomPrimaryCandidates({
      category: "A",
      ownedSlugs: [],
      seed: "xyz",
    });
    // Très improbable d'être identique (12 skills) — sanity anti-régression.
    expect(c).not.toEqual(a);
  });

  it("exclut les compétences déjà possédées (reroll des doublons)", () => {
    const owned = RANDOM_PRIMARY_SKILL_TABLE_2025.G.slice(0, 10); // en garde 2 dispo
    const out = rollRandomPrimaryCandidates({
      category: "G",
      ownedSlugs: owned,
      seed: "s",
    });
    expect(out).toHaveLength(2);
    for (const s of out) expect(owned).not.toContain(s);
  });

  it("renvoie moins de 2 candidats si le pool disponible est trop petit", () => {
    const owned = RANDOM_PRIMARY_SKILL_TABLE_2025.G.slice(0, 11); // 1 seule dispo
    const out = rollRandomPrimaryCandidates({
      category: "G",
      ownedSlugs: owned,
      seed: "s",
    });
    expect(out).toHaveLength(1);
  });
});
