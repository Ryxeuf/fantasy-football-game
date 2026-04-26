/**
 * Pure builder for external identity sameAs URLs (Q.23 — Sprint 23).
 *
 * Q.23 vise a renforcer l identite d entite Nuffle Arena dans Google
 * (Knowledge Panel) et les LLM via Wikidata + Wikipedia. La creation
 * effective des entrees Wikidata / Wikipedia est externe (manuelle,
 * sur les sites respectifs), mais le code ici expose un builder qui :
 *   - prend les identifiants depuis l env (publique)
 *   - valide les formats (defense contre placeholders / mauvais collage)
 *   - retourne un tableau d URLs canoniques pretes a injecter dans
 *     `Organization.sameAs` du JSON-LD homepage.
 *
 * Pure : pas de fetch, pas d I/O.
 */

export interface ExternalIdentityEnv {
  /** Wikidata Q-Identifier (ex: "Q42"). */
  NEXT_PUBLIC_WIKIDATA_QID?: string;
  /** URL Wikipedia FR (https://fr.wikipedia.org/...). */
  NEXT_PUBLIC_WIKIPEDIA_FR_URL?: string;
  /** URL Wikipedia EN (https://en.wikipedia.org/...). */
  NEXT_PUBLIC_WIKIPEDIA_EN_URL?: string;
}

const QID_REGEX = /^Q[1-9][0-9]{0,11}$/;

export function isValidWikidataQid(value: string | undefined | null): boolean {
  if (typeof value !== "string") return false;
  return QID_REGEX.test(value);
}

function sanitizeWikipediaUrl(value: string | undefined): string | null {
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (!parsed.hostname.endsWith(".wikipedia.org")) return null;
  if (parsed.pathname.length <= 1) return null;
  return parsed.toString();
}

export function buildExternalSameAs(
  env: ExternalIdentityEnv | undefined,
): string[] {
  if (!env) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  const addIfNew = (value: string | null) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    result.push(value);
  };

  if (isValidWikidataQid(env.NEXT_PUBLIC_WIKIDATA_QID)) {
    addIfNew(`https://www.wikidata.org/wiki/${env.NEXT_PUBLIC_WIKIDATA_QID}`);
  }
  addIfNew(sanitizeWikipediaUrl(env.NEXT_PUBLIC_WIKIPEDIA_FR_URL));
  addIfNew(sanitizeWikipediaUrl(env.NEXT_PUBLIC_WIKIPEDIA_EN_URL));

  return result;
}
