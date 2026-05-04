/**
 * S27.3.2 — Helper pur de detection de la locale device.
 *
 * Resout la langue preferee de l'utilisateur a partir de l'environnement
 * JS (Intl). Pas d'import expo-localization ni de RN ici : helper pur
 * 100% testable. Le hook React `useTranslation()` consomme ce helper
 * une fois au mount du provider.
 *
 * Strategie :
 *  1. Si `Intl.DateTimeFormat().resolvedOptions().locale` est exploitable,
 *     normaliser via `resolveLocale` du module i18n.
 *  2. Sinon (env sans Intl, throw, locale vide) : fallback 'fr'.
 *
 * NB : on accepte un `IntlLike` injectable pour faciliter les tests
 * unitaires sans toucher au global. En production, `useTranslation`
 * passe le vrai `Intl` ou rien.
 */

import { resolveLocale, type Locale } from "./i18n";

export interface IntlLike {
  DateTimeFormat: () => {
    resolvedOptions: () => { locale: string };
  };
}

const FALLBACK: Locale = "fr";

export function detectDeviceLocale(
  intl: IntlLike | null | undefined,
): Locale {
  if (!intl) return FALLBACK;
  try {
    const raw = intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof raw !== "string" || raw.length === 0) return FALLBACK;
    return resolveLocale(raw);
  } catch {
    return FALLBACK;
  }
}
