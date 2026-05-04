/**
 * S27.3.2 — Tests de la logique pure du context i18n.
 *
 * Le composant `LocaleProvider` et le hook `useTranslation` sont
 * volontairement minces (Context.Provider + useState + useMemo). Le
 * comportement effectif est couvert :
 *  - par les tests purs de `resolveInitialLocale` (ici),
 *  - par les tests purs de `t()` dans `i18n.test.ts`,
 *  - par les tests purs de `detectDeviceLocale` dans `i18n-detect.test.ts`.
 *
 * Pas de @testing-library/react-native disponible cote mobile, on evite
 * d'introduire la dependance pour deux lignes de Provider.
 */

import { describe, it, expect } from "vitest";
import { resolveInitialLocale } from "./i18n-context";
import type { IntlLike } from "./i18n-detect";

const intlEN: IntlLike = {
  DateTimeFormat: () => ({
    resolvedOptions: () => ({ locale: "en-US" }),
  }),
};

const intlFR: IntlLike = {
  DateTimeFormat: () => ({
    resolvedOptions: () => ({ locale: "fr-FR" }),
  }),
};

describe("resolveInitialLocale (S27.3)", () => {
  it("renvoie 'initial' si fourni, peu importe Intl", () => {
    expect(resolveInitialLocale("en", intlFR)).toBe("en");
    expect(resolveInitialLocale("fr", intlEN)).toBe("fr");
  });

  it("utilise Intl injecte quand 'initial' est absent", () => {
    expect(resolveInitialLocale(undefined, intlEN)).toBe("en");
    expect(resolveInitialLocale(undefined, intlFR)).toBe("fr");
  });

  it("fallback 'fr' si intl=null et pas d'initial", () => {
    expect(resolveInitialLocale(undefined, null)).toBe("fr");
  });

  it("utilise globalThis.Intl quand intl=undefined (defaut runtime)", () => {
    // En env Node/jsdom utilise par vitest, Intl est present et retourne
    // probablement en-US -> 'en'. Mais on accepte 'fr' ou 'en' selon
    // l'environnement de CI : ce qui compte est qu'on ne crash pas et
    // qu'on retourne une Locale valide.
    const result = resolveInitialLocale(undefined, undefined);
    expect(["fr", "en"]).toContain(result);
  });
});
