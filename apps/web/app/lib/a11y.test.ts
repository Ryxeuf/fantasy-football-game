/**
 * Tests pour le helper A11y WCAG (Q.21 — Sprint 23).
 *
 * Couvre :
 *   - parseHexColor : "#RGB" / "#RRGGBB" / "RRGGBB" -> {r,g,b}
 *   - relativeLuminance : formule WCAG 2.x officielle
 *   - contrastRatio : formule WCAG 2.x officielle
 *   - meetsWCAG_AA : seuils 4.5 (texte normal) / 3.0 (texte large)
 */
import { describe, it, expect } from "vitest";
import {
  parseHexColor,
  relativeLuminance,
  contrastRatio,
  meetsWCAG_AA,
  meetsWCAG_AAA,
} from "./a11y";

describe("parseHexColor", () => {
  it("parse #RRGGBB", () => {
    expect(parseHexColor("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor("#1e3a8a")).toEqual({ r: 30, g: 58, b: 138 });
  });

  it("parse #RGB en expansant chaque digit", () => {
    expect(parseHexColor("#F00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor("#abc")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("accepte sans le prefixe #", () => {
    expect(parseHexColor("FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("retourne null pour une chaine invalide", () => {
    expect(parseHexColor("not-a-color")).toBeNull();
    expect(parseHexColor("")).toBeNull();
    expect(parseHexColor("#GGGGGG")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull(); // longueur invalide
  });
});

describe("relativeLuminance", () => {
  it("retourne 1 pour blanc pur", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 4);
  });

  it("retourne 0 pour noir pur", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it("retourne ~0.2126 pour rouge pur", () => {
    expect(relativeLuminance({ r: 255, g: 0, b: 0 })).toBeCloseTo(0.2126, 4);
  });

  it("retourne ~0.7152 pour vert pur", () => {
    expect(relativeLuminance({ r: 0, g: 255, b: 0 })).toBeCloseTo(0.7152, 4);
  });
});

describe("contrastRatio", () => {
  it("retourne 21 pour noir vs blanc (max theorique)", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
  });

  it("retourne 1 pour deux couleurs identiques", () => {
    expect(contrastRatio("#FF0000", "#FF0000")).toBe(1);
  });

  it("est commutatif (l ordre des couleurs ne change pas le resultat)", () => {
    const a = contrastRatio("#1e3a8a", "#fbbf24");
    const b = contrastRatio("#fbbf24", "#1e3a8a");
    expect(a).toBeCloseTo(b, 6);
  });

  it("retourne NaN pour entree invalide", () => {
    expect(contrastRatio("not-a-color", "#FFFFFF")).toBeNaN();
  });
});

describe("meetsWCAG_AA", () => {
  it("noir sur blanc passe AA texte normal (>=4.5)", () => {
    expect(meetsWCAG_AA("#000000", "#FFFFFF")).toBe(true);
  });

  it("rouge clair sur blanc echoue AA texte normal", () => {
    expect(meetsWCAG_AA("#FF6666", "#FFFFFF")).toBe(false);
  });

  it("seuil texte large = 3.0 (passe avec contraste plus faible)", () => {
    // contrast ratio ~3.56 entre #888888 et #FFFFFF : passe AA-large
    // (>=3) mais echoue AA-normal (>=4.5)
    expect(meetsWCAG_AA("#888888", "#FFFFFF", { large: true })).toBe(true);
    expect(meetsWCAG_AA("#888888", "#FFFFFF", { large: false })).toBe(false);
  });

  it("entree invalide -> false (defense)", () => {
    expect(meetsWCAG_AA("not-a-color", "#FFFFFF")).toBe(false);
  });
});

describe("meetsWCAG_AAA", () => {
  it("noir sur blanc passe AAA texte normal (>=7)", () => {
    expect(meetsWCAG_AAA("#000000", "#FFFFFF")).toBe(true);
  });

  it("seuil texte large = 4.5", () => {
    // ratio ~5 : passe AAA-large mais pas AAA-normal
    expect(meetsWCAG_AAA("#666666", "#FFFFFF", { large: true })).toBe(true);
    expect(meetsWCAG_AAA("#666666", "#FFFFFF", { large: false })).toBe(false);
  });
});
