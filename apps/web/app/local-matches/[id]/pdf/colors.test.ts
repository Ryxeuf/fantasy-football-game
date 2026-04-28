/**
 * Tests des helpers couleur du PDF de recap. Pures, aucune dep jsPDF.
 */

import { describe, expect, it } from "vitest";
import {
  darken,
  ensureContrast,
  intToHex,
  lighten,
  luminance,
  parseHex,
  resolveTeamColors,
  rgbToHex,
} from "./colors";

describe("intToHex", () => {
  it("convertit un entier 0xRRGGBB en string '#RRGGBB' uppercase", () => {
    expect(intToHex(0x1e3a8a)).toBe("#1E3A8A");
    expect(intToHex(0x000000)).toBe("#000000");
    expect(intToHex(0xffffff)).toBe("#FFFFFF");
  });
});

describe("parseHex / rgbToHex", () => {
  it("aller-retour est l'identite", () => {
    expect(rgbToHex(parseHex("#1A140C"))).toBe("#1A140C");
    expect(rgbToHex(parseHex("#FF8800"))).toBe("#FF8800");
  });

  it("parseHex tolere absence du #", () => {
    expect(parseHex("1A140C")).toEqual([26, 20, 12]);
  });

  it("parseHex retourne [0,0,0] sur input invalide", () => {
    expect(parseHex("invalid")).toEqual([0, 0, 0]);
    expect(parseHex("#XYZXYZ")).toEqual([0, 0, 0]);
  });

  it("rgbToHex clampe les valeurs hors borne", () => {
    expect(rgbToHex([300, -10, 128])).toBe("#FF0080");
  });
});

describe("lighten / darken", () => {
  it("lighten vers le blanc quand factor=1", () => {
    expect(lighten("#000000", 1)).toBe("#FFFFFF");
  });
  it("darken vers le noir quand factor=1", () => {
    expect(darken("#FFFFFF", 1)).toBe("#000000");
  });
  it("factor=0 conserve la couleur", () => {
    expect(lighten("#7A1414", 0)).toBe("#7A1414");
    expect(darken("#7A1414", 0)).toBe("#7A1414");
  });
});

describe("luminance", () => {
  it("noir => 0, blanc => 1", () => {
    expect(luminance("#000000")).toBeCloseTo(0, 3);
    expect(luminance("#FFFFFF")).toBeCloseTo(1, 3);
  });
});

describe("ensureContrast", () => {
  it("ne touche pas une couleur deja contrastee", () => {
    expect(ensureContrast("#000000", "#FFFFFF")).toBe("#000000");
  });

  it("assombrit une couleur claire sur fond clair", () => {
    const out = ensureContrast("#FAFAFA", "#F4E8C8");
    expect(luminance(out)).toBeLessThan(luminance("#FAFAFA"));
  });
});

describe("resolveTeamColors", () => {
  it("convertit les ints roster en hex et calcule un tint clair", () => {
    const colors = resolveTeamColors(0x1e3a8a, 0xfbbf24);
    expect(colors.primary).toBe("#1E3A8A");
    expect(colors.secondary).toBe("#FBBF24");
    expect(luminance(colors.tint)).toBeGreaterThan(luminance(colors.primary));
  });

  it("fournit un fallback neutre si roster manquant", () => {
    const colors = resolveTeamColors(undefined, undefined);
    expect(colors.primary).toBe("#888888");
    expect(colors.secondary).toBe("#FFFFFF");
  });
});
