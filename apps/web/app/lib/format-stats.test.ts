/**
 * Non-régression : formatage BB des caractéristiques. AG/PA/AV doivent
 * s'afficher suffixées d'un "+" (objectif de jet de dé), MA/ST en valeur
 * brute. Couvre le helper partagé utilisé par la fiche d'équipe, le builder,
 * l'éditeur, le panneau de trésorerie et les pages pro-league.
 */
import { describe, it, expect } from "vitest";
import { formatPlusStat, isPlusStat, formatStatByLabel } from "./format-stats";

describe("formatPlusStat", () => {
  it("suffixe une valeur numérique d'un '+'", () => {
    expect(formatPlusStat(3)).toBe("3+");
    expect(formatPlusStat(8)).toBe("8+");
    expect(formatPlusStat(0)).toBe("0+");
  });

  it("rend '-' (sans '+') pour une valeur absente", () => {
    expect(formatPlusStat(null)).toBe("-");
    expect(formatPlusStat(undefined)).toBe("-");
  });
});

describe("isPlusStat", () => {
  it("vrai pour AG/PA/AV, insensible à la casse et aux espaces", () => {
    expect(isPlusStat("AG")).toBe(true);
    expect(isPlusStat("PA")).toBe(true);
    expect(isPlusStat("AV")).toBe(true);
    expect(isPlusStat(" ag ")).toBe(true);
    expect(isPlusStat("Av")).toBe(true);
  });

  it("faux pour MA/ST et toute autre caractéristique", () => {
    expect(isPlusStat("MA")).toBe(false);
    expect(isPlusStat("ST")).toBe(false);
    expect(isPlusStat("PM")).toBe(false);
    expect(isPlusStat("")).toBe(false);
  });
});

describe("formatStatByLabel", () => {
  it("ajoute '+' pour AG/PA/AV", () => {
    expect(formatStatByLabel("AG", 3)).toBe("3+");
    expect(formatStatByLabel("PA", 4)).toBe("4+");
    expect(formatStatByLabel("AV", 9)).toBe("9+");
  });

  it("laisse MA/ST en valeur brute", () => {
    expect(formatStatByLabel("MA", 6)).toBe("6");
    expect(formatStatByLabel("ST", 3)).toBe("3");
  });

  it("rend '-' pour une valeur absente quelle que soit la caractéristique", () => {
    expect(formatStatByLabel("PA", null)).toBe("-");
    expect(formatStatByLabel("MA", undefined)).toBe("-");
  });
});
