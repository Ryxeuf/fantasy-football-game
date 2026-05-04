/**
 * S27.3.2 — Tests du helper de detection de locale device.
 *
 * Helper pur (pas d'import expo, pas de RN) qui resout la locale
 * preferee de l'utilisateur a partir de l'environnement (ex: Intl).
 * Fallback : 'fr' (langue principale du jeu).
 */

import { describe, it, expect } from "vitest";
import { detectDeviceLocale, type IntlLike } from "./i18n-detect";

function makeIntl(resolved: string): IntlLike {
  return {
    DateTimeFormat: () => ({
      resolvedOptions: () => ({ locale: resolved }),
    }),
  };
}

describe("detectDeviceLocale (S27.3)", () => {
  it("retourne 'fr' quand Intl renvoie fr-FR", () => {
    expect(detectDeviceLocale(makeIntl("fr-FR"))).toBe("fr");
  });

  it("retourne 'en' quand Intl renvoie en-US", () => {
    expect(detectDeviceLocale(makeIntl("en-US"))).toBe("en");
  });

  it("retourne 'en' quand Intl renvoie en-GB", () => {
    expect(detectDeviceLocale(makeIntl("en-GB"))).toBe("en");
  });

  it("fallback 'fr' quand Intl renvoie une locale inconnue", () => {
    expect(detectDeviceLocale(makeIntl("de-DE"))).toBe("fr");
    expect(detectDeviceLocale(makeIntl("ja"))).toBe("fr");
  });

  it("fallback 'fr' quand Intl est undefined (env sans Intl)", () => {
    expect(detectDeviceLocale(undefined)).toBe("fr");
  });

  it("fallback 'fr' quand Intl est null", () => {
    expect(detectDeviceLocale(null)).toBe("fr");
  });

  it("fallback 'fr' si Intl throw a l'appel", () => {
    const throwing: IntlLike = {
      DateTimeFormat: () => {
        throw new Error("boom");
      },
    };
    expect(detectDeviceLocale(throwing)).toBe("fr");
  });

  it("fallback 'fr' si resolvedOptions retourne une locale vide", () => {
    expect(detectDeviceLocale(makeIntl(""))).toBe("fr");
  });
});
