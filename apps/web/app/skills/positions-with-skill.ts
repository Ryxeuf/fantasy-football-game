/**
 * Utilitaire pur : à partir de la liste publique des positions (`/api/positions`)
 * et d'un slug de compétence, calcule les positions qui DÉMARRENT avec cette
 * compétence, groupées par roster. Sert à enrichir les pages
 * `/skills/[slug]` d'un bloc « Positions avec cette compétence » (maillage
 * interne vers les pages de position).
 *
 * 100 % pur (pas de React ni de fetch) ⇒ testable en unit
 * (`positions-with-skill.test.ts`).
 */

import {
  stripRosterPrefix,
  parseSkillCsv,
  cleanDisplayName,
} from "../teams/position-slug";

/** Forme minimale d'une position telle que renvoyée par `/api/positions`. */
export interface ApiPositionLite {
  readonly slug: string;
  readonly displayName: string;
  /** CSV des slugs de compétences de DÉPART (ex: "block,dodge"). */
  readonly skills: string;
  readonly rosterSlug: string;
  readonly rosterName: string;
}

/** Une position éligible, prête à être rendue en lien. */
export interface SkillPositionLink {
  readonly rosterSlug: string;
  readonly rosterName: string;
  readonly displayName: string;
  /** Segment d'URL (`/teams/{rosterSlug}/{segment}`). */
  readonly segment: string;
}

/** Un roster et les positions de ce roster qui démarrent avec la compétence. */
export interface SkillRosterGroup {
  readonly rosterSlug: string;
  readonly rosterName: string;
  readonly positions: readonly SkillPositionLink[];
}

/**
 * Positions démarrant avec `skillSlug`, triées par nom de roster puis nom de
 * position. Liste à plat (utile pour les tests / comptage).
 */
export function positionsWithStartingSkill(
  positions: readonly ApiPositionLite[],
  skillSlug: string,
): SkillPositionLink[] {
  if (!skillSlug) return [];
  return positions
    .filter((p) => parseSkillCsv(p.skills).includes(skillSlug))
    .map((p) => ({
      rosterSlug: p.rosterSlug,
      rosterName: p.rosterName,
      displayName: cleanDisplayName(p.displayName).name,
      segment: stripRosterPrefix(p.slug, p.rosterSlug),
    }))
    .sort(
      (a, b) =>
        a.rosterName.localeCompare(b.rosterName, "fr") ||
        a.displayName.localeCompare(b.displayName, "fr"),
    );
}

/**
 * Même résultat que `positionsWithStartingSkill` mais groupé par roster
 * (un bloc par équipe), groupes triés par nom de roster.
 */
export function groupPositionsByRoster(
  positions: readonly ApiPositionLite[],
  skillSlug: string,
): SkillRosterGroup[] {
  const flat = positionsWithStartingSkill(positions, skillSlug);
  const byRoster = new Map<string, SkillPositionLink[]>();
  for (const link of flat) {
    const list = byRoster.get(link.rosterSlug);
    if (list) list.push(link);
    else byRoster.set(link.rosterSlug, [link]);
  }
  return [...byRoster.entries()].map(([rosterSlug, links]) => ({
    rosterSlug,
    rosterName: links[0].rosterName,
    positions: links,
  }));
}
