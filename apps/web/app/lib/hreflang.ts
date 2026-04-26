/**
 * Pure helper for hreflang alternates and canonical URLs (Q.27 — Sprint 23).
 *
 * Q.27 demande de preparer un hreflang par page pour quand le split
 * i18n sera fait (`/fr/...` vs `/en/...`). Le helper centralise la
 * logique aujourd hui dupliquee dans 8+ layouts (`teams/[slug]`,
 * `tutoriel`, `changelog`, `a-propos`, etc.) :
 *
 *   alternates: {
 *     canonical: URL,
 *     languages: { "fr-FR": URL, en: URL, "x-default": URL },
 *   }
 *
 * Comportement actuel (i18n unifiee) : meme URL pour fr / en / default.
 * Quand le split aura lieu, on flippe `splitI18n=true` au call site
 * concerne et le helper emet `/fr/...` vs `/en/...` automatiquement.
 *
 * Pure : pas d'I/O. Validation defensive (https obligatoire).
 */

export interface HreflangInput {
  /** URL de base sans trailing slash (ex: "https://nufflearena.fr"). */
  baseUrl: string;
  /** Pathname avec ou sans leading slash (ex: "/teams" ou "teams"). */
  pathname: string;
  /** Active le mode split FR/EN (futur prochain). Defaut false. */
  splitI18n?: boolean;
}

export interface HreflangAlternates {
  canonical: string;
  languages: {
    "fr-FR": string;
    en: string;
    "x-default": string;
  };
}

function assertValidBaseUrl(baseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid baseUrl: ${baseUrl}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`baseUrl must use https: ${baseUrl}`);
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function ensureLeadingSlash(path: string): string {
  if (path.length === 0) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildCanonicalUrl(input: Pick<HreflangInput, "baseUrl" | "pathname">): string {
  const base = stripTrailingSlash(input.baseUrl);
  const path = ensureLeadingSlash(input.pathname);
  if (path === "/") return base;
  return `${base}${path}`;
}

export function buildHreflangAlternates(input: HreflangInput): HreflangAlternates {
  assertValidBaseUrl(input.baseUrl);
  const base = stripTrailingSlash(input.baseUrl);
  const path = ensureLeadingSlash(input.pathname);
  const xDefault = path === "/" ? base : `${base}${path}`;

  if (!input.splitI18n) {
    // Mode actuel : meme URL pour toutes les langues.
    return {
      canonical: xDefault,
      languages: {
        "fr-FR": xDefault,
        en: xDefault,
        "x-default": xDefault,
      },
    };
  }

  // Mode split (futur) : prefixe la langue dans le path.
  const frPath = path === "/" ? "/fr" : `/fr${path}`;
  const enPath = path === "/" ? "/en" : `/en${path}`;
  return {
    canonical: xDefault,
    languages: {
      "fr-FR": `${base}${frPath}`,
      en: `${base}${enPath}`,
      "x-default": xDefault,
    },
  };
}
