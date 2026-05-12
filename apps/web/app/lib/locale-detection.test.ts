/**
 * Sprint R lot R.A.1 — tests du helper locale-detection.
 */

import { describe, it, expect } from "vitest";

import {
  DEFAULT_LOCALE,
  detectLocaleFromHeader,
  parseAcceptLanguageHeader,
} from "./locale-detection";

describe("parseAcceptLanguageHeader", () => {
  it("parse une seule entree sans q", () => {
    const out = parseAcceptLanguageHeader("en");
    expect(out).toEqual([{ tag: "en", q: 1 }]);
  });

  it("parse plusieurs entrees triees par q desc", () => {
    const out = parseAcceptLanguageHeader("fr;q=0.5,en;q=0.9,de;q=0.7");
    expect(out.map((e) => e.tag)).toEqual(["en", "de", "fr"]);
  });

  it("default q=1 si absent", () => {
    const out = parseAcceptLanguageHeader("en-US,fr;q=0.5");
    expect(out[0]).toEqual({ tag: "en-us", q: 1 });
  });

  it("ignore les entrees vides ou '*'", () => {
    const out = parseAcceptLanguageHeader("*,, ,en");
    expect(out).toEqual([{ tag: "en", q: 1 }]);
  });

  it("lowercase les tags", () => {
    const out = parseAcceptLanguageHeader("EN-US,FR");
    expect(out.map((e) => e.tag)).toEqual(["en-us", "fr"]);
  });

  it("rejette les q-values invalides (defaut 1)", () => {
    const out = parseAcceptLanguageHeader("en;q=2.0,fr;q=NaN");
    // q=2.0 invalide (max 1), q=NaN invalide → default 1.
    expect(out[0].q).toBe(1);
  });
});

describe("detectLocaleFromHeader", () => {
  it("retourne defaultLocale si header null/vide", () => {
    expect(detectLocaleFromHeader(null)).toBe(DEFAULT_LOCALE);
    expect(detectLocaleFromHeader("")).toBe(DEFAULT_LOCALE);
    expect(detectLocaleFromHeader("   ")).toBe(DEFAULT_LOCALE);
  });

  it("match exact fr", () => {
    expect(detectLocaleFromHeader("fr")).toBe("fr");
  });

  it("match exact en", () => {
    expect(detectLocaleFromHeader("en")).toBe("en");
  });

  it("match prefix en-US → en", () => {
    expect(detectLocaleFromHeader("en-US,en;q=0.9")).toBe("en");
  });

  it("respecte la q-value : en > fr", () => {
    expect(detectLocaleFromHeader("fr;q=0.5,en;q=0.9")).toBe("en");
  });

  it("respecte la q-value : fr > en", () => {
    expect(detectLocaleFromHeader("en;q=0.5,fr;q=0.9")).toBe("fr");
  });

  it("fallback default si aucun match (de non supporte)", () => {
    expect(detectLocaleFromHeader("de-DE,de;q=0.9", "fr")).toBe("fr");
  });

  it("respecte custom defaultLocale", () => {
    expect(detectLocaleFromHeader("de-DE", "en")).toBe("en");
  });

  it("preserve l'ordre de priorite quand q egal", () => {
    // Avec q identique (1), trie stable → premier element gagne.
    expect(detectLocaleFromHeader("en,fr")).toBe("en");
    expect(detectLocaleFromHeader("fr,en")).toBe("fr");
  });
});
