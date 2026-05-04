/**
 * S27.3.2 — Contexte React Native pour la locale active.
 *
 * Expose :
 *  - `LocaleProvider` : a placer en racine (`_layout.tsx`). Detecte la
 *    locale device au mount via `detectDeviceLocale(globalThis.Intl)`,
 *    avec fallback FR. Permet a tout sous-arbre de changer la locale
 *    via `setLocale`.
 *  - `useTranslation()` : hook qui retourne `{ locale, setLocale, t }`.
 *    Le `t` retourne est lie a la locale active : pas besoin de passer
 *    `lang` aux appelants. Les helpers purs `t()` (default FR) restent
 *    disponibles dans `./i18n` pour les modules non-React.
 *
 * Pas de persistance dans cette slice (S27.3.2). Le choix utilisateur
 * sera persiste (SecureStore) dans une slice ulterieure si necessaire.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  t as translate,
  type Locale,
  type TranslationKey,
} from "./i18n";
import { detectDeviceLocale, type IntlLike } from "./i18n-detect";

export interface TranslationFn {
  (key: TranslationKey, params?: Record<string, string | number>): string;
}

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TranslationFn;
}

const FALLBACK_LOCALE: Locale = "fr";

const defaultT: TranslationFn = (key, params) =>
  translate(key, params, FALLBACK_LOCALE);

const LocaleContext = createContext<LocaleContextValue>({
  locale: FALLBACK_LOCALE,
  setLocale: () => {},
  t: defaultT,
});

interface LocaleProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
  intl?: IntlLike | null;
}

/**
 * Resout la locale initiale d'un provider :
 *  - `initial` explicite gagne toujours (utile pour les tests).
 *  - Sinon `intl` injecte (null/undefined disponible en tests).
 *  - Sinon detecte via `globalThis.Intl` (RN Hermes l'expose).
 *  - Fallback final : 'fr' via `detectDeviceLocale`.
 */
export function resolveInitialLocale(
  initial: Locale | undefined,
  intl: IntlLike | null | undefined,
): Locale {
  if (initial) return initial;
  const intlSource =
    intl === undefined
      ? ((globalThis as { Intl?: IntlLike }).Intl ?? null)
      : intl;
  return detectDeviceLocale(intlSource);
}

export function LocaleProvider({
  children,
  initialLocale,
  intl,
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    resolveInitialLocale(initialLocale, intl),
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const boundT: TranslationFn = (key, params) =>
      translate(key, params, locale);
    return { locale, setLocale, t: boundT };
  }, [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useTranslation(): LocaleContextValue {
  return useContext(LocaleContext);
}
