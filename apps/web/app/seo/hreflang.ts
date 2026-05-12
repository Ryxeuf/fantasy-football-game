/**
 * Sprint R — Lot R.A.4 : helpers SEO multi-langue.
 *
 * Genere les `alternates.languages` (hreflang) pour une URL donnee.
 * Pour l'instant, toutes les locales pointent vers la **meme** URL
 * (FR par defaut) — Google accepte ce mode tant que le content
 * Server detecte la langue dynamiquement. Quand R.A.2 introduira
 * les segments `/fr/*`, `/en/*`, il suffira d'etendre `localeToHref`
 * pour faire prefixer le path.
 *
 * Convention BCP 47 :
 *   - "fr-FR" / "en" / "x-default"
 *   - Demain : "de-DE", "pl-PL" via SUPPORTED_LOCALES_SEO.
 *
 * x-default = page neutre (FR par defaut ici puisque c'est l'origin).
 */

import type { MetadataRoute } from "next";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from "../lib/locale-detection";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

/**
 * Mappe une locale `Locale` (fr|en) vers son hreflang BCP 47 complet
 * (fr-FR, en, …). Permet d'evoluer si on ajoute des variantes
 * regionales (en-GB vs en-US par ex).
 */
const LOCALE_TO_HREFLANG: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en",
};

/**
 * Construit l'URL complete pour une locale donnee. Aujourd'hui, toutes
 * les locales pointent vers la meme URL (pas de segments). Quand R.A.2
 * introduira `/fr/*` / `/en/*`, retourner ici `${BASE_URL}/${locale}${path}`.
 */
function localeToHref(locale: Locale, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // Pre-R.A.2 : pas de prefix locale. Toutes les locales = meme URL.
  void locale;
  return `${BASE_URL}${normalized === "/" ? "" : normalized}`;
}

/**
 * Genere le bloc `alternates.languages` pour un path donne, utilisable
 * dans :
 *   - `MetadataRoute.Sitemap` entries : `{ alternates: { languages: {...} } }`
 *   - `Metadata.alternates.languages` : page-level metadata
 *
 * Inclut systematiquement `x-default` pointant vers la locale par defaut.
 */
export function buildHreflangAlternates(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    map[LOCALE_TO_HREFLANG[locale]] = localeToHref(locale, path);
  }
  map["x-default"] = localeToHref(DEFAULT_LOCALE, path);
  return map;
}

/**
 * Helper pour generer une entree sitemap avec `alternates.languages`
 * pre-rempli a partir d'un path relatif.
 */
export function sitemapEntryWithAlternates(
  path: string,
  rest: Omit<MetadataRoute.Sitemap[number], "url" | "alternates">,
): MetadataRoute.Sitemap[number] {
  return {
    url: localeToHref(DEFAULT_LOCALE, path),
    alternates: { languages: buildHreflangAlternates(path) },
    ...rest,
  };
}
