/**
 * Haine (X) — acquisition du trait après une blessure (règle maison).
 *
 * Contrairement aux autres traits, Haine (X) ne s'achète PAS à l'évolution :
 * un joueur le gagne quand un adversaire l'a mis sur la touche. Le joueur
 * sorti pour au moins le match suivant (Amoché, Blessure Sérieuse, Séquelle)
 * jette 1D6 ; sur 4+, il gagne Haine (X) où X est un Mot-clé du joueur qui
 * l'a éliminé.
 *
 * X est forcément un mot-clé de LIGNÉE (Humain, Orque, Nain, Troll…) : les
 * mots-clés de POSTE (Gros Bras, Bloqueur, Blitzer, Receveur, Trois-quart,
 * Coureur, Spécial, Lanceur) sont exclus — haïr « les Blitzers » n'aurait
 * aucun sens de rivalité, et la moitié du terrain porterait le trait.
 *
 * Module 100 % PUR : pas de dé, pas de base, pas d'I/O. Le tirage et la
 * persistance vivent côté serveur (`services/league-hate-trait.ts`).
 */

import type { SkillDefinition } from "./index";
import { KEYWORDS_SEASON3 } from "../rosters/keywords-season3";
import { STAR_PLAYER_KEYWORDS } from "../rosters/star-player-keywords";

/** Résultat minimum du D6 pour gagner le trait. */
export const HATE_ROLL_TARGET = 4;

/** Le jet de D6 accorde-t-il le trait ? (4+ sur 1D6) */
export function hateRollSucceeds(roll: number): boolean {
  return Number.isFinite(roll) && roll >= HATE_ROLL_TARGET;
}

/**
 * Normalise un mot-clé pour comparaison : minuscules, sans accents, sans
 * séparateur. « Trois-quart », « trois quart » et « TROIS_QUART » se
 * rejoignent donc sur `troisquart`.
 */
export function normalizeKeyword(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Mots-clés de POSTE, jamais retenus comme X. « Blocker » est la forme
 * anglaise de « Bloqueur » : les deux sont listées, le catalogue FR
 * pouvant être relu depuis une source anglaise.
 */
export const HATE_EXCLUDED_KEYWORDS: ReadonlySet<string> = new Set(
  [
    "Gros Bras",
    "Bloqueur",
    "Blocker",
    "Blitzer",
    "Receveur",
    "Trois-quart",
    "Coureur",
    "Spécial",
    "Lanceur",
  ].map(normalizeKeyword),
);

/** Découpe un CSV de mots-clés (« Humain, Trois-quart ») en tokens propres. */
export function parseKeywordsCsv(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/**
 * Mots-clés d'un joueur pouvant servir de X, dans l'ordre du catalogue
 * (la lignée vient toujours en premier dans `KEYWORDS_SEASON3`).
 */
export function eligibleHateKeywords(
  keywordsCsv: string | null | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const keyword of parseKeywordsCsv(keywordsCsv)) {
    const norm = normalizeKeyword(keyword);
    if (!norm || HATE_EXCLUDED_KEYWORDS.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    out.push(keyword);
  }
  return out;
}

/**
 * Mot-clé retenu pour X : le premier éligible (la lignée). La règle n'en
 * accorde qu'un ; prendre le premier garde le résultat déterministe et
 * reproductible d'une validation à l'autre.
 */
export function pickHateKeyword(
  keywordsCsv: string | null | undefined,
): string | null {
  return eligibleHateKeywords(keywordsCsv)[0] ?? null;
}

/**
 * Variantes de Haine déjà présentes au catalogue sous un slug anglais :
 * on les RÉUTILISE au lieu d'en créer un doublon francisé.
 */
const EXISTING_HATE_SLUGS: Readonly<Record<string, string>> = {
  [normalizeKeyword("Troll")]: "hate-troll",
  [normalizeKeyword("Nain")]: "hate-dwarf",
};

/** Slugifie un mot-clé pour composer un slug de compétence. */
function slugifyKeyword(keyword: string): string {
  return keyword
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug de la compétence « Haine (X) » pour un mot-clé donné.
 * `null` si le mot-clé est exclu ou vide — un appelant ne doit jamais
 * fabriquer un `hate-blitzer`.
 */
export function hateSlugForKeyword(keyword: string): string | null {
  const norm = normalizeKeyword(keyword);
  if (!norm || HATE_EXCLUDED_KEYWORDS.has(norm)) return null;
  const existing = EXISTING_HATE_SLUGS[norm];
  if (existing) return existing;
  const slug = slugifyKeyword(keyword);
  return slug ? `hate-${slug}` : null;
}

/** True si un slug de compétence est une variante de Haine (X). */
export function isHateSkillSlug(slug: string): boolean {
  return slug === "hate" || slug.startsWith("hate-");
}

/**
 * Définition de la compétence « Haine (X) » à créer si elle manque au
 * catalogue. Calquée sur l'entrée `hate-troll` du registre : même texte,
 * seul le mot-clé change. Toujours `excludedFromSelection` — le trait ne
 * s'obtient qu'en étant blessé.
 */
export function buildHateSkillDefinition(
  keyword: string,
): SkillDefinition | null {
  const slug = hateSlugForKeyword(keyword);
  if (!slug) return null;
  return {
    slug,
    nameFr: `Haine (${keyword})`,
    nameEn: `Hate (${keyword})`,
    description: `Chaque fois que ce joueur effectue une Action de Blocage contre un joueur ayant le Mot-clé ${keyword}, ce joueur peut relancer un résultat Attaquant Plaqué.`,
    descriptionEn: `Whenever this player performs a Block action against a player with the ${keyword} keyword, this player may re-roll an Attacker Down result.`,
    category: "Trait",
    isPassive: true,
    season3Only: true,
    excludedFromSelection: true,
  };
}

/**
 * Mot-clé français d'un slug de Haine, reconstruit depuis le vocabulaire
 * connu (positions Season 3 + Star Players).
 *
 * La slugification est DESTRUCTRICE (« Homme Lézard » → `homme-lezard`) :
 * on ne peut pas remonter l'accentuation par calcul. On indexe donc les
 * mots-clés du catalogue par leur slug de Haine, ce qui rend le libellé
 * exact pour tout mot-clé que le moteur connaît.
 *
 * `null` pour la variante générique `hate` (pas de mot-clé) et pour un slug
 * hors vocabulaire (mot-clé venu d'une position éditée en admin).
 */
const HATE_KEYWORD_BY_SLUG: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  const add = (csv: string | null | undefined): void => {
    for (const keyword of eligibleHateKeywords(csv)) {
      const slug = hateSlugForKeyword(keyword);
      if (slug && !map.has(slug)) map.set(slug, keyword);
    }
  };
  for (const csv of Object.values(KEYWORDS_SEASON3)) add(csv);
  for (const csv of Object.values(STAR_PLAYER_KEYWORDS)) add(csv);
  return map;
})();

export function hateKeywordFromSlug(slug: string): string | null {
  return HATE_KEYWORD_BY_SLUG.get(slug) ?? null;
}

/**
 * Libellé FRANÇAIS d'un trait de Haine à partir de son seul slug.
 *
 * Les variantes de Haine sont créées À LA VOLÉE à la validation d'une
 * feuille de match : le catalogue déjà chargé par un navigateur peut donc
 * ignorer `hate-orque` et retomber sur le slug brut — que le coach lit
 * comme de l'anglais. Ce repli redonne « Haine (Orque) » sans attendre le
 * rechargement du catalogue.
 *
 * `null` si le slug n'est pas une variante de Haine : l'appelant garde
 * alors sa propre résolution.
 */
export function hateSkillLabelFr(slug: string): string | null {
  if (!isHateSkillSlug(slug)) return null;
  if (slug === "hate") return "Haine (X)";
  const keyword = hateKeywordFromSlug(slug);
  if (keyword) return `Haine (${keyword})`;
  // Mot-clé hors vocabulaire : on rend le slug lisible plutôt que brut.
  const raw = slug.slice("hate-".length).replace(/-/g, " ").trim();
  if (!raw) return "Haine (X)";
  return `Haine (${raw.charAt(0).toUpperCase()}${raw.slice(1)})`;
}
