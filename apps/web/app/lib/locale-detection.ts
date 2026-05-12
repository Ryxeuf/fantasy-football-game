/**
 * Sprint R — Lot R.A.1 : detection de locale depuis Accept-Language.
 *
 * Helper pur (testable sans Next.js runtime) qui parse un Accept-Language
 * header et retourne la meilleure locale supportee par l'app.
 *
 * Strategie :
 *   1. Parse les entrees `Accept-Language` avec leurs q-values.
 *   2. Trie par q-value desc.
 *   3. Pour chaque entree, match avec les SUPPORTED_LOCALES par prefixe
 *      (ex: "en-US" matche "en"). Premier match gagne.
 *   4. Sinon → defaultLocale.
 *
 * Exemple :
 *   parseAcceptLanguage("en-US,en;q=0.9,fr;q=0.8") → "en"
 *   parseAcceptLanguage("de-DE,de;q=0.9", default="fr") → "fr"
 *     (de pas dans SUPPORTED → fallback)
 */

export type Locale = "fr" | "en";

export const SUPPORTED_LOCALES: readonly Locale[] = ["fr", "en"] as const;
export const DEFAULT_LOCALE: Locale = "fr";

interface ParsedEntry {
  readonly tag: string;
  readonly q: number;
}

/**
 * Parse un header Accept-Language en entrees `{ tag, q }` triees par
 * q-value desc. Tolerant aux espaces et q-values invalides.
 */
export function parseAcceptLanguageHeader(header: string): ParsedEntry[] {
  return header
    .split(",")
    .map((raw): ParsedEntry | null => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const [tag, ...params] = trimmed.split(";").map((p) => p.trim());
      if (!tag || tag === "*") return null;
      let q = 1;
      for (const p of params) {
        const match = /^q=([01](?:\.\d+)?)$/.exec(p);
        if (match) {
          const parsed = Number.parseFloat(match[1]);
          if (Number.isFinite(parsed)) q = parsed;
        }
      }
      return { tag: tag.toLowerCase(), q };
    })
    .filter((e): e is ParsedEntry => e !== null)
    .sort((a, b) => b.q - a.q);
}

function isSupported(loc: string): loc is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(loc);
}

/**
 * Determine la meilleure locale supportee depuis un Accept-Language
 * header. Fallback `defaultLocale` (FR) si rien ne match.
 */
export function detectLocaleFromHeader(
  header: string | null | undefined,
  defaultLocale: Locale = DEFAULT_LOCALE,
): Locale {
  if (!header || header.trim().length === 0) return defaultLocale;
  const entries = parseAcceptLanguageHeader(header);
  for (const entry of entries) {
    // Match exact (ex: "fr") ou prefix (ex: "fr-CA" → "fr").
    if (isSupported(entry.tag)) return entry.tag;
    const prefix = entry.tag.split("-")[0];
    if (isSupported(prefix)) return prefix;
  }
  return defaultLocale;
}
