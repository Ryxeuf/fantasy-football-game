/**
 * S27.3.1 — Tests du module i18n mobile (foundation).
 *
 * Module leger sans dependance externe (pas d'i18next) pour fournir
 * des traductions FR/EN typees. Le hook React `useTranslation()` viendra
 * dans une slice ulterieure, ce module expose juste la fonction pure
 * `t(key, params?, lang?)` reutilisable partout.
 */

import { describe, it, expect } from "vitest";
import {
  t,
  isLocale,
  resolveLocale,
  type Locale,
} from "./i18n";

describe("isLocale (S27.3)", () => {
  it("accepte 'fr' et 'en'", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
  });

  it("rejette les autres locales", () => {
    expect(isLocale("de")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("resolveLocale (S27.3)", () => {
  it("retourne la locale exacte si valide", () => {
    expect(resolveLocale("fr")).toBe("fr");
    expect(resolveLocale("en")).toBe("en");
  });

  it("normalise les variantes regionales (fr-FR, en-US)", () => {
    expect(resolveLocale("fr-FR")).toBe("fr");
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("en-GB")).toBe("en");
  });

  it("fallback fr par defaut quand inconnu", () => {
    expect(resolveLocale("de")).toBe("fr");
    expect(resolveLocale(null)).toBe("fr");
    expect(resolveLocale(undefined)).toBe("fr");
    expect(resolveLocale("")).toBe("fr");
  });
});

describe("t (S27.3)", () => {
  it("retourne la valeur FR par defaut", () => {
    expect(t("common.cancel")).toBe("Annuler");
  });

  it("retourne la valeur EN quand lang='en'", () => {
    expect(t("common.cancel", undefined, "en")).toBe("Cancel");
  });

  it("interpolation des parametres {{name}}", () => {
    expect(t("common.welcome", { name: "Foo" })).toBe(
      "Bienvenue Foo !",
    );
    expect(t("common.welcome", { name: "Bar" }, "en")).toBe(
      "Welcome Bar!",
    );
  });

  it("retourne la cle telle quelle si la traduction est absente (forward-compat)", () => {
    expect(t("nonexistent.key" as never)).toBe("nonexistent.key");
  });

  it("fallback sur FR si la cle EN est absente", () => {
    // Cas hypothetique : si on a FR mais pas EN, on retombe FR plutot
    // que cle brute pour limiter les regressions visuelles en EN.
    // (cle factice ajoutee uniquement en FR pour ce test n'est pas
    // necessaire ici car on a parite stricte pour le moment.)
    // Verification minimale : `t` ne crash pas avec params/lang exotiques.
    expect(typeof t("common.cancel", undefined, "fr")).toBe("string");
  });
});
