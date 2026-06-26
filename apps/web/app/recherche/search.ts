/**
 * Moteur de recherche plein-texte des parties publiques du site
 * (compendium, compétences, positions, rosters, star players). Pur et
 * testable : ne dépend ni de React ni du réseau. Les enregistrements sont
 * construits côté serveur (cf. build-records.ts) puis filtrés ici.
 */

export type SearchType = "rule" | "skill" | "position" | "roster" | "star";

export interface SearchRecord {
  readonly id: string;
  readonly type: SearchType;
  readonly title: string;
  /** Contexte affiché (chapitre, roster, catégorie…). */
  readonly subtitle?: string;
  /** Corps indexé (résumé / description / texte de section). */
  readonly text: string;
  /** Lien profond vers la page (avec ancre éventuelle). */
  readonly url: string;
}

export interface SearchHit {
  readonly record: SearchRecord;
  readonly score: number;
  /** Extrait du corps autour de la première correspondance. */
  readonly snippet: string;
}

/** Repli d'accents conservant la longueur (1 caractère en entrée → 1 en sortie). */
export function fold(input: string): string {
  return Array.from(input, (ch) => {
    const decomposed = ch.normalize("NFD");
    return (decomposed[0] ?? ch).toLowerCase();
  }).join("");
}

/** Découpe une requête en termes normalisés (≥ 2 caractères). */
export function queryTerms(query: string): string[] {
  return fold(query)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

/** Priorité d'affichage par type (à score égal). */
const TYPE_RANK: Record<SearchType, number> = {
  rule: 0,
  skill: 1,
  position: 2,
  roster: 3,
  star: 4,
};

const SNIPPET_BEFORE = 60;
const SNIPPET_AFTER = 140;

/** Construit un extrait du texte autour de la première occurrence d'un terme. */
function buildSnippet(text: string, terms: string[]): string {
  const chars = Array.from(text);
  const folded = chars.map((ch) => fold(ch)).join("");
  let at = -1;
  for (const term of terms) {
    const idx = folded.indexOf(term);
    if (idx >= 0 && (at === -1 || idx < at)) at = idx;
  }
  if (at === -1) {
    const head = chars.slice(0, SNIPPET_AFTER).join("").trim();
    return chars.length > SNIPPET_AFTER ? `${head}…` : head;
  }
  const start = Math.max(0, at - SNIPPET_BEFORE);
  const end = Math.min(chars.length, at + SNIPPET_AFTER);
  const core = chars.slice(start, end).join("").trim();
  return `${start > 0 ? "…" : ""}${core}${end < chars.length ? "…" : ""}`;
}

/**
 * Recherche les enregistrements correspondant à la requête. Un
 * enregistrement n'est retenu que si TOUS les termes apparaissent (ET).
 * Score : titre > sous-titre > corps ; bonus préfixe/égalité de titre.
 */
export function searchRecords(
  records: readonly SearchRecord[],
  query: string,
  limit = 60,
): SearchHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const foldedQuery = fold(query).trim();

  const hits: SearchHit[] = [];
  for (const record of records) {
    const title = fold(record.title);
    const subtitle = record.subtitle ? fold(record.subtitle) : "";
    const body = fold(record.text);

    let score = 0;
    let allMatched = true;
    for (const term of terms) {
      let termScore = 0;
      if (title.includes(term)) termScore += title.startsWith(term) ? 12 : 8;
      if (subtitle.includes(term)) termScore += 3;
      if (body.includes(term)) termScore += 2;
      if (termScore === 0) {
        allMatched = false;
        break;
      }
      score += termScore;
    }
    if (!allMatched) continue;

    if (title === foldedQuery) score += 25;
    else if (title.startsWith(foldedQuery)) score += 10;

    hits.push({ record, score, snippet: buildSnippet(record.text, terms) });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const tr = TYPE_RANK[a.record.type] - TYPE_RANK[b.record.type];
    if (tr !== 0) return tr;
    return a.record.title.localeCompare(b.record.title, "fr");
  });

  return hits.slice(0, limit);
}

/** Compte des résultats par type (pour les filtres). */
export function countByType(hits: readonly SearchHit[]): Record<SearchType, number> {
  const counts: Record<SearchType, number> = {
    rule: 0,
    skill: 0,
    position: 0,
    roster: 0,
    star: 0,
  };
  for (const h of hits) counts[h.record.type] += 1;
  return counts;
}
