/**
 * Helpers purs de filtrage par mot-clé (lignée + type de joueur).
 *
 * Partagés par les positions (`/teams/positions`) et les Star Players
 * (`/star-players`) : les deux surfaces portent le même couple
 * `keywords` (FR) / `keywordsEn` (EN) au format CSV.
 * Sans I/O ni React → testables unitairement.
 */

/** Toute entité exposant des mots-clés bilingues au format CSV. */
export interface KeywordBearing {
  readonly keywords?: string | null;
  readonly keywordsEn?: string | null;
}

/** Normalise un token pour comparaison (casse/accents/tirets tolérants). */
export function normalizeKeyword(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-\s]+/g, " ")
    .trim();
}

/** Mots-clés d'une entité dans la langue voulue (FR par défaut). */
export function entityKeywords(entity: KeywordBearing, lang: string): string[] {
  const csv =
    lang === "en" ? (entity.keywordsEn ?? entity.keywords) : entity.keywords;
  return (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Liste triée des mots-clés distincts présents dans les entités (langue
 * donnée), dédoublonnée de façon insensible à la casse/aux variantes (la
 * première graphie rencontrée sert de libellé affiché).
 */
export function collectKeywordOptions(
  entities: ReadonlyArray<KeywordBearing>,
  lang: string,
): string[] {
  const byNorm = new Map<string, string>();
  for (const e of entities) {
    for (const kw of entityKeywords(e, lang)) {
      const norm = normalizeKeyword(kw);
      if (!byNorm.has(norm)) byNorm.set(norm, kw);
    }
  }
  return [...byNorm.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Filtre les entités : une entité passe si elle porte TOUS les mots-clés
 * actifs (ET logique), comparaison normalisée. `active` vide ⇒ tout passe.
 */
export function filterByKeywords<T extends KeywordBearing>(
  entities: ReadonlyArray<T>,
  active: ReadonlyArray<string>,
  lang: string,
): T[] {
  if (active.length === 0) return [...entities];
  const wanted = active.map(normalizeKeyword);
  return entities.filter((e) => {
    const have = new Set(entityKeywords(e, lang).map(normalizeKeyword));
    return wanted.every((w) => have.has(w));
  });
}
