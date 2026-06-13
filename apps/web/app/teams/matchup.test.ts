import { describe, it, expect } from "vitest";
import {
  parseMatchup,
  canonicalMatchup,
  isCanonicalMatchup,
} from "./matchup";

describe("parseMatchup", () => {
  it("découpe un matchup valide en deux slugs", () => {
    expect(parseMatchup("skaven-vs-orc")).toEqual({ a: "skaven", b: "orc" });
  });

  it("gère les slugs à underscores sans confondre avec le séparateur", () => {
    expect(parseMatchup("old_world_alliance-vs-chaos_chosen")).toEqual({
      a: "old_world_alliance",
      b: "chaos_chosen",
    });
  });

  it("rejette un séparateur absent", () => {
    expect(parseMatchup("skaven_orc")).toBeNull();
    expect(parseMatchup("skaven")).toBeNull();
  });

  it("rejette les slugs identiques (comparaison avec soi-même)", () => {
    expect(parseMatchup("orc-vs-orc")).toBeNull();
  });

  it("rejette plus de deux participants", () => {
    expect(parseMatchup("orc-vs-skaven-vs-dwarf")).toBeNull();
  });

  it("rejette les caractères interdits (majuscules, tirets, espaces)", () => {
    expect(parseMatchup("Orc-vs-skaven")).toBeNull();
    expect(parseMatchup("black-orc-vs-skaven")).toBeNull();
    expect(parseMatchup("orc -vs- skaven")).toBeNull();
  });

  it("rejette les valeurs vides ou nulles", () => {
    expect(parseMatchup("")).toBeNull();
    expect(parseMatchup(undefined)).toBeNull();
    expect(parseMatchup(null)).toBeNull();
    expect(parseMatchup("-vs-orc")).toBeNull();
  });
});

describe("canonicalMatchup", () => {
  it("trie les deux slugs par ordre alphabétique", () => {
    expect(canonicalMatchup("skaven", "orc")).toBe("orc-vs-skaven");
    expect(canonicalMatchup("orc", "skaven")).toBe("orc-vs-skaven");
  });

  it("est stable quel que soit l'ordre d'entrée", () => {
    expect(canonicalMatchup("dwarf", "amazon")).toBe(
      canonicalMatchup("amazon", "dwarf"),
    );
  });
});

describe("isCanonicalMatchup", () => {
  it("vrai pour un matchup déjà trié", () => {
    expect(isCanonicalMatchup("orc-vs-skaven")).toBe(true);
  });

  it("faux pour l'ordre inverse", () => {
    expect(isCanonicalMatchup("skaven-vs-orc")).toBe(false);
  });

  it("faux pour un format invalide", () => {
    expect(isCanonicalMatchup("skaven")).toBe(false);
    expect(isCanonicalMatchup("orc-vs-orc")).toBe(false);
  });
});
