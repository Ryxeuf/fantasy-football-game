/**
 * Utilitaires purs (sans React ni backend) pour les pages de detail par
 * position `/teams/[slug]/[position]`.
 *
 * Le slug DB d'une position est prefixe du slug roster
 * (ex: `skaven_lineman` pour le roster `skaven`). En URL on expose le slug
 * **prive de ce prefixe** (`/teams/skaven/lineman`) ; au rendu on resout en
 * reconstruisant `${rosterSlug}_${segment}`, avec repli "match par suffixe"
 * si l'invariant de prefixe ne tenait pas. L'invariant est verrouille par
 * `position-slug.invariant.test.ts`.
 *
 * 100 % pur => testable sans React ni fetch (cf. `position-slug.test.ts`).
 */

/** Retire le prefixe `${rosterSlug}_` d'un slug de position pour l'URL. */
export function stripRosterPrefix(
  positionSlug: string,
  rosterSlug: string,
): string {
  const prefix = `${rosterSlug}_`;
  return positionSlug.startsWith(prefix)
    ? positionSlug.slice(prefix.length)
    : positionSlug;
}

/**
 * Resout une position depuis le segment d'URL. Reconstruit d'abord
 * `${rosterSlug}_${segment}` (cas nominal garanti par l'invariant) ; replis :
 *   1. `slug === segment` (URL deja en slug complet) ;
 *   2. `slug` se terminant par `_${segment}` (prefixe roster atypique).
 * Retourne `null` si rien ne correspond.
 */
export function resolvePosition<T extends { slug: string }>(
  roster: { slug: string; positions: readonly T[] },
  segment: string,
): T | null {
  if (!segment) return null;
  const target = `${roster.slug}_${segment}`;
  return (
    roster.positions.find((p) => p.slug === target) ??
    roster.positions.find((p) => p.slug === segment) ??
    roster.positions.find((p) => p.slug.endsWith(`_${segment}`)) ??
    null
  );
}

export interface CleanedName {
  readonly name: string;
  /** `true` si le nom portait le marqueur ` *` (annotation "big guy"/0-1). */
  readonly isBigGuy: boolean;
}

/**
 * Nettoie le `displayName` d'affichage : retire le marqueur ` *` final
 * present dans certaines donnees season_3 ("Homme-arbre *", "Ogre *") et
 * expose un flag `isBigGuy`. Le slug d'URL n'est jamais affecte (les slugs
 * ne contiennent pas de `*`).
 */
export function cleanDisplayName(displayName: string): CleanedName {
  const trimmed = displayName.trim();
  const isBigGuy = /\*\s*$/.test(trimmed);
  const name = trimmed.replace(/\s*\*+\s*$/, "").trim();
  return { name, isBigGuy };
}

/** Decoupe une CSV de slugs de competences en liste propre (trim, sans vides). */
export function parseSkillCsv(
  csv: string | null | undefined,
): readonly string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse une CSV d'acces aux competences en codes canoniques ordonnes
 * G/A/S/P/M. La categorie Force est notee "F" dans certaines sources FR :
 * on la normalise en "S". Dedup + ordre stable.
 */
export function parseAccessCodes(
  csv: string | null | undefined,
): readonly string[] {
  if (!csv) return [];
  const set = new Set<string>();
  for (const ch of csv.toUpperCase()) {
    if (ch === "F") set.add("S");
    else if ("GASPM".includes(ch)) set.add(ch);
  }
  return ["G", "A", "S", "P", "M"].filter((c) => set.has(c));
}

/** Rend un slug lisible en repli quand aucun nom de competence n'est connu. */
export function prettifySlug(slug: string): string {
  return slug
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
