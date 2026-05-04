/**
 * S27.3.1 — Module i18n mobile (foundation).
 *
 * Module leger sans dependance externe (pas d'i18next/react-i18next).
 * Expose une fonction pure `t(key, params?, lang?)` consommable :
 *  - dans les composants React Native (passer `lang` depuis un contexte
 *    futur, ou laisser le defaut FR pour l'instant),
 *  - dans la logique pure (lib/, services/) ou React n'est pas dispo.
 *
 * Le hook `useTranslation()` (qui ecoute la locale du device et le
 * choix utilisateur) viendra dans une slice ulterieure. Pour l'instant
 * on prepare la base : remplacement progressif des strings hardcodees
 * en gardant le default FR identique a aujourd'hui.
 *
 * Pas d'import des Expo modules ici : on garde le module 100% testable
 * sans simulateur RN.
 */

import { FR_TRANSLATIONS, type FrTranslations } from "./translations/fr";
import { EN_TRANSLATIONS } from "./translations/en";

export type Locale = "fr" | "en";

/**
 * Genere recursivement toutes les cles "namespace.key" du dictionnaire
 * FR pour fournir un typage strict a `t()`.
 */
type DotKeys<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: DotKeys<
        T[K],
        Prefix extends "" ? K : `${Prefix}.${K}`
      >;
    }[keyof T & string];

export type TranslationKey = DotKeys<FrTranslations>;

const DICTIONARIES: Record<Locale, unknown> = {
  fr: FR_TRANSLATIONS,
  en: EN_TRANSLATIONS,
};

const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "en";
}

/**
 * Normalise une locale brute (ex: "fr-FR", "en-US", "de") vers `Locale`.
 * Fallback : `fr` (langue principale du jeu).
 */
export function resolveLocale(raw: string | null | undefined): Locale {
  if (typeof raw !== "string" || raw.length === 0) return DEFAULT_LOCALE;
  const short = raw.toLowerCase().split("-")[0];
  if (isLocale(short)) return short;
  return DEFAULT_LOCALE;
}

function lookupKey(dict: unknown, key: string): string | undefined {
  const segments = key.split(".");
  let cur: unknown = dict;
  for (const seg of segments) {
    if (cur && typeof cur === "object" && seg in (cur as object)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => {
    const v = params[name];
    return v === undefined || v === null ? "" : String(v);
  });
}

/**
 * Fonction de traduction principale.
 *
 * - `key` : chaine "namespace.key" (typage strict via `TranslationKey`).
 * - `params` : variables d'interpolation `{{name}}`.
 * - `lang` : locale cible (defaut FR).
 *
 * Si la cle est absente dans la locale demandee, fallback FR. Si elle
 * est aussi absente en FR, on retourne la cle telle quelle (forward-
 * compat : evite de crasher sur une cle nouvelle pas encore traduite).
 */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
  lang: Locale = DEFAULT_LOCALE,
): string {
  const direct = lookupKey(DICTIONARIES[lang], key);
  if (direct !== undefined) return interpolate(direct, params);
  // Fallback FR si la locale demandee n'a pas la cle.
  const fallback = lookupKey(DICTIONARIES.fr, key);
  if (fallback !== undefined) return interpolate(fallback, params);
  return key;
}
