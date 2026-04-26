/**
 * Tests pour le builder de sameAs externes (Q.23 — Sprint 23).
 *
 * Q.23 vise a renforcer l identite d entite via Wikidata / Wikipedia.
 * La creation effective de l entree Wikidata est externe (manuelle),
 * mais le code expose un builder qui prend le QID + URLs Wikipedia
 * depuis l env et les ajoute au tableau sameAs du JSON-LD
 * Organization, avec validation defensive.
 */
import { describe, it, expect } from "vitest";
import {
  buildExternalSameAs,
  isValidWikidataQid,
  type ExternalIdentityEnv,
} from "./external-identity";

describe("isValidWikidataQid", () => {
  it("accepte un QID valide (Q + chiffres, 1-12)", () => {
    expect(isValidWikidataQid("Q42")).toBe(true);
    expect(isValidWikidataQid("Q1")).toBe(true);
    expect(isValidWikidataQid("Q123456789012")).toBe(true);
  });

  it("rejette un format invalide", () => {
    expect(isValidWikidataQid("42")).toBe(false);
    expect(isValidWikidataQid("Q")).toBe(false);
    expect(isValidWikidataQid("Q42abc")).toBe(false);
    expect(isValidWikidataQid("q42")).toBe(false); // doit etre majuscule
    expect(isValidWikidataQid("Q1234567890123")).toBe(false); // > 12 chiffres
    expect(isValidWikidataQid("")).toBe(false);
    expect(isValidWikidataQid(undefined)).toBe(false);
  });
});

describe("buildExternalSameAs", () => {
  it("retourne un tableau vide si aucune source fournie", () => {
    expect(buildExternalSameAs({})).toEqual([]);
    expect(buildExternalSameAs(undefined)).toEqual([]);
  });

  it("ajoute la page Wikidata canonique pour un QID valide", () => {
    const env: ExternalIdentityEnv = { NEXT_PUBLIC_WIKIDATA_QID: "Q42" };
    expect(buildExternalSameAs(env)).toContain("https://www.wikidata.org/wiki/Q42");
  });

  it("ignore un QID invalide silencieusement", () => {
    const env: ExternalIdentityEnv = { NEXT_PUBLIC_WIKIDATA_QID: "not-a-qid" };
    expect(buildExternalSameAs(env)).toEqual([]);
  });

  it("ajoute les URLs Wikipedia FR / EN si valides https", () => {
    const env: ExternalIdentityEnv = {
      NEXT_PUBLIC_WIKIPEDIA_FR_URL: "https://fr.wikipedia.org/wiki/Nuffle_Arena",
      NEXT_PUBLIC_WIKIPEDIA_EN_URL: "https://en.wikipedia.org/wiki/Nuffle_Arena",
    };
    const sameAs = buildExternalSameAs(env);
    expect(sameAs).toContain("https://fr.wikipedia.org/wiki/Nuffle_Arena");
    expect(sameAs).toContain("https://en.wikipedia.org/wiki/Nuffle_Arena");
  });

  it("rejette une URL Wikipedia hors domaine wikipedia.org", () => {
    const env: ExternalIdentityEnv = {
      NEXT_PUBLIC_WIKIPEDIA_FR_URL: "https://malicious.com/wiki/x",
    };
    expect(buildExternalSameAs(env)).toEqual([]);
  });

  it("rejette une URL non-https", () => {
    const env: ExternalIdentityEnv = {
      NEXT_PUBLIC_WIKIPEDIA_FR_URL: "http://fr.wikipedia.org/wiki/x",
    };
    expect(buildExternalSameAs(env)).toEqual([]);
  });

  it("dedoublonne en preservant l ordre", () => {
    const env: ExternalIdentityEnv = {
      NEXT_PUBLIC_WIKIDATA_QID: "Q42",
      NEXT_PUBLIC_WIKIPEDIA_FR_URL: "https://fr.wikipedia.org/wiki/x",
      NEXT_PUBLIC_WIKIPEDIA_EN_URL: "https://fr.wikipedia.org/wiki/x", // doublon
    };
    const sameAs = buildExternalSameAs(env);
    expect(sameAs.length).toBe(2);
  });

  it("est deterministe", () => {
    const env: ExternalIdentityEnv = {
      NEXT_PUBLIC_WIKIDATA_QID: "Q42",
      NEXT_PUBLIC_WIKIPEDIA_FR_URL: "https://fr.wikipedia.org/wiki/x",
    };
    expect(buildExternalSameAs(env)).toEqual(buildExternalSameAs(env));
  });
});
