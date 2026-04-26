/**
 * Pure builder for Next.js `metadata.verification` (Q.17 — Sprint 23).
 *
 * Produit l'objet a passer dans `metadata.verification` du root layout
 * a partir des variables d'env publiques. Validation defensive pour
 * eviter de leaker des placeholders ("votre-code-...") ou des chaines
 * vides en production.
 *
 * Variables d'env consommees (toutes optionnelles) :
 *   - NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
 *   - NEXT_PUBLIC_YANDEX_VERIFICATION
 *   - NEXT_PUBLIC_BING_SITE_VERIFICATION
 *
 * Note Bing : Next.js n'a pas de propriete dediee, on passe par
 * `other['msvalidate.01']` qui est le nom de meta tag attendu.
 */

export interface WebmasterVerificationEnv {
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
  NEXT_PUBLIC_YANDEX_VERIFICATION?: string;
  NEXT_PUBLIC_BING_SITE_VERIFICATION?: string;
}

export interface WebmasterVerification {
  google?: string;
  yandex?: string;
  /**
   * Map cle->valeur pour les meta tags non standards. Bing/MS attend
   * `<meta name="msvalidate.01" content="...">`.
   */
  other?: Record<string, string>;
}

const PLACEHOLDER_PATTERNS = [
  /^votre[-_ ]/i,
  /^your[-_ ]/i,
  /^todo$/i,
  /^fixme$/i,
  /^xxx+$/i,
  /^<.*>$/, // <insert>, <code>, etc.
];
const MAX_LENGTH = 200;

function sanitize(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (value.length === 0) return undefined;
  if (value.length > MAX_LENGTH) return undefined;
  if (/\s/.test(value)) return undefined; // pas d'espace interne
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(value)) return undefined;
  }
  return value;
}

export function buildWebmasterVerification(
  env: WebmasterVerificationEnv | undefined,
): WebmasterVerification {
  const result: WebmasterVerification = {};
  if (!env) return result;

  const google = sanitize(env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION);
  if (google) result.google = google;

  const yandex = sanitize(env.NEXT_PUBLIC_YANDEX_VERIFICATION);
  if (yandex) result.yandex = yandex;

  const bing = sanitize(env.NEXT_PUBLIC_BING_SITE_VERIFICATION);
  if (bing) {
    result.other = { ...(result.other ?? {}), "msvalidate.01": bing };
  }

  return result;
}
