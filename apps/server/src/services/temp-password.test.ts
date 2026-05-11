/**
 * Lot P.C.2 — Tests de `generateTempPassword`.
 */

import { describe, it, expect } from "vitest";
import { generateTempPassword } from "./temp-password";

describe("generateTempPassword", () => {
  it("retourne un password de la longueur demandee (defaut 16)", () => {
    expect(generateTempPassword().length).toBe(16);
    expect(generateTempPassword(20).length).toBe(20);
    expect(generateTempPassword(4).length).toBe(4);
  });

  it("inclut au moins une minuscule, majuscule, chiffre et symbole", () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generateTempPassword(16);
      expect(/[a-z]/.test(pwd)).toBe(true);
      expect(/[A-Z]/.test(pwd)).toBe(true);
      expect(/[0-9]/.test(pwd)).toBe(true);
      expect(/[!@#$%&*+=?]/.test(pwd)).toBe(true);
    }
  });

  it("exclut les caracteres ambigus (O 0 l 1 I)", () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generateTempPassword(16);
      expect(pwd).not.toMatch(/[O0l1I]/);
    }
  });

  it("genere des passwords differents a chaque appel (entropie)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(generateTempPassword(16));
    }
    expect(seen.size).toBe(200);
  });

  it("refuse length < 4", () => {
    expect(() => generateTempPassword(3)).toThrow(/length/i);
    expect(() => generateTempPassword(0)).toThrow();
  });
});
